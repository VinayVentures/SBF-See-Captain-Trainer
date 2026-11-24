import type { Mode } from '../data/types'
import { MODES } from '../data/types'

const STORAGE_KEY = 'sbf.mode'
const DEFAULT: Mode = 'see'

type Listener = (mode: Mode) => void
const listeners = new Set<Listener>()

function read(): Mode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw && (MODES as readonly string[]).includes(raw)) return raw as Mode
  } catch {
    // localStorage may be unavailable (SSR, privacy mode)
  }
  return DEFAULT
}

let current: Mode = read()

export function currentMode(): Mode {
  return current
}

export function setMode(mode: Mode): void {
  if (mode === current) return
  current = mode
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore
  }
  listeners.forEach((l) => l(mode))
}

export function onModeChange(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const MODE_LABELS: Record<Mode, { short: string; long: string; icon: string }> = {
  see: { short: 'See', long: 'SBF-See', icon: '⚓' },
  'binnen-motor': { short: 'Binnen · Motor', long: 'SBF-Binnen (Motor)', icon: '🛥' },
  'binnen-segeln': { short: 'Binnen · Segeln', long: 'SBF-Binnen (Segeln)', icon: '⛵' },
}

/**
 * Mock-exam composition per mode. Derived from the ELWIS Fragenverteilung PDFs
 * (see data/raw/fragenverteilung.pdf and fragenverteilung-binnen.pdf).
 *
 * See mode uses the full ELWIS composition (7 Basis + 23 See + 9 nav).
 * Binnen modes assume the learner already holds the SBF-See and thus has
 * the Basis portion waived; their mocks therefore contain only the
 * mode-specific sections.
 */
export const MOCK_COMPOSITION: Record<
  Mode,
  { basis: number; specific: number; segeln?: number; navigation?: number }
> = {
  see: { basis: 7, specific: 23, navigation: 9 },
  'binnen-motor': { basis: 0, specific: 23 },
  'binnen-segeln': { basis: 0, specific: 23, segeln: 7 },
}
