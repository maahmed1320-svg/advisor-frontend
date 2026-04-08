import { useState } from 'react'
import s from './Login.module.css'

const HINT_IDS = [
  'S001 — Student 1',
  'S002 — Student 2',
  'S003 — Student 3',
  'S004 — Student 4',
  'S005 — Student 5',
]

export default function Login({ onLogin, loading, error }) {
  const [id, setId]   = useState('')
  const [pw, setPw]   = useState('')

  function submit(e) {
    e.preventDefault()
    if (id.trim()) onLogin(id.trim().toUpperCase())
  }

  return (
    <div className={s.wrap}>
      <div className={s.wordmark}>Academic Advising System</div>
      <form className={s.card} onSubmit={submit}>
        <h1 className={s.heading}>Student Portal</h1>
        <p className={s.sub}>Sign in with your student ID</p>

        <label className={s.label}>Student ID</label>
        <input
          type="text"
          value={id}
          onChange={e => setId(e.target.value)}
          placeholder="e.g. S001"
          autoFocus
        />

        <label className={s.label} style={{ marginTop: 12 }}>Password</label>
        <input
          type="password"
          value={pw}
          onChange={e => setPw(e.target.value)}
          placeholder="••••••••"
        />

        {error && <p className={s.err}>{error}</p>}

        <button
          type="submit"
          className="primary"
          style={{ width: '100%', padding: '10px', marginTop: 16, fontSize: 13 }}
          disabled={loading || !id.trim()}
        >
          {loading ? 'Loading…' : 'Sign in →'}
        </button>

        <div className={s.hints}>
          {HINT_IDS.map(h => <span key={h}>{h}</span>)}
        </div>
      </form>
    </div>
  )
}
