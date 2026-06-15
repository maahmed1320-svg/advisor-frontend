import { useMemo, useState } from 'react'
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
          blocks.push({ code: item.code, name: item.name, instructor: item.instructor, day, startM, endM, color, idx })
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
                return (
                  <div key={i} className={`${s.block} ${hasConflict ? s.blockConflict : ''}`}
                    style={{
                      top: `${top}%`, height: `${ht}%`,
                      background:  hasConflict ? '#fee2e2' : b.color.bg,
                      borderColor: hasConflict ? '#dc2626' : b.color.border,
                      color:       hasConflict ? '#7f1d1d' : b.color.text,
                    }}>
                    <div className={s.bCode}>{b.code}</div>
                    <div className={s.bName}>{b.name}</div>
                    {b.instructor && <div className={s.bInst}>{b.instructor.replace('Dr. ', '')}</div>}
                    {hasConflict && <div className={s.bConflictLabel}>⚠ conflict</div>}
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
  onBack
}) {

  const [activeTab,       setActiveTab]       = useState(null) 

  const falItems = cartItems.filter(i => (i.section?.session ?? '').toUpperCase().includes('FAL'))
  const sumItems = cartItems.filter(i => (i.section?.session ?? '').toUpperCase().includes('SUM'))

  const hasFal = falItems.length > 0
  const hasSum = sumItems.length > 0

  const resolvedTab = activeTab ?? (hasFal ? 'FAL' : hasSum ? 'SUM' : null)

  const falBlocks    = useMemo(() => buildBlocks(falItems),    [cartItems])
  const sumBlocks    = useMemo(() => buildBlocks(sumItems),    [cartItems])
  const falConflicts = useMemo(() => detectConflicts(falBlocks), [falBlocks])
  const sumConflicts = useMemo(() => detectConflicts(sumBlocks), [sumBlocks])
  const allConflicts = useMemo(() => new Set([...falConflicts, ...sumConflicts]), [falConflicts, sumConflicts])

  const hasConflicts = allConflicts.size > 0
  const totalCr       = cartItems.reduce((acc, c) => acc + (c.credits ?? 0), 0)

  const activeItems     = resolvedTab === 'FAL' ? falItems     : sumItems
  const activeBlocks    = resolvedTab === 'FAL' ? falBlocks    : sumBlocks
  const activeConflicts = resolvedTab === 'FAL' ? falConflicts : sumConflicts

  const activeTotalCr   = activeItems.reduce((acc, c) => acc + (c.credits ?? 0), 0)
  const maxCredits      = resolvedTab === 'SUM' ? 7 : 20

  const tabBase = {
    padding: '8px 24px', fontSize: 18, fontWeight: 600,
    border: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0',
    transition: 'background 0.15s, color 0.15s',
  }
  const tabActive   = { background: '#fff', color: '#1a3a6a', borderBottom: '2px solid #fff', boxShadow: '0 -2px 6px rgba(0,0,0,0.04)' }
  const tabInactive = { background: '#e8edf4', color: '#666', borderBottom: '2px solid transparent' }

  return (
    <div className={s.page}>

      {/* ── Top Bar ── */}
      <div className={s.topbar}>
        <button className={s.backBtn} onClick={onBack}>← Back</button>
        <span className={s.title}>My Saved Schedule Cart</span>
        <span className={s.subtitle}>
          {resolvedTab ? (
            `${activeItems.length} course${activeItems.length !== 1 ? 's' : ''} · ${activeTotalCr} / ${maxCredits} max credits`
          ) : (
            `0 courses · 0 / 20 max credits`
          )}
        </span>
        {hasConflicts && <span className={s.conflictPill}>⚠ Time conflict detected</span>}

        
      </div>

      {/* ── Base Workspace Box ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', background: '#fcfcfb' }}>
        
        {cartItems.length === 0 ? (
          <div className={s.empty} style={{ width: '100%', textAlign: 'center', paddingTop: '100px' }}>
            Your advising cart is currently empty.<br />Return to look over your major requirements checklist.
          </div>
        ) : (
          <>
            {/* LEFT SIDE COLUMN PANEL */}
            <div style={{ flex: '0 0 30%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0', background: '#fff', padding: '20px', boxSizing: 'border-box', overflowY: 'auto' }}>
              
              {/* Dynamic Tabs Block */}
              {(hasFal && hasSum) && (
                <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #ddd', marginBottom: '16px' }}>
                  <button style={{ ...tabBase, ...(resolvedTab === 'FAL' ? tabActive : tabInactive) }}
                    onClick={() => setActiveTab('FAL')}>
                     Fall ({falItems.length})
                  </button>
                  <button style={{ ...tabBase, ...(resolvedTab === 'SUM' ? tabActive : tabInactive) }}
                    onClick={() => setActiveTab('SUM')}>
                     Summer ({sumItems.length})
                  </button>
                </div>
              )}

              {/* Static Header Fallback */}
              {!(hasFal && hasSum) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '16px' }}>
                  <div style={{ width: 4, height: 18, borderRadius: 2, background: resolvedTab === 'FAL' ? '#2a6aaa' : '#aa7a2a' }} />
                  <span style={{ fontWeight: 700, fontSize: '15px', color: '#333' }}>
                    {resolvedTab === 'FAL' ? '🍂 Fall Semester Courses' : '☀️ Summer Semester Courses'}
                  </span>
                </div>
              )}

              {/* Course Detail List Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeItems.map((item, idx) => {
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
                    <div key={item.code} className={`${s.item} ${isConflict ? s.itemConflict : ''}`} style={{ display: 'flex', width: '100%', border: '1px solid #e2e8f0', borderRadius: '6px', overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                      <div style={{ width: '5px', flexShrink: 0, background: isConflict ? '#dc2626' : color.border }} />
                      <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong style={{ fontSize: '25px', color: '#1a3a6a', fontFamily: 'monospace' }}>{item.code}</strong>
                            <span style={{ fontSize: '11px', background: '#f7fafc', border: '1px solid #e2e8f0', padding: '1px 5px', borderRadius: '4px', color: '#4a5568' }}>{item.credits} cr</span>
                            {isConflict && <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', background: '#fee2e2', padding: '1px 6px', borderRadius: '4px' }}>⚠ conflict</span>}
                          </div>
                          
                          {/* Just render the button cleanly without the old condition */}
                          <button className={s.removeBtn} onClick={() => onRemove(item.code)} style={{ color: '#e53e3e', background: 'none', border: '1px solid #fed7d7', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '500' }}>
                            Remove
                          </button>
                        </div>
                        <div style={{ fontSize: '13px', fontWeight: '600', color: '#2d3748', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                        {sec && (
                          <div style={{ fontSize: '12px', color: '#718096', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                            <div>
                              <span style={{ background: '#ebf8ff', color: '#2b6cb0', padding: '1px 4px', borderRadius: '3px', fontSize: '10px', fontWeight: '700', marginRight: '6px' }}>ID: {sec.section || '101'}</span>
                              <span>Class Nbr: <strong>{sec.class_nbr}</strong></span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#4a5568' }}>
                              🗓️ {daysArr.length > 0 ? daysArr.join(' ') : 'TBA'} ({sec.mtg_start?.slice(0,5)} - {sec.mtg_end?.slice(0,5)})
                            </div>
                            <div style={{ fontSize: '11px', color: '#718096' }}>
                              📍 Campus: {sec.campus || 'AD'} {sec.room && `· Rm: ${sec.room}`}
                            </div>
                          </div>
                        )}
                        {item.instructor && <div style={{ fontSize: '12px', color: '#4a5568', marginTop: '1px', borderTop: '1px solid #edf2f7', paddingTop: '2px' }}>Instructor: <em>{item.instructor}</em></div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* RIGHT SIDE COLUMN PANEL */}
            <div style={{ flex: '0 0 70%', display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box', overflow: 'hidden' }}>
              <div style={{ marginBottom: '10px', fontWeight: '700', fontSize: '12px', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {resolvedTab === 'FAL' ? '🍂 Fall Session' : '☀️ Summer Session'} — Weekly Calendar Preview
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <ScheduleGrid blocks={activeBlocks} conflicts={activeConflicts} />
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}