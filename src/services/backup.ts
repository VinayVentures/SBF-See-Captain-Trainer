import { loadAllModes, saveAllModes, type ModeStates, type UserState } from './persistence'

interface BackupFileV3 {
  format: 'sbf-captain-backup'
  version: 3
  exportedAt: string
  modes: ModeStates
}

export function exportBackup(): void {
  const file: BackupFileV3 = {
    format: 'sbf-captain-backup',
    version: 3,
    exportedAt: new Date().toISOString(),
    modes: loadAllModes(),
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

export async function importBackup(file: File): Promise<ModeStates> {
  const text = await file.text()
  const parsed = JSON.parse(text) as {
    format?: string
    version?: number
    modes?: ModeStates
    state?: UserState
    xp?: number
    n?: number
    ok?: number
    wrong?: Record<number, number>
    notes?: Record<number, string>
    streak?: number
    knots?: Record<number, boolean>
  }
  let modes: ModeStates
  if (parsed.format === 'sbf-captain-backup' && parsed.version === 3 && parsed.modes) {
    modes = parsed.modes
  } else if (parsed.format === 'sbf-captain-backup' && parsed.version === 2 && parsed.state) {
    modes = {
      see: parsed.state,
      'binnen-motor': emptyUserState(),
      'binnen-segeln': emptyUserState(),
    }
  } else if (typeof parsed.xp === 'number') {
    modes = {
      see: {
        xp: parsed.xp,
        answered: parsed.n ?? 0,
        correct: parsed.ok ?? 0,
        notes: parsed.notes ?? {},
        streakDays: parsed.streak ?? 1,
        mocks: [],
        knotsMastered: parsed.knots ?? {},
        questions: {},
      },
      'binnen-motor': emptyUserState(),
      'binnen-segeln': emptyUserState(),
    }
  } else {
    throw new Error('Unrecognised backup file')
  }
  saveAllModes(modes)
  return modes
}

function emptyUserState(): UserState {
  return {
    xp: 0,
    answered: 0,
    correct: 0,
    notes: {},
    streakDays: 1,
    mocks: [],
    knotsMastered: {},
    questions: {},
  }
}
