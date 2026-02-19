import { useState } from 'react'

interface FlashCardProps {
  prompt: string
  answer: string
  showResult: boolean
  correct: boolean | null
  onRate: (correct: boolean) => void
  onNext: () => void
}

export default function FlashCard({ prompt, answer, showResult, correct, onRate, onNext }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false)

  const handleFlip = () => {
    if (!showResult) setFlipped((f) => !f)
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleFlip}
        onKeyDown={(e) => e.key === 'Enter' && handleFlip()}
        style={{
          padding: '2rem 1.5rem',
          minHeight: 200,
          cursor: showResult ? 'default' : 'pointer',
          background: flipped ? 'var(--surface-hover)' : 'var(--surface)',
          transition: 'background 0.2s',
        }}
      >
        <p style={{ margin: 0, fontSize: '1.05rem', color: flipped ? 'var(--text-muted)' : 'var(--text)' }}>
          {flipped ? 'Answer' : 'Question'}
        </p>
        <p style={{ margin: '0.75rem 0 0 0', fontSize: '1.15rem', lineHeight: 1.6 }}>
          {flipped ? answer : prompt}
        </p>
      </div>

      {!showResult && flipped && (
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn-primary"
            style={{ flex: 1, background: 'var(--wrong)' }}
            onClick={() => onRate(false)}
          >
            Forgot
          </button>
          <button className="btn-primary" style={{ flex: 1 }} onClick={() => onRate(true)}>
            Got it
          </button>
        </div>
      )}

      {showResult && (
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid var(--border)',
            background: correct ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 69, 58, 0.1)',
            color: correct ? 'var(--correct)' : 'var(--wrong)',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{correct ? 'Correct' : 'Keep reviewing'}</span>
          <button className="btn-primary" onClick={onNext}>
            Next
          </button>
        </div>
      )}
    </div>
  )
}
