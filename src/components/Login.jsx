import { useState } from 'react'
import s from './Login.module.css'
import logo from '../images/ADULogo.png'
import { Eye, EyeOff } from 'lucide-react'

const HINT_IDS = [
  'S001 — Student 1',
  'S002 — Student 2',
  'S004 — Student 4',
  'S005 — Student 5',
]

const BASE = import.meta.env.VITE_API_URL ?? ''

export default function Login({ onLogin, loading, error }) {
  const [showPassword, setShowPassword]   = useState(false)
  const [id, setId] = useState(() => localStorage.getItem('studentId') ?? '')
  const [pass, setPass]                   = useState('')
  const [view, setView]                   = useState('login')    // 'login' | 'forgot' | 'sent'
  const [resetEmail, setResetEmail]       = useState('')
  const [resetLoading, setResetLoading]   = useState(false)
  const [resetError, setResetError]       = useState(null)

  function submit(e) {
    e.preventDefault()
    if (id.trim()) onLogin(id.trim())
  }

  async function handleResetRequest(e) {
    e.preventDefault()
    if (!resetEmail.trim()) return
    setResetLoading(true)
    setResetError(null)
    try {
      const res = await fetch(`${BASE}/api/auth/reset-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim() }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Request failed')
      }
      setView('sent')
    } catch (e) {
      setResetError(e.message)
    } finally {
      setResetLoading(false)
    }
  }

  // ── Forgot password view ──────────────────────────────────
  if (view === 'forgot') {
    return (
      <div className={s.wrap}>
        <div><img src={logo} alt="Logo" style={{ width: 400, height: 'auto' }} /></div>
        <div className={s.wordmark}>Academic Advising System</div>

        <form className={s.card} onSubmit={handleResetRequest}>
          <h1 className={s.heading}>Reset password</h1>
          <p className={s.sub}>Enter the email address linked to your account and we'll send you a reset link.</p>

          <label className={s.label}>Email address</label>
          <input
            type="email"
            value={resetEmail}
            onChange={e => setResetEmail(e.target.value)}
            placeholder="e.g. s123456@university.ac.ae"
            autoFocus
            style={{ width: '100%', fontSize: 15, padding: '12px 14px', marginTop: 4 }}
          />

          {resetError && <p className={s.err}>{resetError}</p>}

          <button
            type="submit"
            className="primary"
            style={{ width: '100%', padding: '10px', marginTop: 12, fontSize: 13 }}
            disabled={resetLoading || !resetEmail.trim()}
          >
            {resetLoading ? 'Sending…' : 'Send reset link →'}
          </button>

          <button
            type="button"
            onClick={() => { setView('login'); setResetError(null); setResetEmail('') }}
            style={{
              width: '100%', marginTop: 6, background: 'none', border: 'none',
              color: 'var(--gray-400)', fontSize: 13, cursor: 'pointer', padding: '6px 0',
              letterSpacing: '0.05em'
            }}
          >
            ← Back to sign in
          </button>
        </form>

        <p className={s.footer}>© {new Date().getFullYear()} All Rights Reserved.</p>
      </div>
    )
  }

  // ── Email sent confirmation view ──────────────────────────
  if (view === 'sent') {
    return (
      <div className={s.wrap}>
        <div><img src={logo} alt="Logo" style={{ width: 400, height: 'auto' }} /></div>
        <div className={s.wordmark}>Academic Advising System</div>

        <div className={s.card} style={{ alignItems: 'center', textAlign: 'center', gap: 8 }}>
          <div style={{ fontSize: 38, marginBottom: 4 }}>📬</div>
          <h1 className={s.heading}>Check your inbox</h1>
          <p className={s.sub}>
            If <strong>{resetEmail}</strong> is registered, a reset link has been sent.
            Check your spam folder if you don't see it within a few minutes.
          </p>

          <button
            type="button"
            onClick={() => { setView('login'); setResetEmail('') }}
            style={{ width: '100%', padding: '10px', marginTop: 8, fontSize: 13,
              background: '#111', border: 'none', borderRadius: 8,
              color: '#fff', cursor: 'pointer', letterSpacing: '0.03em' }}
          >
            Back to sign in
          </button>
        </div>

        <p className={s.footer}>© {new Date().getFullYear()} All Rights Reserved.</p>
      </div>
    )
  }

  // ── Main login view ───────────────────────────────────────
  return (
    <div className={s.wrap}>
      <div><img src={logo} alt="Logo" style={{ width: 400, height: 'auto' }} /></div>
      <div className={s.wordmark}>Academic Advising System</div>

      <form className={s.card} onSubmit={submit}>
        <h1 className={s.heading}>Student Portal</h1>
        <p className={s.sub}>Sign in with your student ID & password</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label className={s.label}>Student ID</label>
          <input
            type="text"
            value={id}
            onChange={e => setId(e.target.value)}
            placeholder="e.g. 1082567"
            autoFocus
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 12 }}>
          <label className={s.label}>Password</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={pass}
              onChange={e => setPass(e.target.value)}
              placeholder="e.g. Sent to your Email"
              style={{ width: '100%', paddingRight: 40 }}
            />
            {/* Eye open = password visible (text), Eye closed = password hidden */}
            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              style={{
                position: 'absolute', right: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 6, borderRadius: 6, display: 'flex',
                alignItems: 'center', color: '#888', transition: 'color 0.2s', zIndex: 2
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#333'}
              onMouseLeave={e => e.currentTarget.style.color = '#888'}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
        </div>

        {/* Forgot password link */}
        <div style={{ textAlign: 'right', marginTop: 6 }}>
          <button
            type="button"
            onClick={() => setView('forgot')}
            style={{ background: 'none', border: 'none', color: '#1a3a6a',
              fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >
            Forgot password?
          </button>
        </div>

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

      <p className={s.footer}>© {new Date().getFullYear()} All Rights Reserved.</p>
    </div>
  )
}