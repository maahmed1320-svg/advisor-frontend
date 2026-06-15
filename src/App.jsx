import { useState, useEffect, useCallback } from 'react'
import { fetchStudent, computeAdvisory } from './api.js'
import Login           from './components/Login.jsx'
import CurrentCourses  from './components/CurrentCourses.jsx'
import Chains          from './components/Chains.jsx'
import CourseBrowser   from './components/CourseBrowser.jsx'
import AiChat          from './components/AiChat.jsx'
import CartPage        from './components/CartPage.jsx' 
import s               from './App.module.css'

export default function App() {
  const [result,           setResult]           = useState(null)
  const [cartItems,        setCartItems]        = useState([])
  const [PassFailCourses,  setPassFailCourses]  = useState({})
  const [loading,          setLoading]          = useState(false)
  const [error,            setError]            = useState(null)
  const [studentId,        setStudentId]        = useState(null)
  const [nextSem,          setNextSem]          = useState('fall')
  const [currentOpen,      setCurrentOpen]      = useState(true)
  const [completedOpen,    setCompletedOpen]    = useState(false)
  const [showChains,       setShowChains]       = useState(false)
  const [showCartPage,     setShowCartPage]     = useState(false)
  const [campus,           setCampus]           = useState('')
  const [gpaPanelOpen,     setGpaPanelOpen]     = useState(false)
  const [submittedDbCodes, setSubmittedDbCodes] = useState(new Set())

  useEffect(() => {
    const savedId = localStorage.getItem('studentId')
    if (savedId) handleLogin(savedId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch submitted enrollments from DB + restore cart ────
  const fetchActiveDbSubmissions = useCallback(async (id, freshResultPayload = null) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ''}/api/student/${id}/enrollments_raw`)
      if (!res.ok) return
      const data = await res.json()
      const submissions = data.submissions || []

      // Rebuild submittedDbCodes set
      setSubmittedDbCodes(new Set(submissions.map(s => s.course_code)))

      // Use the passed payload if available, otherwise fallback to the current component state
      const targetLookupSource = freshResultPayload || result;

      if (submissions.length > 0) {
        setCartItems(prev => {
          const existingCodes = new Set(prev.map(i => i.code))
          
          const restored = submissions
            .filter(s => !existingCodes.has(s.course_code))
            .map(s => {
              // 1. Look up the full master course details from the academic result mapping
              const masterCourse = targetLookupSource?.recommendations?.find(c => c.code === s.course_code) ||
                                   targetLookupSource?.All_courses?.find(c => c.code === s.course_code);

              // 2. Extract and filter all rows matching the chosen registration number
              const matchedSections = masterCourse?.sections?.filter(
                sec => String(sec.class_nbr) === String(s.class_nbr)
              ) || [];

              const primarySec = matchedSections[0] || {};
              
              const instructorName = primarySec 
                ? `${primarySec.first_name ?? ''} ${primarySec.last_name ?? ''}`.trim() 
                : (s.instructor ?? 'TBA');

              // 3. Construct a standard object structure with your critical fromDb flag
              return {
                code:       s.course_code,
                name:       masterCourse?.name ?? s.name ?? s.course_code,
                credits:    masterCourse?.credits ?? primarySec?.max_units ?? s.credits ?? 0,
                instructor: instructorName || 'TBA',
                room:       primarySec?.room ?? s.room ?? 'TBA',
                fromDb:     true, // 💡 CRITICAL ATTRIBUTE: Distinguishes DB records from client session drafts
                section: {
                  class_nbr:   String(s.class_nbr),
                  section:     primarySec?.section ?? s.section ?? null,
                  session:     primarySec?.session ?? s.session ?? 'FAL',
                  campus:      primarySec?.campus ?? s.campus ?? 'AD',
                  room:        primarySec?.room ?? s.room ?? 'TBA',
                  mtg_start:   primarySec?.mtg_start ?? s.mtg_start ?? null,
                  mtg_end:     primarySec?.mtg_end ?? s.mtg_end ?? null,
                  Mon:         primarySec?.Mon ?? false,
                  Tues:        primarySec?.Tues ?? false,
                  Wed:         primarySec?.Wed ?? false,
                  Thurs:       primarySec?.Thurs ?? false,
                  Fri:         primarySec?.Fri ?? false,
                  // Fallback array to avoid crashing if master course list is unpopulated
                  subSections: matchedSections.length > 0 ? matchedSections : [{
                    section:   s.section ?? null,
                    session:   s.session ?? 'FAL',
                    campus:    s.campus ?? 'AD',
                    room:      s.room ?? 'TBA',
                    mtg_start: s.mtg_start ?? null,
                    mtg_end:   s.mtg_end ?? null,
                    class_nbr: s.class_nbr ?? null,
                  }]
                }
              }
            })
          return [...prev, ...restored]
        })
      }
    } catch (err) {
      console.error('Failed syncing active cart table state mappings:', err)
    }
  }, [result])

  async function loadStudent(id) {
    const payload = await fetchStudent(id)
    setResult(payload.result)
    return payload.result; // 💡 RETURN DIRECTLY: Hands payload forward to prevent async lag delays
  }

  async function handleLogin(id) {
    setLoading(true); setError(null)
    try {
      const freshResult = await loadStudent(id) // Capture payload
      setStudentId(id)
      setPassFailCourses({})
      localStorage.setItem('studentId', id)
      setCartItems([]) 
      await fetchActiveDbSubmissions(id, freshResult) // Pass directly into lookup parameters
    } catch (e) {
      setError(e.message === 'Student not found' ? 'Student ID not found.' : `Error: ${e.message}`)
    } finally { setLoading(false) }
  }

  const CurrentTakingCoursesSTATUS = useCallback(async (code, pass) => {
    const newOv = { ...PassFailCourses, [code]: pass }
    setPassFailCourses(newOv)
    try {
      const payload = await computeAdvisory(studentId, newOv)
      setResult(payload.result)
      const blocked = payload.result.blockedSet
      setCartItems(prev => prev.filter(c => !blocked.includes(c.code) || submittedDbCodes.has(c.code)))
    } catch (e) { console.error('Compute error:', e) }
  }, [PassFailCourses, studentId, submittedDbCodes])

  function handleToggleCart(code, section = null) {
    if (submittedDbCodes.has(code)) return

    setCartItems(prev => {
      const exists = prev.find(c => c.code === code)
      if (exists) return prev.filter(c => c.code !== code)

      const rec = result?.recommendations?.find(r => r.code === code) ||
                  result?.All_courses?.find(r => r.code === code)
      if (!rec) return prev

      const primarySec       = section?.subSections ? section.subSections[0] : section
      const newCourseCredits = rec.credits ?? primarySec?.max_units ?? 0
      const incomingSession  = (primarySec?.session || 'FAL').toUpperCase()
      const isSummer         = incomingSession.includes('SUM')
      const creditCap        = isSummer ? 7 : 20

      const seasonalTotalCredits = prev
        .filter(item => {
          const itemSec     = item.section?.subSections ? item.section.subSections[0] : item.section
          const itemSession = (itemSec?.session || 'FAL').toUpperCase()
          return isSummer ? itemSession.includes('SUM') : itemSession.includes('FAL')
        })
        .reduce((sum, item) => sum + (item.credits || 0), 0)

      if (seasonalTotalCredits + newCourseCredits > creditCap) {
        alert(`Cannot add course! Adding this brings your ${isSummer ? 'Summer' : 'Fall'} schedule to ${seasonalTotalCredits + newCourseCredits} credits, exceeding the ${creditCap} credit limit.`)
        return prev
      }

      const incomingMeetings = section?.subSections || [section].filter(Boolean)

      if (incomingMeetings.length > 0 && incomingMeetings[0]?.mtg_start) {
        const toMins = t => { const p = t.split(':'); return Number(p[0]) * 60 + Number(p[1]) }

        const hasConflict = prev.some(item => {
          const existingMeetings = item.section?.subSections || [item.section].filter(Boolean)
          return existingMeetings.some(exSub => {
            if (!exSub?.mtg_start || !exSub?.mtg_end) return false
            return incomingMeetings.some(inSub => {
              if (!inSub?.mtg_start || !inSub?.mtg_end) return false
              const inSession = (inSub.session || '').toUpperCase()
              const exSession = (exSub.session || '').toUpperCase()
              if (inSession !== exSession) return false
              const shareDay = (exSub.Mon && inSub.Mon) || (exSub.Tues && inSub.Tues) ||
                               (exSub.Wed && inSub.Wed) || (exSub.Thurs && inSub.Thurs) ||
                               (exSub.Fri && inSub.Fri)
              if (!shareDay) return false
              return toMins(inSub.mtg_start) < toMins(exSub.mtg_end) &&
                     toMins(exSub.mtg_start) < toMins(inSub.mtg_end)
            })
          })
        })

        if (hasConflict) {
          alert('Cannot add course! This section conflicts with a course already in your cart.')
          return prev
        }
      }

      const instructorName = primarySec
        ? `${primarySec.first_name ?? ''} ${primarySec.last_name ?? ''}`.trim()
        : 'TBA'

      return [...prev, {
        code,
        name:       rec.name,
        credits:    newCourseCredits,
        room:       primarySec?.room ?? 'TBA',
        instructor: instructorName || 'TBA',
        fromDb:     false, // Added natively via client UI selection session
        section,
      }]
    })
  }

  function handleLogout() {
    setResult(null); setStudentId(null)
    setSubmittedDbCodes(new Set())
    setCartItems([]); setPassFailCourses({}); setError(null)
    setShowChains(false); setShowCartPage(false)
    localStorage.removeItem('studentId')
  }

  if (!result) return <Login onLogin={handleLogin} loading={loading} error={error} />

  const { student, inProgress, completed, blockedSet,
          recommendations, chainDisplay, coReqEdges, prereqMap, All_courses } = result

  const blockedArray = [...(blockedSet || [])]

  const repeatableGpaTargets = (completed || []).filter(course => {
    if (!course.grade) return false
    return ['C+', 'C', 'C-', 'D+', 'D', 'F', 'FA'].includes(course.grade.toUpperCase().trim())
  })

  if (showChains) {
    return (
      <div className={s.shell}>
        <header className={s.topbar} style={{ padding: '20px 32px', minHeight: 72, gap: 24 }}>
          <div className={s.brand}>Prerequisite Chains (study plan)</div>
          <div className={s.studentName}>{student.name} — {student.major} - {student.cgpa}</div>
          <div style={{ marginLeft: 'auto' }} />
          <div className={s.viewToggleRadioGroup}>
            <label className={`${s.radioLabelOption} ${!showChains ? s.radioOptionActive : ''}`}>
              <input type="radio" name="viewToggleChains" className={s.hiddenRadioInput}
                checked={!showChains} onChange={() => setShowChains(false)} />
              Dashboard
            </label>
            <label className={`${s.radioLabelOption} ${showChains ? s.radioOptionActive : ''}`}>
              <input type="radio" name="viewToggleChains" className={s.hiddenRadioInput}
                checked={showChains} onChange={() => setShowChains(true)} />
              Study Plan
            </label>
          </div>
        </header>
        <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem 1.5rem 2rem' }}>
          <Chains
            chains={chainDisplay}
            coReqEdges={coReqEdges || []}
            blockedCodes={blockedArray}
            prereqEdges={prereqMap || []}
            completed={completed}
            inProgress={inProgress}
          />
        </div>
      </div>
    )
  }

  if (showCartPage) {
    return (
      <CartPage
        cartItems={cartItems}
        onRemove={code => handleToggleCart(code)}
        onBack={() => {
          setShowCartPage(false)
          if (studentId) fetchActiveDbSubmissions(studentId)
        }}
      />
    )
  }

  return (
    <div className={s.shell}>
      <header className={s.topbar} style={{ padding: '20px 32px', minHeight: 72, gap: 24 }}>
        <div className={s.brand}>Auto Academic Advisor</div>
        <div className={s.studentName}>{student.name}</div>

        <div className={s.viewToggleRadioGroup}>
          <label className={`${s.radioLabelOption} ${!showChains ? s.radioOptionActive : ''}`}>
            <input type="radio" name="viewToggleMain" className={s.hiddenRadioInput}
              checked={!showChains} onChange={() => setShowChains(false)} />
            Dashboard
          </label>
          <label className={`${s.radioLabelOption} ${showChains ? s.radioOptionActive : ''}`}>
            <input type="radio" name="viewToggleMain" className={s.hiddenRadioInput}
              checked={showChains} onChange={() => setShowChains(true)} />
            Study Plan
          </label>
        </div>

        <button
          className={`${s.cartBtn} ${cartItems.length > 0 ? s.cartBtnActive : ''}`}
          onClick={() => setShowCartPage(true)}
          style={{ marginLeft: 'auto' }}
        >
          🛒 {cartItems.length > 0 && <span className={s.cartBadge}>{cartItems.length}</span>}
        </button>

        <button onClick={handleLogout} className={s.logoutBtn}>Sign out</button>
      </header>

      <div className={s.stats}>
        {[
          { label: 'CGPA',      value: student.cgpa?.toFixed(2) ?? '—' },
          { label: 'Campus/S',  value: student.campus ?? '—', sub: student.major },
          { label: 'Completed', value: completed.length, sub: 'courses passed' },
          { label: 'Credits',   value: student.totalCreditsPassed,
            sub: `${student.requiredCredits - student.totalCreditsPassed} remaining` },
        ].map(({ label, value, sub }) => (
          <div key={label} className={s.stat}>
            <div className={s.statLabel}>{label}</div>
            <div className={s.statVal}>{value}</div>
            <div className={s.statSub}>{sub}</div>
          </div>
        ))}
      </div>

      {student.cgpa < 2 && (
        <div className={s.gpaAlertBanner}>
          <div onClick={() => setGpaPanelOpen(prev => !prev)} className={s.gpaAlertHeader}>
            <span className={s.gpaAlertTitle}>
              Academic Advisory Notice: CGPA is below 2 ({student.cgpa?.toFixed(2)})
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#c53030', background: '#f7fafc',
                padding: '2px 8px', borderRadius: 12, border: '1px solid #cbd5e0' }}>
                {repeatableGpaTargets.length} Course Targets Found
              </span>
              <strong style={{ color: '#9b2c2c', fontSize: 14 }}>
                {gpaPanelOpen ? '▲ Hide Plan' : '▼ View Repeatable Options'}
              </strong>
            </div>
          </div>

          {gpaPanelOpen && (
            <div style={{ padding: 20, background: '#fff', borderTop: '1px solid #edf2f7' }}>
              <p style={{ margin: '0 0 16px', fontSize: 14, color: '#4a5568', lineHeight: 1.5 }}>
                Your GPA is currently under <strong>2</strong>. It is highly recommended to repeat
                courses where you earned a <strong>C+ grade or lower</strong>. Repeating these classes
                allows you to override older grades, quickly boosting your overall CGPA.
              </p>
              {repeatableGpaTargets.length === 0 ? (
                <div style={{ fontSize: 13, color: '#718096', fontStyle: 'italic', padding: 8 }}>
                  No recorded courses match C or lower criteria.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #edf2f7', borderRadius: 6 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                        {['Course Code','Course Name','Earned Grade','Term Passed'].map(h => (
                          <th key={h} style={{ padding: '10px 14px', fontWeight: 700, color: '#4a5568',
                            textAlign: h === 'Earned Grade' ? 'center' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {repeatableGpaTargets.map((c, idx) => (
                        <tr key={c.code + idx}
                          style={{ borderBottom: '1px solid #edf2f7', background: idx % 2 === 0 ? '#fff' : '#fffafd' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 700, color: '#b7791f', fontFamily: 'monospace' }}>{c.code}</td>
                          <td style={{ padding: '10px 14px', color: '#2d3748' }}>{c.name || '—'}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <span style={{ fontWeight: 800, color: '#c53030', background: '#fee2e2',
                              padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>{c.grade}</span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#718096' }}>{c.term || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className={s.cols} style={{ gridTemplateColumns: '1.5fr 3.5fr' }}>
        <div className={s.sideCol} style={{ width: '100%' }}>
          <section className={s.section}>
            <div className={s.colHd} style={{ cursor: 'pointer' }} onClick={() => setCurrentOpen(o => !o)}>
              Current Sem: — Spring 2026
              <span className={s.hdCount}>{currentOpen ? '▲' : '▼'}</span>
            </div>
            {currentOpen && (
              <div className={s.colBody}>
                <CurrentCourses
                  courses={inProgress}
                  overrides={PassFailCourses}
                  onToggle={CurrentTakingCoursesSTATUS}
                />
              </div>
            )}
          </section>
        </div>

        <div className={s.mainCol}>
          <CourseBrowser
            recommendations={recommendations}
            blockedSet={blockedArray}
            cart={cartItems}
            onToggleCart={handleToggleCart}
            semester={nextSem}
            All_courses={All_courses}
            totalCartCredits={cartItems.reduce((sum, item) => sum + (item.credits || 0), 0)}
            submittedDbCodes={submittedDbCodes}
          />
        </div>
      </div>

      <AiChat
        student={student}
        inProgress={inProgress}
        completed={completed}
        recommendations={recommendations}
        prereqEdges={prereqMap}
      />
    </div>
  )
}