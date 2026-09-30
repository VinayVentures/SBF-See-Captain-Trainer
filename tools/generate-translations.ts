#!/usr/bin/env node
/**
 * Milestone B — generate English translations, DE/EN explanations, memory
 * aids, and topic tags for every official SBF-See question.
 *
 * Output is written to data/catalogue.app.json (merged with any existing
 * entries — idempotent, resumable). Runs against Claude Sonnet 4.6 with
 * prompt caching on the system prompt and structured JSON output.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... npm run generate-translations              # all 285
 *   ANTHROPIC_API_KEY=... npm run generate-translations -- --limit 5 # first 5
 *   ANTHROPIC_API_KEY=... npm run generate-translations -- --force   # regenerate all
 *   ANTHROPIC_API_KEY=... npm run generate-translations -- --ids 1,2,42
 */

import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OFFICIAL_PATH = join(ROOT, 'data/catalogue.official.json')
const APP_PATH = join(ROOT, 'data/catalogue.app.json')

interface OfficialQuestion {
  id: number
  category: 'basis' | 'see'
  de: { question: string; answers: [string, string, string, string] }
  officialCorrectIndex: 0
}

interface AppQuestion {
  id: number
  topic?: string
  en?: { question: string; answers: [string, string, string, string] }
  explanation?: { de: string; en: string; memoryAid?: string }
  generatedBy?: {
    model: string
    at: string
    provenance: 'app-authored-llm'
    reviewed: boolean
  }
}

interface OfficialCatalogue {
  questions: OfficialQuestion[]
}

interface AppCatalogue {
  questions: AppQuestion[]
}

const args = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 ? args[idx + 1] : undefined
}
const has = (name: string): boolean => args.includes(`--${name}`)

const LIMIT = flag('limit') ? Number.parseInt(flag('limit')!, 10) : undefined
const FORCE = has('force')
const IDS = flag('ids')
  ? new Set(flag('ids')!.split(',').map((n) => Number.parseInt(n, 10)))
  : undefined
const CONCURRENCY = Number.parseInt(flag('concurrency') ?? '8', 10)
const MODEL = flag('model') ?? 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `You are producing English translations and study explanations for the official German SBF-See (Sportbootführerschein See) exam catalogue. This is for a bilingual PWA study app; your output is clearly labeled as *app-authored study aid*, not official examination text.

RULES:
1. Translate the German question and all 4 German answers faithfully into fluent, technically-correct English. Preserve the exact meaning — do not add, remove, or reinterpret. Nautical terms should use standard English maritime vocabulary (e.g. "vessel", "starboard", "bearing", "COLREG"). German-specific terms without an English equivalent (e.g. Seeschifffahrtsstraßen-Ordnung, ELWIS) can be kept in German with a short parenthetical.
2. Order matters: the ORIGINAL German array position (a/b/c/d) must be preserved in the English array. Answer index 0 (German "a") is the correct answer per ELWIS convention; do NOT reorder.
3. Explanation: write a 1-3 sentence explanation in both German and English. Explain WHY the correct answer is correct. When helpful, briefly note why one or two distractors are wrong. Keep it factual and pedagogical — do NOT invent regulatory citations you're not certain of.
4. Memory aid: OPTIONAL 1-line mnemonic in English (or bilingual). Only include one if a genuinely useful memory hook exists — omit the field otherwise. Never write filler like "Remember this rule."
5. Topic: assign ONE topic tag from this fixed list — COLREG, Lights, Signals, Sound Signals, Navigation, Charts, Buoyage, Weather, Engine, Safety, Emergency, Environment, Regulations, Anchoring, Mooring, Radio, Documents.
6. Do NOT translate or paraphrase the German source text of the question itself into the response — only produce translations, explanations, memory aid, and topic tag.

OUTPUT FORMAT — this is strict and non-negotiable:

Return ONLY a raw JSON object with EXACTLY these top-level keys, all as strings/arrays at the TOP level (not nested inside "en", "de", "translation", or any wrapper object):

{
  "topic": "<one of the topic tags>",
  "question_en": "<English translation of the German question>",
  "answers_en": ["<a>", "<b>", "<c>", "<d>"],
  "explanation_de": "<German explanation>",
  "explanation_en": "<English explanation>",
  "memory_aid": "<optional mnemonic, omit key if none>"
}

- NO nested objects like {"en": {"question": ...}} or {"translation": {...}}
- NO extra keys like "id", "source", "correct_index"
- NO markdown code fences, NO \`\`\`json wrapper
- NO prose or preamble before or after — the response must start with { and end with }
- Keep explanations under 500 characters each to stay within token budget`

