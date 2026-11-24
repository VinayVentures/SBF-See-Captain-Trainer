export type Category = 'basis' | 'see' | 'binnen' | 'segeln' | 'navigation'

/**
 * A `Mode` is one of the three licences the app supports as a top-level tab.
 * Each question's `category` determines which modes it appears in — see
 * `licencesOf()` in `src/data/catalogue.ts`.
 */
export type Mode = 'see' | 'binnen-motor' | 'binnen-segeln'

export const MODES: readonly Mode[] = ['see', 'binnen-motor', 'binnen-segeln']

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
  /**
   * User-facing ELWIS question number. Equal to `String(id)` for See content
   * and Basis; for Binnen-specific questions it drops the +1000 offset
   * (e.g. internal id 1073 has displayId "73"), and similarly for Segeln
   * with the +2000 offset. Always use this in the UI; never render `id`.
   */
  displayId: string
  category: Exclude<Category, 'navigation'>
  de: {
    question: string
    answers: [string, string, string, string]
  }
  /** ELWIS convention: the correct answer is always index 0 in the raw catalogue. */
  officialCorrectIndex: 0
  source: OfficialSource
  /** Filenames (under /data/images/) for any images referenced by this question. */
  images?: string[]
}

export interface NavTemplate {
  id: number
  de: string
  answerShape: AnswerShape
  en?: string
  source: OfficialSource
  images?: string[]
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
