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
  const [data, setData] = useState(null)
  const [overrides, setOverrides] = useState({})
  const [cartItems, setCartItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [studentId, setStudentId] = useState(null)
  const [currentSem, setCurrentSem] = useState('spring')

  // =========================
  // FULL SCREEN MODALS (NEW)
  // =========================
  const [view, setView] = useState(null)
  // view = null | "chains" | "completed" | "inprogress" | "cart"

  async function loadStudent(id, ov = {}, sem = currentSem) {
    try {
      const payload = await fetchStudent(id, ov, sem)
      setData(payload)

      const blocked = new Set(payload.blockedCodes)
      setCartItems(prev => prev.filter(c => !blocked.has(c.code)))
    } catch (e) {
      console.error('Load error:', e)
    }
  }

  async function handleLogin(id) {
    setLoading(true)
    setError(null)

    try {
      const payload = await fetchStudent(id, {}, currentSem)
      setData(payload)
      setStudentId(id)
      setOverrides({})
      setCartItems([])
    } catch (e) {
      setError(e.message === 'Student not found'
        ? 'Student ID not found.'
        : `Error: ${e.message}`)
    } finally {
      setLoading(false)
    }
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
        code,
        name: rec.name,
        credits: rec.credits,
        days: rec.days,
        timeSlot: rec.timeSlot,
        room: rec.room,
        instructor: rec.instructor,
        section,
      }]
    })
  }

  function handleLogout() {
    setData(null)
    setStudentId(null)
    setOverrides({})
    setCartItems([])
    setError(null)
    setView(null)
  }

  if (!data) {
    return <Login onLogin={handleLogin} loading={loading} error={error} />
  }

  const { student, inProgress, completed, recommendations, chains } = data

  // =========================
  // FULL SCREEN MODAL WRAPPER
  // =========================
  const Modal = ({ title, onClose, children }) => (
    <div className={s.modalOverlay}>
      <div className={s.modalHeader}>
        <h2>{title}</h2>
        <button onClick={onClose} className={s.closeBtn}>✕</button>
      </div>
      <div className={s.modalBody}>
        {children}
      </div>
    </div>
  )

  // =========================
  // FULL SCREEN VIEWS
  // =========================
  if (view === 'chains') {
    return (
      <Modal title="Prerequisite Chains" onClose={() => setView(null)}>
        <Chains chains={chains} />
      </Modal>
    )
  }

  if (view === 'completed') {
    return (
      <Modal title="Completed Courses" onClose={() => setView(null)}>
        <Completed courses={completed} />
      </Modal>
    )
  }

  if (view === 'inprogress') {
    return (
      <Modal title="In Progress Courses" onClose={() => setView(null)}>
        <CurrentCourses courses={inProgress} overrides={overrides} onToggle={handleToggle} />
      </Modal>
    )
  }

  if (view === 'cart') {
    return (
      <Modal title="Cart" onClose={() => setView(null)}>
        <CartPage
          studentId={studentId}
          cartItems={cartItems}
          onRemove={code => setCartItems(prev => prev.filter(c => c.code !== code))}
          onBack={() => setView(null)}
          onSubmitted={() => {
            setCartItems([])
            setView(null)
          }}
        />
      </Modal>
    )
  }

  // =========================
  // MAIN UI
  // =========================
  return (
    <div className={s.shell}>

      {/* TOP BAR */}
      <header className={s.topbar}>
        <div className={s.brand}>Student's name</div>
        <div className={s.studentName}>{student.name}</div>

        <div className={s.semToggle}>
          <button onClick={() => handleSemesterToggle('spring')}>Spring</button>
          <button onClick={() => handleSemesterToggle('fall')}>Fall</button>
        </div>

        <button onClick={() => setView('cart')}>
          🛒 {cartItems.length}
        </button>

        <button onClick={handleLogout}>Sign out</button>
      </header>

      {/* QUICK ACTIONS */}
      <div className={s.quickActions}>
        <button onClick={() => setView('inprogress')}>📘 In Progress</button>
        <button onClick={() => setView('completed')}>✅ Completed</button>
        <button onClick={() => setView('chains')}>🔗 Chains</button>
      </div>

      {/* STATS */}
      <div className={s.stats}>
        <div>GPA: {student.gpa.toFixed(2)}</div>
        <div>Completed: {completed.length}</div>
        <div>Credits: {student.earnedCredits}</div>
      </div>

      {/* MAIN BROWSER */}
      <CourseBrowser
        recommendations={recommendations}
        cart={cartItems}
        onToggleCart={handleToggleCart}
        semester={currentSem}
      />

      {/* AI CHAT */}
      <AiChat
        student={student}
        inProgress={inProgress}
        completed={completed}
        recommendations={recommendations}
      />
    </div>
  )
}