const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    topic: {
      type: 'string',
      enum: [
        'COLREG', 'Lights', 'Signals', 'Sound Signals', 'Navigation', 'Charts',
        'Buoyage', 'Weather', 'Engine', 'Safety', 'Emergency', 'Environment',
        'Regulations', 'Anchoring', 'Mooring', 'Radio', 'Documents',
      ],
    },
    question_en: { type: 'string' },
    answers_en: {
      type: 'array',
      items: { type: 'string' },
      minItems: 4,
      maxItems: 4,
    },
    explanation_de: { type: 'string' },
    explanation_en: { type: 'string' },
    memory_aid: { type: 'string' },
  },
  required: [
    'topic', 'question_en', 'answers_en', 'explanation_de', 'explanation_en',
  ],
} as const

interface GeneratedContent {
  topic: string
  question_en: string
  answers_en: [string, string, string, string]
  explanation_de: string
  explanation_en: string
  memory_aid?: string
}

function loadOfficial(): OfficialCatalogue {
  return JSON.parse(readFileSync(OFFICIAL_PATH, 'utf-8')) as OfficialCatalogue
}

function loadApp(): AppCatalogue {
  try {
    return JSON.parse(readFileSync(APP_PATH, 'utf-8')) as AppCatalogue
  } catch {
    return { questions: [] }
  }
}

function saveApp(app: AppCatalogue): void {
  // Sort by id for stable diffs
  app.questions.sort((a, b) => a.id - b.id)
  writeFileSync(APP_PATH, JSON.stringify(app, null, 2) + '\n', 'utf-8')
}

function isComplete(q: AppQuestion): boolean {
  return Boolean(
    q.topic &&
      q.en?.question &&
      q.en?.answers?.every((a) => a.trim().length > 0) &&
      q.explanation?.de &&
      q.explanation?.en,
  )
}

function stripFences(s: string): string {
  const trimmed = s.trim()
  // Case 1: ```json ... ``` at the start
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/)
  if (fenced) return fenced[1]!.trim()
  // Case 2: model wrote prose before the JSON (with or without fences).
  // Extract from the first `{` to its matching `}` by counting braces
  // (naive but works for our schema — no braces inside strings we care about).
  const start = trimmed.indexOf('{')
  if (start === -1) return trimmed
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return trimmed.slice(start, i + 1)
    }
  }
  return trimmed
}

