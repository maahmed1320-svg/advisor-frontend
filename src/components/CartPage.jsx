import { useMemo, useState, useEffect } from 'react'
import s from './CartPage.module.css'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const START_H = 9
const END_H   = 22
const HOURS   = END_H - START_H   
const TOTAL_M = HOURS * 60         

const PALETTE = [
  { bg: '#dce8f5', border: '#2a6aaa', text: '#0a2a5a' },
  { bg: '#d5ecd8', border: '#2a7a3a', text: '#0a2a0a' },
  { bg: '#f5ebd5', border: '#aa7a2a', text: '#4a2a00' },
  { bg: '#ecd5ec', border: '#7a2a8a', text: '#2a002a' },
  { bg: '#d5ece8', border: '#2a8a7a', text: '#002a28' },
  { bg: '#f5d5d5', border: '#aa2a2a', text: '#4a0000' },
  { bg: '#e8f0d5', border: '#5a8a2a', text: '#1a3a00' },
]

function toMins(timeStr) {
  if (!timeStr || timeStr === 'TBA') return null
  const parts = timeStr.trim().split(':')
  if (parts.length < 2) return null
  const h = Number(parts[0])
  const m = Number(parts[1])
  return isNaN(h) ? null : h * 60 + m
}

function hourLabel(h) {
  if (h === 12) return '12pm'
  return h > 12 ? `${h - 12}pm` : `${h}am`
}

function buildBlocks(cartItems) {
  const blocks = []
  cartItems.forEach((item, idx) => {
    const color = PALETTE[idx % PALETTE.length]
    const sec = item.section
    if (sec && sec.mtg_start && sec.mtg_end) {
      const daysField = []
      if (sec.Mon)   daysField.push('Mon')
      if (sec.Tues)  daysField.push('Tue')
      if (sec.Wed)   daysField.push('Wed')
      if (sec.Thurs) daysField.push('Thu')
      if (sec.Fri)   daysField.push('Fri')
      const startM = toMins(sec.mtg_start)
      const endM   = toMins(sec.mtg_end)
      if (daysField.length && startM && endM) {
        daysField.forEach(day => {
          blocks.push({ 
            code: item.code, 
            name: item.name, 
            instructor: item.instructor, 
            day, 
            startM, 
            endM, 
            color, 
            idx,
            fromDb: item.fromDb 
          })
        })
      }
    }
  })
  return blocks
}

function detectConflicts(blocks) {
  const conflicts = new Set()
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const a = blocks[i], b = blocks[j]
      if (a.day === b.day && a.idx !== b.idx) {
        if (a.startM < b.endM && b.startM < a.endM) {
          conflicts.add(a.code)
          conflicts.add(b.code)
        }
      }
    }
  }
  return conflicts
}

