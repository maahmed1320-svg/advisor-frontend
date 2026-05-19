import { useState, useCallback } from 'react'
import { fetchStudent, computeAdvisory } from './api.js'
import Login           from './components/Login.jsx'
import CurrentCourses  from './components/CurrentCourses.jsx'
import Chains          from './components/Chains.jsx'
import Completed       from './components/Completed.jsx'
import CourseBrowser   from './components/CourseBrowser.jsx'
import AiChat          from './components/AiChat.jsx'
import s               from './App.module.css'

export default function App() {
  // raw: cached DB data from GET /student/:id — never re-fetched on override change
  const [raw,           setRaw]           = useState(null)
  // result: engine output — updated on every override toggle via POST /compute
  const [result,        setResult]        = useState(null)
  const [overrides,     setOverrides]     = useState({})
  const [cartItems,     setCartItems]     = useState([])
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)
  const [studentId,     setStudentId]     = useState(null)
  const [currentSem,    setCurrentSem]    = useState('spring')
  const [currentOpen,   setCurrentOpen]   = useState(true)
  const [completedOpen, setCompletedOpen] = useState(false)
  const [showChains,    setShowChains]    = useState(false)

  // ── Initial load + semester change (DB fetch) ─────────────
  async function loadStudent(id, sem = currentSem) {
    const payload = await fetchStudent(id, sem)   // { raw, result }
    setRaw(payload.raw)
    setResult(payload.result)
    // Remove any cart items that are now blocked
    const blocked = new Set(payload.result.blockedCodes)
    setCartItems(prev => prev.filter(c => !blocked.has(c.code)))
  }

  async function handleLogin(id) {
    setLoading(true); setError(null)
    try {
      await loadStudent(id, currentSem)
      setStudentId(id); setOverrides({}); setCartItems([])
    } catch (e) {
      setError(e.message === 'Student not found' ? 'Student ID not found.' : `Error: ${e.message}`)
    } finally { setLoading(false) }
  }

  // ── Override toggle (engine only — zero DB queries) ────────
  const handleToggle = useCallback(async (code, pass) => {
    const newOv = { ...overrides, [code]: pass }
    setOverrides(newOv)
    try {
      const payload = await computeAdvisory(studentId, raw, newOv)  // { result }
      setResult(payload.result)
      const blocked = new Set(payload.result.blockedCodes)
      setCartItems(prev => prev.filter(c => !blocked.has(c.code)))
    } catch (e) { console.error('Compute error:', e) }
  }, [overrides, studentId, raw])

  // ── Semester change requires a real re-fetch ──────────────
  async function handleSemesterToggle(sem) {
    setCurrentSem(sem)
    if (studentId) {
      setOverrides({})   // overrides don't carry across semester change
      await loadStudent(studentId, sem)
    }
  }

  function handleToggleCart(code, section = null) {
    setCartItems(prev => {
      const exists = prev.find(c => c.code === code)
      if (exists) return prev.filter(c => c.code !== code)
      const rec = result?.recommendations?.find(r => r.code === code)
      if (!rec) return prev
      return [...prev, {
        code, name: rec.name, credits: rec.credits,
        days: rec.days, timeSlot: rec.timeSlot, room: rec.room,
        instructor: rec.instructor, section,
      }]
    })
  }

  function handleLogout() {
    setRaw(null); setResult(null); setStudentId(null)
    setOverrides({}); setCartItems([]); setError(null); setShowChains(false)
  }

  if (!result) return <Login onLogin={handleLogin} loading={loading} error={error} />

  const { student, inProgress, completed, recommendations, chainDisplay, coReqEdges, blockedCodes } = result

  const cascadeNames = (blockedCodes || [])
    .map(code => recommendations.find(r => r.code === code)?.name ?? code)
    .slice(0, 5)

  // ── Chains full-screen overlay ────────────────────────────
  if (showChains) {
    return (
      <div className={s.shell}>
        <header className={s.topbar}>
          <div className={s.brand}>Prerequisite Chains</div>
          <div className={s.studentName}>{student.name} — {student.major}</div>
          <div style={{ marginLeft: 'auto' }} />
          <button className={s.logoutBtn} onClick={() => setShowChains(false)}>
            ← Back
          </button>
        </header>
        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem 1.5rem 2rem' }}>
          <Chains
            chains={chainDisplay}
            coReqEdges={coReqEdges || []}
            blockedCodes={blockedCodes || []}
            prereqEdges={result.prereqEdges || []}  // ← add this
          />
        </div>
      </div>
    )
  }

  // ── Main view ─────────────────────────────────────────────
  return (
    <div className={s.shell}>

      <header className={s.topbar}>
        <div className={s.brand}>Academic Advisor</div>
        <div className={s.studentName}>{student.name}</div>
        <div className={s.semToggle}>
          <span className={`${s.semLabel} ${s.hideOnMobile}`}>Sem:</span>
          <div className={s.semBtns}>
            <button
              className={`${s.semBtn} ${currentSem === 'spring' ? s.semActive : ''}`}
              onClick={() => handleSemesterToggle('spring')}
            >Spring</button>
            <button
              className={`${s.semBtn} ${currentSem === 'fall' ? s.semActive : ''}`}
              onClick={() => handleSemesterToggle('fall')}
            >Fall</button>
          </div>
        </div>
        <button className={s.chainsBtn} onClick={() => setShowChains(true)}>
          🔗 Chains
        </button>
        <button
          className={`${s.cartBtn} ${cartItems.length > 0 ? s.cartBtnActive : ''}`}
          onClick={() => {/* cart UI removed — hook up your own handler here */}}
        >
          🛒 {cartItems.length > 0 && <span className={s.cartBadge}>{cartItems.length}</span>}
        </button>
        <button onClick={handleLogout} className={s.logoutBtn}>Sign out</button>
      </header>

      {/* ── Stats bar ──────────────────────────────────────── */}
      <div className={s.stats}>
        {[
          {
            label: 'CGPA',
            value: student.cgpa?.toFixed(2) ?? '—',
            sub:   student.admitTerm ?? '',
          },
          {
            label: 'Status',
            value: student.status ?? '—',
            sub:   student.major,
          },
          {
            label: 'Completed',
            value: completed.length,
            sub:   'courses passed',
          },
          {
            label: 'Credits',
            value: student.totalCreditsPassed,
            sub:   `${(student.requiredCredits - student.totalCreditsPassed)} remaining`,
          },
        ].map(({ label, value, sub }) => (
          <div key={label} className={s.stat}>
            <div className={s.statLabel}>{label}</div>
            <div className={s.statVal}>{value}</div>
            <div className={s.statSub}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Cascade warning ────────────────────────────────── */}
      {cascadeNames.length > 0 && (
        <div className={s.cascadeWarn}>
          Failing: {cascadeNames.join(', ')}
          {blockedCodes.length > 5 && ` +${blockedCodes.length - 5} more blocked`}
        </div>
      )}

      {/* ── 2-col layout ───────────────────────────────────── */}
      <div className={s.cols}>

        <div className={s.sideCol}>

          <section className={s.section}>
            <div className={s.colHd} style={{ cursor: 'pointer' }} onClick={() => setCurrentOpen(o => !o)}>
              Current — {currentSem === 'spring' ? 'Spring 2026' : 'Fall 2026'}
              <span className={s.hdCount}>{currentOpen ? '▲' : '▼'}</span>
            </div>
            {currentOpen && (
              <div className={s.colBody}>
                <CurrentCourses
                  courses={inProgress}
                  overrides={overrides}
                  onToggle={handleToggle}
                />
              </div>
            )}
          </section>

          <section className={s.section} style={{ flex: 1 }}>
            <div className={s.colHd} style={{ cursor: 'pointer' }} onClick={() => setCompletedOpen(o => !o)}>
              Completed <span className={s.hdCount}>{completed.length} {completedOpen ? '▲' : '▼'}</span>
            </div>
            {completedOpen && (
              <div className={`${s.colBody} ${s.scrollable}`}>
                <Completed courses={completed} />
              </div>
            )}
          </section>

        </div>

        <div className={s.mainCol}>
          <CourseBrowser
            recommendations={recommendations}
            cart={cartItems}
            onToggleCart={handleToggleCart}
            semester={currentSem}
          />
        </div>

      </div>

      <AiChat
        student={student}
        inProgress={inProgress}
        completed={completed}
        recommendations={recommendations}
      />

    </div>
  )
}