import { useState, useCallback } from 'react'
import { fetchStudent } from './api.js'
import Login           from './components/Login.jsx'
import CurrentCourses  from './components/CurrentCourses.jsx'
import CartPage        from './components/CartPage.jsx'
import Chains          from './components/Chains.jsx'
import Completed       from './components/Completed.jsx'
import CourseBrowser   from './components/CourseBrowser.jsx'
import AiChat          from './components/AiChat.jsx'
import s               from './App.module.css'

export default function App() {
  const [data,          setData]          = useState(null)
  const [overrides,     setOverrides]     = useState({})
  const [cartItems,     setCartItems]     = useState([])
  const [loading,       setLoading]       = useState(false)
  const [error,         setError]         = useState(null)
  const [studentId,     setStudentId]     = useState(null)
  const [currentSem,    setCurrentSem]    = useState('spring')
  const [chainsOpen,    setChainsOpen]    = useState(false)
  const [currentOpen,   setCurrentOpen]   = useState(true)
  const [completedOpen, setCompletedOpen] = useState(false)
  const [showCart,      setShowCart]      = useState(false)

  async function loadStudent(id, ov = {}, sem = currentSem) {
    try {
      const payload = await fetchStudent(id, ov, sem)
      setData(payload)
      const blocked = new Set(payload.blockedCodes)
      setCartItems(prev => prev.filter(c => !blocked.has(c.code)))
    } catch (e) { console.error('Load error:', e) }
  }

  async function handleLogin(id) {
    setLoading(true); setError(null)
    try {
      const payload = await fetchStudent(id, {}, currentSem)
      setData(payload); setStudentId(id); setOverrides({}); setCartItems([])
    } catch (e) {
      setError(e.message === 'Student not found' ? 'Student ID not found.' : `Error: ${e.message}`)
    } finally { setLoading(false) }
  }

  const handleToggle = useCallback(async (code, pass) => {
    const newOv = { ...overrides, [code]: pass }
    setOverrides(newOv)
    await loadStudent(studentId, newOv, currentSem)
  }, [overrides, studentId, currentSem])

  async function handleSemesterToggle(sem) {
    setCurrentSem(sem)
    if (studentId) await loadStudent(studentId, overrides, sem)
  }

  function handleToggleCart(code, section = null) {
    setCartItems(prev => {
      const exists = prev.find(c => c.code === code)
      if (exists) return prev.filter(c => c.code !== code)
      const rec = data?.recommendations?.find(r => r.code === code)
      if (!rec) return prev
      return [...prev, {
        code, name: rec.name, credits: rec.credits,
        days: rec.days, timeSlot: rec.timeSlot, room: rec.room,
        instructor: rec.instructor, section,
      }]
    })
  }

  function handleLogout() {
    setData(null); setStudentId(null); setOverrides({})
    setCartItems([]); setError(null); setShowCart(false)
  }

  if (!data) return <Login onLogin={handleLogin} loading={loading} error={error} />

  const { student, inProgress, completed, recommendations, chains } = data

  const cascadeNames = (data.blockedCodes || [])
    .map(code => recommendations.find(r => r.code === code)?.name ?? code)
    .slice(0, 5)

  // Full-page cart view
  if (showCart) {
    return (
      <div className={s.shell}>
        <header className={s.topbar}>
          <div className={s.brand}>Advisor</div>
          <div className={s.studentName}>{student.name}</div>
          <div className={s.majorPill}>{student.major}</div>
          <div style={{marginLeft:'auto'}} />
          <button onClick={handleLogout} className={s.logoutBtn}>Sign out</button>
        </header>
        <div style={{flex:1,minHeight:0,overflow:'hidden'}}>
          <CartPage
            studentId={studentId}
            cartItems={cartItems}
            onRemove={code => setCartItems(prev => prev.filter(c => c.code !== code))}
            onBack={() => setShowCart(false)}
            onSubmitted={() => { setCartItems([]); setShowCart(false) }}
          />
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

  return (
    <div className={s.shell}>

      {/* Top bar */}
      <header className={s.topbar}>
        <div className={s.brand}>Advisor</div>
        <div className={s.studentName}>{student.name}</div>
        <div className={`${s.majorPill} ${s.hideOnMobile}`}>{student.major}</div>
        <div className={s.semToggle}>
          <span className={`${s.semLabel} ${s.hideOnMobile}`}>Sem:</span>
          <div className={s.semBtns}>
            <button className={`${s.semBtn} ${currentSem==='spring'?s.semActive:''}`} onClick={()=>handleSemesterToggle('spring')}>Spring</button>
            <button className={`${s.semBtn} ${currentSem==='fall'?s.semActive:''}`}   onClick={()=>handleSemesterToggle('fall')}>Fall</button>
          </div>
        </div>
        <button
          className={`${s.cartBtn} ${cartItems.length > 0 ? s.cartBtnActive : ''}`}
          onClick={() => setShowCart(true)}
        >
          🛒 {cartItems.length > 0 && <span className={s.cartBadge}>{cartItems.length}</span>}
        </button>
        <button onClick={handleLogout} className={s.logoutBtn}>Sign out</button>
      </header>

      {/* Stats */}
      <div className={s.stats}>
        {[
          { label:'GPA',       value: student.gpa.toFixed(2), sub: (student.gpaTrend>=0?'↑':'↓')+' '+Math.abs(student.gpaTrend).toFixed(1)+' this sem' },
          { label:'Semester',  value: `Sem ${student.semester}`, sub: student.major },
          { label:'Completed', value: completed.length, sub: 'courses passed' },
          { label:'Credits',   value: student.earnedCredits, sub: `${student.requiredCredits-student.earnedCredits} remaining` },
        ].map(({ label, value, sub }) => (
          <div key={label} className={s.stat}>
            <div className={s.statLabel}>{label}</div>
            <div className={s.statVal}>{value}</div>
            <div className={s.statSub}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Cascade warning */}
      {cascadeNames.length > 0 && (
        <div className={s.cascadeWarn}>
          Failing: {cascadeNames.join(', ')}
          {data.blockedCodes.length > 5 && ` +${data.blockedCodes.length-5} more blocked`}
        </div>
      )}

      {/* Main layout */}
      <div className={s.cols} style={{
        '--col1-width': (!currentOpen && !chainsOpen && !completedOpen) ? '180px' : '1fr'
      }}>

        {/* Col 1 — sidebar */}
        <div className={s.col}>

          <section className={s.section}>
            <div className={s.colHd} style={{cursor:'pointer'}} onClick={()=>setCurrentOpen(o=>!o)}>
              Current — {currentSem==='spring'?'Fall 2026':'Spring 2026'}
              <span className={s.hdCount}>{currentOpen?'▲':'▼'}</span>
            </div>
            {currentOpen && (
              <div className={s.colBody}>
                <CurrentCourses courses={inProgress} overrides={overrides} onToggle={handleToggle} />
              </div>
            )}
          </section>

          <section className={s.section} style={chainsOpen?{flex:1,overflow:'hidden'}:{}}>
            <div className={s.colHd} style={{cursor:'pointer'}} onClick={()=>setChainsOpen(o=>!o)}>
              Prerequisite chains
              <span className={s.hdCount}>{chainsOpen?'▲ collapse':'▼ expand'}</span>
            </div>
            {chainsOpen && (
              <div className={`${s.colBody} ${s.scrollable}`}>
                <Chains chains={chains} />
              </div>
            )}
          </section>

          <section className={s.section} style={{flex:1}}>
            <div className={s.colHd} style={{cursor:'pointer'}} onClick={()=>setCompletedOpen(o=>!o)}>
              Completed <span className={s.hdCount}>{completed.length} {completedOpen?'▲':'▼'}</span>
            </div>
            {completedOpen && (
              <div className={`${s.colBody} ${s.scrollable}`}>
                <Completed courses={completed} />
              </div>
            )}
          </section>

        </div>

        {/* Col 2+3 — course browser */}
        <div className={s.col} style={{gridColumn:'2/4'}}>
          <CourseBrowser
            recommendations={recommendations}
            cart={cartItems}
            onToggleCart={handleToggleCart}
            semester={currentSem}
          />
        </div>

      </div>

      {/* AI Chat — always visible after login */}
      <AiChat
        student={student}
        inProgress={inProgress}
        completed={completed}
        recommendations={recommendations}
      />
    </div>
  )
}