async function generateOne(
  client: Anthropic,
  q: OfficialQuestion,
): Promise<AppQuestion> {
  const userPrompt = `Q${q.id} [${q.category}]

DE question:
${q.de.question}

DE answers (index 0 = correct):
a. ${q.de.answers[0]}
b. ${q.de.answers[1]}
c. ${q.de.answers[2]}
d. ${q.de.answers[3]}

Return the JSON object.`

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    output_config: {
      format: { type: 'json_schema', schema: OUTPUT_SCHEMA },
    },
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.find(
    (b): b is Anthropic.TextBlock => b.type === 'text',
  )
  if (!textBlock) throw new Error(`Q${q.id}: no text block in response`)

  const rawText = textBlock.text
  let parsed: GeneratedContent
  try {
    parsed = JSON.parse(stripFences(rawText)) as GeneratedContent
  } catch (err) {
    throw new Error(
      `Q${q.id}: JSON parse failed (${(err as Error).message}). Raw:\n${rawText.slice(0, 500)}`,
    )
  }
  if (!Array.isArray(parsed.answers_en) || parsed.answers_en.length !== 4) {
    throw new Error(
      `Q${q.id}: bad answers_en (${JSON.stringify(parsed.answers_en)}). Full parsed:\n${JSON.stringify(parsed, null, 2).slice(0, 800)}`,
    )
  }
  if (!parsed.question_en || !parsed.explanation_de || !parsed.explanation_en || !parsed.topic) {
    throw new Error(
      `Q${q.id}: missing required fields. Parsed:\n${JSON.stringify(parsed, null, 2).slice(0, 800)}`,
    )
  }

  const app: AppQuestion = {
    id: q.id,
    topic: parsed.topic,
    en: {
      question: parsed.question_en,
      answers: parsed.answers_en,
    },
    explanation: {
      de: parsed.explanation_de,
      en: parsed.explanation_en,
      ...(parsed.memory_aid ? { memoryAid: parsed.memory_aid } : {}),
    },
    generatedBy: {
      model: MODEL,
      at: new Date().toISOString(),
      provenance: 'app-authored-llm',
      reviewed: false,
    },
  }

  const usage = response.usage
  const cachedIn = usage.cache_read_input_tokens ?? 0
  const freshIn = usage.input_tokens
  const out = usage.output_tokens
  console.log(
    `  Q${q.id.toString().padStart(3, ' ')} [${parsed.topic.padEnd(12, ' ')}] ` +
      `in=${freshIn}+${cachedIn}c out=${out}`,
  )

  return app
}

async function generateWithRetry(
  client: Anthropic,
  q: OfficialQuestion,
  attempt = 1,
): Promise<AppQuestion> {
  try {
    return await generateOne(client, q)
  } catch (err) {
    if (attempt >= 3) throw err
    const isRateLimit = err instanceof Anthropic.RateLimitError
    const isServer =
      err instanceof Anthropic.APIError && err.status >= 500 && err.status < 600
    // Don't retry on validation errors — the model returned something wrong,
    // retrying won't help and hides the real problem.
    if (!isRateLimit && !isServer) throw err
    const wait = 1000 * 2 ** (attempt - 1)
    console.warn(`  Q${q.id}: retry ${attempt + 1} in ${wait}ms (${(err as Error).message})`)
    await new Promise((r) => setTimeout(r, wait))
    return generateWithRetry(client, q, attempt + 1)
  }
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set')
    process.exit(2)
  }
  const client = new Anthropic()
  const official = loadOfficial()
  const app = loadApp()
  const byId = new Map(app.questions.map((q) => [q.id, q]))

  let candidates = official.questions
  if (IDS) candidates = candidates.filter((q) => IDS.has(q.id))
  if (!FORCE) {
    candidates = candidates.filter((q) => {
      const existing = byId.get(q.id)
      return !existing || !isComplete(existing)
    })
  }
  if (LIMIT) candidates = candidates.slice(0, LIMIT)

  if (candidates.length === 0) {
    console.log('Nothing to generate.')
    return
  }

  console.log(
    `Generating ${candidates.length} question(s) with ${MODEL} ` +
      `(concurrency=${CONCURRENCY}, force=${FORCE})`,
  )
  const start = Date.now()
  let done = 0
  const inflight = new Set<Promise<void>>()

  for (const q of candidates) {
    while (inflight.size >= CONCURRENCY) {
      await Promise.race(inflight)
    }
    const p = (async () => {
      try {
        const result = await generateWithRetry(client, q)
        byId.set(q.id, result)
        // Persist after every completion — resumable if interrupted
        app.questions = Array.from(byId.values())
        saveApp(app)
        done++
      } catch (err) {
        console.error(`  Q${q.id}: FAILED\n${(err as Error).message}\n`)
      }
    })()
    inflight.add(p)
    p.finally(() => inflight.delete(p))
  }

  await Promise.all(inflight)
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\nDone: ${done}/${candidates.length} in ${elapsed}s`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