function ScheduleGrid({ blocks, conflicts }) {
  const hours = Array.from({ length: HOURS + 1 }, (_, i) => START_H + i)
  return (
    <div className={s.grid}>
      <div className={s.gutter}>
        <div className={s.gutterTop} />
        {hours.map(h => (
          <div key={h} className={s.gutterCell}>
            <span className={s.timeText}>{hourLabel(h)}</span>
          </div>
        ))}
      </div>
      {DAYS.map(day => {
        const dayBlocks = blocks.filter(b => b.day === day)
        return (
          <div key={day} className={s.dayCol}>
            <div className={s.dayHd}>{day.toUpperCase()}</div>
            <div className={s.dayBody}>
              {hours.map((h, i) => (
                <div key={h} className={s.hourRow} style={{ height: `${100 / HOURS}%` }}>
                  {i > 0 && <div className={s.hourLine} />}
                  {i < HOURS && <div className={s.halfLine} />}
                </div>
              ))}
              {dayBlocks.map((b, i) => {
                const top = ((b.startM - START_H * 60) / TOTAL_M * 100).toFixed(4)
                const ht  = ((b.endM - b.startM) / TOTAL_M * 100).toFixed(4)
                const hasConflict = conflicts.has(b.code)
                
                let blockBackground = b.color.bg;
                let blockBorderColor = b.color.border;
                let blockTextColor = b.color.text;

                if (hasConflict) {
                  blockBackground = '#fee2e2';
                  blockBorderColor = '#dc2626';
                  blockTextColor = '#7f1d1d';
                } else if (b.fromDb) {
                  blockBackground = '#e2e8f0';
                  blockBorderColor = '#94a3b8';
                  blockTextColor = '#475569';
                }

                return (
                  <div key={i} className={`${s.block} ${hasConflict ? s.blockConflict : ''}`}
                    style={{
                      top: `${top}%`, 
                      height: `${ht}%`,
                      '--block-bg': blockBackground,
                      '--block-border': blockBorderColor,
                      '--block-text': blockTextColor
                    }}
                  >
                    <div className={s.bCode}>{b.code}</div>
                    <div className={s.bName}>{b.name}</div>
                    {b.instructor && <div className={s.bInst}>{b.instructor.replace('Dr. ', '')}</div>}
                    {b.fromDb && <div className={s.bEnrolledLabel}>Enrolled</div>}
                    {hasConflict && <div className={s.bConflictLabel}>conflict</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function CartPage({
  cartItems = [],
  onRemove,
  onBack,
  onRefreshSubmissions
}) {
  const studentId = localStorage.getItem('studentId')

  const [localCart, setLocalCart] = useState(cartItems)
  const [activeTab, setActiveTab] = useState(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

  useEffect(() => {
    setLocalCart(cartItems)
  }, [cartItems])

  const falItems = localCart.filter(i => (i.section?.session ?? '').toUpperCase().includes('FAL'))
  const sumItems = localCart.filter(i => (i.section?.session ?? '').toUpperCase().includes('SUM'))

  const hasFal = falItems.length > 0
  const hasSum = sumItems.length > 0

  const resolvedTab = activeTab ?? (hasFal ? 'FAL' : hasSum ? 'SUM' : null)

  const falBlocks    = useMemo(() => buildBlocks(falItems),    [localCart])
  const sumBlocks    = useMemo(() => buildBlocks(sumItems),    [localCart])
  const falConflicts = useMemo(() => detectConflicts(falBlocks), [falBlocks])
  const sumConflicts = useMemo(() => detectConflicts(sumBlocks), [sumBlocks])
  const allConflicts = useMemo(() => new Set([...falConflicts, ...sumConflicts]), [falConflicts, sumConflicts])

  const hasConflicts = allConflicts.size > 0

  const activeItems     = resolvedTab === 'FAL' ? falItems     : sumItems
  const activeBlocks    = resolvedTab === 'FAL' ? falBlocks    : sumBlocks
  const activeConflicts = resolvedTab === 'FAL' ? falConflicts : sumConflicts

  const activeTotalCr   = activeItems.reduce((acc, c) => acc + (c.credits ?? 0), 0)
  const maxCredits      = resolvedTab === 'SUM' ? 7 : 20
  const activeTabHasConflicts = activeConflicts.size > 0

  const activeDrafts = useMemo(() => activeItems.filter(i => !i.fromDb), [activeItems])
  const activeEnrolled = useMemo(() => activeItems.filter(i => i.fromDb), [activeItems])

  async function handleSubmit() {
    if (activeDrafts.length === 0) return
    setSubmitLoading(true)
    setSubmitError(null)

    try {
      const res = await fetch(`${BASE}/api/student/${studentId}/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courses: activeDrafts.map(item => ({
            code: item.code,
            session: item.section?.session,
            class_nbr: item.section?.class_nbr 
          }))
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || "Submission request rejected by server.")
      }

      setLocalCart(prev => prev.map(item => {
        const isCurrentSemesterTab = (item.section?.session ?? '').toUpperCase().includes(resolvedTab);
        if (!item.fromDb && isCurrentSemesterTab) {
          return { ...item, fromDb: true }
        }
        return item
      }))

      if (onRefreshSubmissions) {
        await onRefreshSubmissions(studentId)
      }

      window.location.reload()
    } catch (e) {
      setSubmitError(e.message)
    } finally {
      setSubmitLoading(false)
    }
  }

  async function handleWithdraw() {
    if (activeEnrolled.length === 0) return
    setWithdrawLoading(true)
    setSubmitError(null)

    try {
      const res = await fetch(`${BASE}/api/student/${studentId}/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes: activeEnrolled.map(i => i.code) })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || "Withdrawal request rejected by server.")
      }

      setLocalCart(prev => prev.filter(item => {
        const isCurrentSemesterTab = (item.section?.session ?? '').toUpperCase().includes(resolvedTab);
        return !(item.fromDb && isCurrentSemesterTab);
      }))

      activeEnrolled.forEach(item => onRemove(item.code))
      
      if (onRefreshSubmissions) {
        await onRefreshSubmissions(studentId)
      }

      window.location.reload()
    } catch (e) {
      setSubmitError(e.message)
    } finally {
      setWithdrawLoading(false)
    }
  }

  return (
    <div className={s.page}>

      {/* ── Top Bar ── */}
      <div className={s.topbar}>
        <button className={s.backBtn} onClick={onBack}>Back</button>
        <span className={s.title}>My Saved Schedule Cart</span>
        <span className={s.subtitle}>
          {resolvedTab ? (
            `${activeItems.length} courses · ${activeTotalCr} / ${maxCredits} max credits`
          ) : (
            `0 courses · 0 / 20 max credits`
          )}
        </span>
        {hasConflicts && <span className={s.conflictPill}>Time conflict detected</span>}

        <div className={s.diagnosticBox}>
          <div><strong>ID Value:</strong> {studentId === undefined ? 'undefined' : studentId === null ? 'null' : `"${studentId}"`}</div>
          <div><strong>ID Type:</strong> {typeof studentId}</div>
        </div>

        <div className={s.topbarActionWrap}>
          {submitError && <span className={s.submitErrorLabel}>{submitError}</span>}
          
          <button 
            onClick={handleSubmit}
            disabled={activeDrafts.length === 0 || submitLoading || activeTabHasConflicts}
            className={s.submitScheduleBtn}
          >
            {submitLoading ? 'Submitting...' : `Submit New Changes (${activeDrafts.length})`}
          </button>

          <button 
            onClick={handleWithdraw}
            disabled={activeEnrolled.length === 0 || withdrawLoading}
            className={s.withdrawBtn}
          >
            {withdrawLoading ? 'Withdrawing...' : `Withdraw Enrolled (${activeEnrolled.length})`}
          </button>
        </div>
      </div>

      {/* ── Base Workspace Box ── */}
      <div className={s.workspaceContainer}>
        
        {localCart.length === 0 ? (
          <div className={s.emptyCartMessage}>
            Your advising cart is currently empty.<br />Return to look over your major requirements checklist.
          </div>
        ) : (
          <>
            {/* LEFT SIDE COLUMN PANEL */}
            <div className={s.sidebarLayoutColumn}>
              
              {/* Dynamic Tabs Block */}
              {(hasFal && hasSum) && (
                <div className={s.tabsHeaderWrapper}>
                  <button className={`${s.tabSelectorButton} ${resolvedTab === 'FAL' ? s.tabStateActive : s.tabStateInactive}`}
                    onClick={() => setActiveTab('FAL')}>
                     Fall ({falItems.length})
                  </button>
                  <button className={`${s.tabSelectorButton} ${resolvedTab === 'SUM' ? s.tabStateActive : s.tabStateInactive}`}
                    onClick={() => setActiveTab('SUM')}>
                     Summer ({sumItems.length})
                  </button>
                </div>
              )}

              {/* Static Header Fallback */}
              {!(hasFal && hasSum) && (
                <div className={s.staticFallbackHeaderRow}>
                  <div className={`${s.fallbackIndicatorBadge} ${resolvedTab === 'FAL' ? s.badgeFallColor : s.badgeSummerColor}`} />
                  <span className={s.staticHeaderLabelText}>
                    {resolvedTab === 'FAL' ? 'Fall Semester Courses' : 'Summer Semester Courses'}
                  </span>
                </div>
              )}

              {/* Course Detail List Section */}
              <div className={s.cardsStackContainer}>
                {activeItems.map((item, idx) => {
                  const isDbItem = !!item.fromDb
                  const color      = PALETTE[idx % PALETTE.length]
                  const isConflict = activeConflicts.has(item.code)
                  const sec        = item.section
                  const daysArr    = []
                  if (sec?.Mon)   daysArr.push('Mon')
                  if (sec?.Tues)  daysArr.push('Tues')
                  if (sec?.Wed)   daysArr.push('Wed')
                  if (sec?.Thurs) daysArr.push('Thurs')
                  if (sec?.Fri)   daysArr.push('Fri')
                  
                  return (
                    <div key={item.code} className={`${s.itemCardWrapper} ${isConflict ? s.itemConflictBorder : ''}`} 
                      style={{ opacity: isDbItem ? 0.65 : 1 }}
                    >
                      <div className={s.cardColorGutterBar} style={{ '--gutter-bg-color': isConflict ? '#dc2626' : (isDbItem ? '#94a3b8' : color.border) }} />
                      <div className={s.cardContentBodyContainer}>
                        <div className={s.cardTopFlexRow}>
                          <div className={s.cardHeadingMetaGroup}>
                            <strong className={s.cardCourseCodeText}>{item.code}</strong>
                            <span className={s.cardCreditsPillBadge}>{item.credits} cr</span>
                            {isConflict && <span className={s.cardConflictPillBadge}>conflict</span>}
                          </div>
                          
                          {isDbItem ? (
                            <span className={s.cardEnrolledStatusBadge}>
                              Enrolled
                            </span>
                          ) : (
                            <button className={s.cardRemoveActionBtn} onClick={() => onRemove(item.code)}>
                              Remove
                            </button>
                          )}
                        </div>
                        <div className={s.cardCourseTitleLabel}>{item.name}</div>
                        {sec && (
                          <div className={s.cardSectionDetailsMetadataBox}>
                            <div>
                              <span className={isDbItem ? s.cardSectionIdPillEnrolled : s.cardSectionIdPill}>ID: {sec.section || '101'}</span>
                              <span>Class Nbr: <strong>{sec.class_nbr}</strong></span>
                            </div>
                            <div className={s.cardMeetingScheduleDateTimeString}>
                              Schedule: {daysArr.length > 0 ? daysArr.join(' ') : 'TBA'} ({sec.mtg_start?.slice(0,5)} - {sec.mtg_end?.slice(0,5)})
                            </div>
                            <div className={s.cardLocationCampusRoomString}>
                              Location: Campus: {sec.campus || 'AD'} {sec.room && `· Rm: ${sec.room}`}
                            </div>
                          </div>
                        )}
                        {item.instructor && <div className={s.cardInstructorFieldText}>Instructor: <em>{item.instructor}</em></div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* RIGHT SIDE COLUMN PANEL */}
            <div className={s.calendarLayoutColumn}>
              <div className={s.calendarPreviewTitleLabel}>
                {resolvedTab === 'FAL' ? 'Fall Session' : 'Summer Session'} — Weekly Calendar Preview
              </div>
              
              <div className={s.calendarScrollCanvasContainer}>
                <ScheduleGrid blocks={activeBlocks} conflicts={activeConflicts} />
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}