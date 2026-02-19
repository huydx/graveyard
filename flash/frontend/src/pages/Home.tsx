import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <>
      <h1 className="page-title">Flash Quiz</h1>
      <p className="page-subtitle">
        Turn your TILs (Today I Learned items) into a daily quiz. Add sources (Notion, URLs, or paste text), extract TILs, then practice with flashcards and multiple choice.
      </p>
      <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
        <Link to="/quiz" style={{ display: 'inline-block' }}>
          <button className="btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
            Start today's quiz
          </button>
        </Link>
        <p style={{ margin: '1rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          You'll get a random set of questions from all your notes.
        </p>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        No quiz items yet? <Link to="/sources">Add a source</Link>, paste or fetch content, then run &quot;Extract TILs&quot; to generate questions.
      </p>
    </>
  )
}
