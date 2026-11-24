import type {
  AppCatalogue,
  AppQuestion,
  JoinedQuestion,
  Mode,
  OfficialCatalogue,
  OfficialQuestion,
} from './types'
import officialJson from '../../data/catalogue.official.json'
import appJson from '../../data/catalogue.app.json'

const official = officialJson as OfficialCatalogue
const app = appJson as AppCatalogue

const appById = new Map<number, AppQuestion>(app.questions.map((q) => [q.id, q]))

export const CATALOGUE = official

export function joinedQuestions(): JoinedQuestion[] {
  return official.questions.map((q) => ({
    ...q,
    app: appById.get(q.id) ?? { id: q.id },
  }))
}

/** Joined questions filtered to a single licence mode's pool. */
export function joinedQuestionsForMode(mode: Mode): JoinedQuestion[] {
  return questionsForMode(mode).map((q) => ({
    ...q,
    app: appById.get(q.id) ?? { id: q.id },
  }))
}

export function officialQuestionById(id: number): OfficialQuestion | undefined {
  return official.questions.find((q) => q.id === id)
}

export function joinedQuestionById(id: number): JoinedQuestion | undefined {
  const q = officialQuestionById(id)
  if (!q) return undefined
  return { ...q, app: appById.get(id) ?? { id } }
}

/**
 * Map a question's category to the set of modes (licences) in which it appears.
 * Basis questions are shared across all three modes; mode-specific categories
 * are gated accordingly.
 */
export function licencesOf(category: OfficialQuestion['category']): readonly Mode[] {
  switch (category) {
    case 'basis':
      return ['see', 'binnen-motor', 'binnen-segeln']
    case 'see':
      return ['see']
    case 'binnen':
      return ['binnen-motor', 'binnen-segeln']
    case 'segeln':
      return ['binnen-segeln']
  }
}

export function questionBelongsToMode(
  q: Pick<OfficialQuestion, 'category'>,
  mode: Mode,
): boolean {
  return licencesOf(q.category).includes(mode)
}

export function questionsForMode(mode: Mode): OfficialQuestion[] {
  return official.questions.filter((q) => questionBelongsToMode(q, mode))
}
