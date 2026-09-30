export type Category = 'basis' | 'see' | 'navigation'

export type AnswerShape =
  | 'course'
  | 'coord'
  | 'distance'
  | 'time'
  | 'speed'
  | 'chartPlot'
  | 'position'
  | 'description'

export interface OfficialSource {
  publisher: 'ELWIS'
  version: string
}

export interface OfficialQuestion {
  id: number
  category: Exclude<Category, 'navigation'>
  de: {
    question: string
    answers: [string, string, string, string]
  }
  /** ELWIS convention: the correct answer is always index 0 in the raw catalogue. */
  officialCorrectIndex: 0
  source: OfficialSource
}

export interface NavTemplate {
  id: number
  de: string
  answerShape: AnswerShape
  en?: string
  source: OfficialSource
}

export interface NavScenario {
  id: number
  neCorner: { lat: string; lon: string }
  swCorner: { lat: string; lon: string }
  source: OfficialSource
}

export interface OfficialCatalogue {
  source: OfficialSource
  generatedAt: string
  questions: OfficialQuestion[]
  navTemplates: NavTemplate[]
  navScenarios: NavScenario[]
}

export interface AppQuestion {
  id: number
  topic?: string
  en?: {
    question: string
    answers: [string, string, string, string]
  }
  explanation?: {
    de: string
    en: string
    memoryAid?: string
  }
  imageRef?: string
  generatedBy?: {
    model: string
    at: string
    provenance: 'app-authored-llm' | 'app-authored-human' | 'human-reviewed'
    reviewed: boolean
  }
}

export interface AppCatalogue {
  questions: AppQuestion[]
}

export interface JoinedQuestion extends OfficialQuestion {
  app: AppQuestion
}

export interface Knot {
  id: number
  de: { name: string; use: string; steps: string[]; examSentence: string }
  en: { name: string; use: string; steps: string[]; examSentence: string }
  svg: { ghostPath: string; ropePath: string }
}
