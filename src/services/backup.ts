import { loadState, saveState, type UserState } from './persistence'

interface BackupFile {
  format: 'sbf-captain-backup'
  version: 2
  exportedAt: string
  state: UserState
}

export function exportBackup(): void {
  const file: BackupFile = {
    format: 'sbf-captain-backup',
    version: 2,
    exportedAt: new Date().toISOString(),
    state: loadState(),
  }
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `sbf-captain-progress-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importBackup(file: File): Promise<UserState> {
  const text = await file.text()
  const parsed = JSON.parse(text) as Partial<BackupFile> & {
    // tolerate the pre-refactor flat shape as well
    xp?: number
    n?: number
    ok?: number
    wrong?: Record<number, number>
    notes?: Record<number, string>
    streak?: number
    knots?: Record<number, boolean>
  }
  let state: UserState
  if (parsed.format === 'sbf-captain-backup' && parsed.state) {
    state = parsed.state as UserState
  } else if (typeof parsed.xp === 'number') {
    // Very old flat backup — reset SRS state, keep xp/notes/knots
    state = {
      xp: parsed.xp,
      answered: parsed.n ?? 0,
      correct: parsed.ok ?? 0,
      notes: parsed.notes ?? {},
      streakDays: parsed.streak ?? 1,
      mocks: [],
      knotsMastered: parsed.knots ?? {},
      questions: {},
    }
  } else {
    throw new Error('Unrecognised backup file')
  }
  saveState(state)
  return state
}
