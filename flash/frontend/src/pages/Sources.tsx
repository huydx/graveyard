import { useState, useEffect, FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { Source } from '../types'

export default function Sources() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [rawContent, setRawContent] = useState('')

  const load = () => {
    api.sources
      .list()
      .then((data) => setSources(Array.isArray(data) ? data : []))
      .catch(() => setSources([]))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    api.sources
      .create({
        name: name.trim(),
        url: url.trim() || undefined,
        raw_content: rawContent.trim() || undefined,
      })
      .then(() => {
        setName('')
        setUrl('')
        setRawContent('')
        setShowForm(false)
        load()
      })
      .catch((err: Error) => alert(err.message))
  }

  if (loading) {
    return (
      <div className="empty-state">
        <p>Loading sources…</p>
      </div>
    )
  }

  return (
    <>
      <h1 className="page-title">Sources</h1>
      <p className="page-subtitle">
        Add Notion links, any URL, or paste notes. Then fetch (for URLs) or extract TILs to generate quiz items.
      </p>

      {!showForm ? (
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          Add source
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="form-group">
            <label>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Notion – ML notes"
              required
            />
          </div>
          <div className="form-group">
            <label>URL (optional – use for Fetch)</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              type="url"
            />
          </div>
          <div className="form-group">
            <label>Paste content (optional – use if no URL or for manual notes)</label>
            <textarea
              value={rawContent}
              onChange={(e) => setRawContent(e.target.value)}
              placeholder="Paste your notes here. Use headings or blank lines to separate concepts."
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" className="btn-primary">
              Save source
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        {(!sources || sources.length === 0) ? (
          <div className="empty-state">
            <p>No sources yet. Add one to get started.</p>
          </div>
        ) : (
          sources.map((s) => (
            <Link key={s.id} to={`/sources/${s.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="card" style={{ cursor: 'pointer', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <strong style={{ fontSize: '1.05rem' }}>{s.name}</strong>
                    {s.url && (
                      <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {s.url}
                      </p>
                    )}
                    {s.summary && (
                      <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                        {s.summary.slice(0, 120)}…
                      </p>
                    )}
                  </div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>→</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </>
  )
}
