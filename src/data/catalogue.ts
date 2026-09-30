import type {
  AppCatalogue,
  AppQuestion,
  JoinedQuestion,
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

export function officialQuestionById(id: number): OfficialQuestion | undefined {
  return official.questions.find((q) => q.id === id)
}

export function joinedQuestionById(id: number): JoinedQuestion | undefined {
  const q = officialQuestionById(id)
  if (!q) return undefined
  return { ...q, app: appById.get(id) ?? { id } }
}
