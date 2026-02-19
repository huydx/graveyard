import type { Source, Concept, QuizItem, CreateSourceBody } from './types'

const API = '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (res.status === 204) return null as T
  const data = await res.json().catch(() => ({})) as { error?: string }
  if (!res.ok) throw new Error(data.error ?? res.statusText)
  return data as T
}

export const api = {
  sources: {
    list: () => request<Source[]>('/sources'),
    get: (id: string) => request<Source>(`/sources/${id}`),
    delete: (id: string) =>
      request<null>(`/sources/${id}`, { method: 'DELETE' }),
    create: (body: CreateSourceBody) =>
      request<Source>('/sources', { method: 'POST', body: JSON.stringify(body) }),
    fetch: (id: string, opts?: { follow?: number }) => {
      const path = opts?.follow != null ? `/sources/${id}/fetch?follow=${opts.follow}` : `/sources/${id}/fetch`
      return request<Source>(path, { method: 'POST' })
    },
    extract: (id: string) => request<Source>(`/sources/${id}/extract`, { method: 'POST' }),
    concepts: (id: string) => request<Concept[]>(`/sources/${id}/concepts`),
  },
  quiz: {
    daily: () => request<QuizItem[]>('/quiz/daily'),
    review: (id: number, correct: boolean) =>
      request<null>(`/quiz/items/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ correct }),
      }),
  },
}
