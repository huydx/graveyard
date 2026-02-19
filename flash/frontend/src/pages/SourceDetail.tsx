import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { Source, Concept as TIL } from '../types'

export default function SourceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [source, setSource] = useState<Source | null>(null)
  const [tils, setTILs] = useState<TIL[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [followLinks, setFollowLinks] = useState(0)

  const load = () => {
    if (!id) return
    Promise.all([api.sources.get(id), api.sources.concepts(id)])
      .then(([s, c]) => {
        setSource(s)
        setTILs(Array.isArray(c) ? c : [])
      })
      .catch(() => setSource(null))
      .finally(() => setLoading(false))
  }
  useEffect(load, [id])

  const handleFetch = () => {
    if (!id) return
    setFetching(true)
    api.sources
      .fetch(id, followLinks > 0 ? { follow: followLinks } : undefined)
      .then((s) => {
        setSource(s)
        load()
      })
      .catch((e: Error) => alert(e.message))
      .finally(() => setFetching(false))
  }

  const handleExtract = () => {
    if (!id) return
    setExtracting(true)
    api.sources
      .extract(id)
      .then((s) => {
        setSource(s)
        load()
      })
      .catch((e: Error) => alert(e.message))
      .finally(() => setExtracting(false))
  }

  const handleDelete = () => {
    if (!id) return
    if (!window.confirm('Delete this source and all its concepts and quiz items? This cannot be undone.')) return
    setDeleting(true)
    api.sources
      .delete(id)
      .then(() => navigate('/sources'))
      .catch((e: Error) => alert(e.message))
      .finally(() => setDeleting(false))
  }

  if (loading || !source) {
    return (
      <div className="empty-state">
        <p>{loading ? 'Loading…' : 'Source not found.'}</p>
        <Link to="/sources">Back to sources</Link>
      </div>
    )
  }

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <Link to="/sources" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          ← Sources
        </Link>
      </div>
      <h1 className="page-title">{source.name}</h1>
      {source.url && (
        <p style={{ color: 'var(--text-muted)', margin: '0 0 1rem 0', wordBreak: 'break-all' }}>
          {source.url}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1.5rem' }}>
        {source.url && (
          <>
            <button className="btn-primary" onClick={handleFetch} disabled={fetching}>
              {fetching ? 'Fetching…' : 'Fetch URL'}
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Follow links:
              <select
                value={followLinks}
                onChange={(e) => setFollowLinks(Number(e.target.value))}
                style={{
                  padding: '0.35rem 0.5rem',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  color: 'var(--text)',
                }}
              >
                {[0, 1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <button
          className="btn-primary"
          onClick={handleExtract}
          disabled={extracting || !source.raw_content}
          style={!source.raw_content ? { opacity: 0.6 } : {}}
        >
          {extracting ? 'Extracting…' : 'Extract TILs'}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={handleDelete}
          disabled={deleting}
          style={{ color: 'var(--wrong)', marginLeft: 'auto' }}
        >
          {deleting ? 'Deleting…' : 'Delete source'}
        </button>
      </div>
      {source.url && !source.raw_content && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Click &quot;Fetch URL&quot; first to pull content from the link, then &quot;Extract TILs&quot;.
        </p>
      )}
      {!source.url && !source.raw_content && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Edit this source to add a URL or paste content, then run &quot;Extract TILs&quot;.
        </p>
      )}

      {source.summary && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>Summary</p>
          <p style={{ margin: '0.35rem 0 0 0' }}>{source.summary}</p>
        </div>
      )}

      <h2 style={{ fontSize: '1.2rem', margin: '1.5rem 0 0.75rem 0' }}>TILs ({tils.length})</h2>
      {tils.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>
          No TILs yet. Fetch the URL or paste content, then click &quot;Extract TILs&quot;.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {tils.map((t) => {
            const linkMatch = t.detail?.match(/Link:\s+(\S+)/)
            const link = linkMatch ? linkMatch[1] : ''
            return (
              <li key={t.id} className="card" style={{ marginBottom: '0.5rem' }}>
                <strong>{t.title}</strong>
                {link && (
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>
                    Link:{' '}
                    <a href={link} target="_blank" rel="noreferrer">
                      {link}
                    </a>
                  </p>
                )}
                {t.summary && (
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    {t.summary}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
