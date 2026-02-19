// API response types (snake_case from Go backend)

export interface Source {
  id: number
  name: string
  url: string
  raw_content: string
  summary: string
  created_at: string
  updated_at: string
}

export interface Concept {
  id: number
  source_id: number
  title: string
  summary: string
  detail: string
  created_at: string
}

export interface QuizItem {
  id: number
  concept_id: number
  type: 'flashcard' | 'multiple_choice'
  prompt: string
  answer: string
  options?: string[]
  created_at: string
}

export interface CreateSourceBody {
  name: string
  url?: string
  raw_content?: string
}
