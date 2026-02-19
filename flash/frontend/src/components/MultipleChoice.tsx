import { useState } from 'react'

interface MultipleChoiceProps {
  prompt: string
  answer: string
  options: string[]
  showResult: boolean
  correct: boolean | null
  onSelect: (correct: boolean) => void
  onNext: () => void
}

export default function MultipleChoice({
  prompt,
  answer,
  options,
  showResult,
  correct,
  onSelect,
  onNext,
}: MultipleChoiceProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const handleClick = (option: string) => {
    if (showResult) return
    setSelected(option)
    onSelect(option === answer)
  }

  const getOptionStyle = (option: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      display: 'block',
      width: '100%',
      textAlign: 'left',
      padding: '1rem 1.25rem',
      marginBottom: '0.5rem',
      background: 'var(--bg)',
      border: '1px solid var(--border)',
      borderRadius: '8px',
      color: 'var(--text)',
      fontSize: '1rem',
    }
    if (!showResult) {
      return { ...base, cursor: 'pointer' }
    }
    if (option === answer) {
      return { ...base, borderColor: 'var(--correct)', background: 'rgba(52, 199, 89, 0.15)' }
    }
    if (option === selected && option !== answer) {
      return { ...base, borderColor: 'var(--wrong)', background: 'rgba(255, 69, 58, 0.15)' }
    }
    return { ...base, opacity: 0.7 }
  }

  return (
    <div className="card">
      <p style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', lineHeight: 1.5 }}>{prompt}</p>
      <div>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            style={getOptionStyle(option)}
            onClick={() => handleClick(option)}
            disabled={showResult}
          >
            {option}
          </button>
        ))}
      </div>
      {showResult && (
        <div
          style={{
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            color: correct ? 'var(--correct)' : 'var(--wrong)',
            fontWeight: 600,
          }}
        >
          <span>{correct ? 'Correct' : 'Incorrect'}</span>
          <button className="btn-primary" onClick={onNext}>
            Next
          </button>
        </div>
      )}
    </div>
  )
}
