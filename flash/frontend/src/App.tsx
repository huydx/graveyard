import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Home from './pages/Home'
import Sources from './pages/Sources'
import SourceDetail from './pages/SourceDetail'
import Quiz from './pages/Quiz'

const navStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border)',
  background: 'var(--surface)',
  padding: '0.75rem 1.5rem',
}
const navInnerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  display: 'flex',
  gap: '1.5rem',
}

function linkStyle({ isActive }: { isActive: boolean }): React.CSSProperties {
  return {
    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
    fontWeight: isActive ? 600 : 500,
    textDecoration: 'none',
  }
}

function App() {
  return (
    <BrowserRouter>
      <nav style={navStyle}>
        <div style={navInnerStyle}>
          <NavLink to="/" style={linkStyle} end>
            Quiz
          </NavLink>
          <NavLink to="/sources" style={linkStyle}>
            Sources
          </NavLink>
        </div>
      </nav>
      <main className="app-shell">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/sources" element={<Sources />} />
          <Route path="/sources/:id" element={<SourceDetail />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

export default App
