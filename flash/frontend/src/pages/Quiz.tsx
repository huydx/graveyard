import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { QuizItem } from '../types'
import FlashCard from '../components/FlashCard'
import MultipleChoice from '../components/MultipleChoice'

export default function Quiz() {
  const [items, setItems] = useState<QuizItem[] | null>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)
  const [showResult, setShowResult] = useState(false)
  const [correct, setCorrect] = useState<boolean | null>(null)

  useEffect(() => {
    api.quiz
      .daily()
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const safeItems = items ?? []
  const current = safeItems[index]
  const progress = safeItems.length ? `${index + 1} / ${safeItems.length}` : ''

  const handleAnswer = async (isCorrect: boolean) => {
    setCorrect(isCorrect)
    setShowResult(true)
    if (current) {
      try {
        await api.quiz.review(current.id, isCorrect)
      } catch (_) {}
    }
  }

  const handleNext = () => {
    setShowResult(false)
    setCorrect(null)
    setIndex((i) => i + 1)
  }

  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading quiz…</p>
      </div>
    )
  }
  if (error) {
    return (
      <div className="empty-state">
        <p>{error}</p>
        <Link to="/sources">Add sources</Link> and extract TILs to get questions.
      </div>
    )
  }
  if (safeItems.length === 0) {
    return (
      <div className="empty-state">
        <h2 className="page-title">No quiz yet</h2>
        <p>Add sources and run &quot;Extract TILs&quot; to generate questions.</p>
        <Link to="/sources">
          <button className="btn-primary">Go to sources</button>
        </Link>
      </div>
    )
  }
  if (index >= safeItems.length) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
        <h2 className="page-title">Done!</h2>
        <p className="page-subtitle">You've completed today's quiz.</p>
        <Link to="/">
          <button className="btn-primary">Back to home</button>
        </Link>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>
          Today's quiz
        </h1>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
          {progress}
        </span>
      </div>

      {current.type === 'flashcard' ? (
        <FlashCard
          prompt={current.prompt}
          answer={current.answer}
          showResult={showResult}
          correct={correct}
          onRate={handleAnswer}
          onNext={handleNext}
        />
      ) : (
        <MultipleChoice
          prompt={current.prompt}
          answer={current.answer}
          options={current.options ?? []}
          showResult={showResult}
          correct={correct}
          onSelect={handleAnswer}
          onNext={handleNext}
        />
      )}
    </>
  )
}
