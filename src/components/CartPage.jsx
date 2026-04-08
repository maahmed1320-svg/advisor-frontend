import { useState, useMemo } from 'react'
import { submitCart } from '../api.js'
import s from './CartPage.module.css'

const DAY_MAP    = { Mo:0, Tu:1, We:2, Th:3, Fr:4 }
const DAY_LABELS = ['MON','TUE','WED','THU','FRI']
const START_H    = 9
const END_H      = 22
const HOURS      = END_H - START_H        // 13
const TOTAL_M    = HOURS * 60             // 780

const PALETTE = [
  { bg:'#dce8f5', border:'#2a6aaa', text:'#0a2a5a' },
  { bg:'#d5ecd8', border:'#2a7a3a', text:'#0a2a0a' },
  { bg:'#f5ebd5', border:'#aa7a2a', text:'#4a2a00' },
  { bg:'#ecd5ec', border:'#7a2a8a', text:'#2a002a' },
  { bg:'#d5ece8', border:'#2a8a7a', text:'#002a28' },
  { bg:'#f5d5d5', border:'#aa2a2a', text:'#4a0000' },
  { bg:'#e8f0d5', border:'#5a8a2a', text:'#1a3a00' },
]

function toMins(t) {
  if (!t || t === 'TBA') return null
  const clean = t.trim()
  const parts = clean.split(/\s*-\s*(?=\d)/)
  if (parts.length < 2) return null
  const [h, m] = parts[0].split(':').map(Number)
  return isNaN(h) ? null : h * 60 + (m || 0)
}

function toEndMins(t) {
  if (!t || t === 'TBA') return null
  const clean = t.trim()
  const parts = clean.split(/\s*-\s*(?=\d)/)
  if (parts.length < 2) return null
  const [h, m] = parts[1].split(':').map(Number)
  return isNaN(h) ? null : h * 60 + (m || 0)
}

function parseDays(days) {
  if (!days || days === 'TBA') return []
  const out = []; let i = 0
  while (i < days.length) {
    const two = days.slice(i, i + 2)
    if (DAY_MAP[two] !== undefined) { out.push(DAY_MAP[two]); i += 2 } else i++
  }
  return out
}

function hourLabel(h) {
  if (h === 12) return '12pm'
  return h > 12 ? `${h - 12}pm` : `${h}am`
}

// Build blocks from cart items
function buildBlocks(cartItems) {
  const blocks = []
  cartItems.forEach((item, idx) => {
    const color = PALETTE[idx % PALETTE.length]
    const slots = []

    if (item.section) {
      if (item.section.days && item.section.days !== 'TBA' && item.section.time_slot)
        slots.push({ days: item.section.days, time: item.section.time_slot })
      if (item.section.days2 && item.section.days2 !== 'TBA' && item.section.time_slot2)
        slots.push({ days: item.section.days2, time: item.section.time_slot2 })
    }

    slots.forEach(slot => {
      const dayNums = parseDays(slot.days)
      const startM  = toMins(slot.time)
      const endM    = toEndMins(slot.time)
      if (!dayNums.length || !startM || !endM) return
      dayNums.forEach(day => {
        blocks.push({ code: item.code, name: item.name, day, startM, endM, color, idx })
      })
    })
  })
  return blocks
}

// Detect conflicts: blocks on same day that overlap
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

function ScheduleGrid({ cartItems }) {
  const blocks    = useMemo(() => buildBlocks(cartItems), [cartItems])
  const conflicts = useMemo(() => detectConflicts(blocks), [blocks])
  const hours     = Array.from({ length: HOURS + 1 }, (_, i) => START_H + i)

  return (
    <div className={s.grid}>
      {/* Time gutter */}
      <div className={s.gutter}>
        <div className={s.gutterTop} />
        {hours.map(h => (
          <div key={h} className={s.gutterCell}>{hourLabel(h)}</div>
        ))}
      </div>

      {/* Day columns */}
      {DAY_LABELS.map((label, di) => {
        const dayBlocks = blocks.filter(b => b.day === di)
        return (
          <div key={label} className={s.dayCol}>
            <div className={s.dayHd}>{label}</div>
            <div className={s.dayBody}>
              {/* Hour lines */}
              {hours.map((h, i) => (
                <div key={h} className={s.hourLine}
                  style={{ top: `${(i / HOURS * 100).toFixed(4)}%` }} />
              ))}
              {/* Half-hour dashed lines */}
              {hours.slice(0, -1).map((h, i) => (
                <div key={`h${h}`} className={s.halfLine}
                  style={{ top: `${((i + 0.5) / HOURS * 100).toFixed(4)}%` }} />
              ))}
              {/* Course blocks */}
              {dayBlocks.map((b, i) => {
                const top = ((b.startM - START_H * 60) / TOTAL_M * 100).toFixed(4)
                const ht  = ((b.endM - b.startM) / TOTAL_M * 100).toFixed(4)
                const hasConflict = conflicts.has(b.code)
                return (
                  <div key={i} className={`${s.block} ${hasConflict ? s.blockConflict : ''}`}
                    style={{
                      top: `${top}%`,
                      height: `${ht}%`,
                      background: hasConflict ? '#fee2e2' : b.color.bg,
                      borderColor: hasConflict ? '#dc2626' : b.color.border,
                      color: hasConflict ? '#7f1d1d' : b.color.text,
                    }}>
                    <div className={s.bCode}>{b.code}</div>
                    <div className={s.bName}>{b.name}</div>
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

export default function CartPage({ studentId, cartItems, onRemove, onBack, onSubmitted }) {
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const blocks    = useMemo(() => buildBlocks(cartItems), [cartItems])
  const conflicts = useMemo(() => detectConflicts(blocks), [blocks])
  const hasConflicts = conflicts.size > 0
  const totalCr = cartItems.reduce((acc, c) => acc + (c.credits ?? 3), 0)

  async function handleSubmit() {
    if (hasConflicts) {
      setSubmitError(`Time conflict detected between: ${[...conflicts].join(', ')}. Please remove one of the conflicting courses before submitting.`)
      return
    }
    if (!cartItems.length) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await submitCart(studentId, cartItems.map(c => c.code), 'Fall 2026')
      setSubmitted(true)
      setTimeout(() => { setSubmitted(false); onSubmitted() }, 2000)
    } catch (e) { setSubmitError('Submission failed. Please try again.') }
    finally { setSubmitting(false) }
  }

  return (
    <div className={s.page}>

      {/* Top bar */}
      <div className={s.topbar}>
        <button className={s.backBtn} onClick={onBack}>← Back</button>
        <span className={s.title}>My Cart</span>
        <span className={s.subtitle}>{cartItems.length} course{cartItems.length !== 1 ? 's' : ''} · {totalCr} credits</span>
        {hasConflicts && (
          <span className={s.conflictPill}>⚠ Time conflict</span>
        )}
        <div style={{ marginLeft:'auto' }}>
          <button
            className={`${s.submitBtn} ${hasConflicts ? s.submitBtnDisabled : ''}`}
            onClick={handleSubmit}
            disabled={submitting || submitted || !cartItems.length}
          >
            {submitted ? '✓ Submitted' : submitting ? 'Submitting…' : 'Submit to registrar →'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {submitError && (
        <div className={s.errorBanner}>{submitError}</div>
      )}

      <div className={s.body}>

        {/* Left — course list */}
        <div className={s.listCol}>
          {cartItems.length === 0 && (
            <div className={s.empty}>Your cart is empty.<br/>Go back and add courses.</div>
          )}
          {cartItems.map((item, idx) => {
            const color = PALETTE[idx % PALETTE.length]
            const isConflict = conflicts.has(item.code)
            return (
              <div key={item.code} className={`${s.item} ${isConflict ? s.itemConflict : ''}`}>
                <div className={s.colorBar}
                  style={{ background: isConflict ? '#dc2626' : color.border }} />
                <div className={s.itemBody}>
                  <div className={s.itemTop}>
                    <span className={s.itemCode}>{item.code}</span>
                    <span className={s.itemCr}>{item.credits} cr</span>
                    {isConflict && <span className={s.conflictTag}>⚠ conflict</span>}
                    <button className={s.removeBtn} onClick={() => onRemove(item.code)}>Remove</button>
                  </div>
                  <div className={s.itemName}>{item.name}</div>
                  {item.section && (
                    <div className={s.itemSec}>
                      <span className={s.secBadge}>{item.section.section_number}</span>
                      {item.section.days && item.section.days !== 'TBA' && (
                        <span>{item.section.days} · {item.section.time_slot}</span>
                      )}
                      {item.section.room && item.section.room !== 'TBA' && (
                        <span>· {item.section.room}</span>
                      )}
                    </div>
                  )}
                  {item.section?.instructor && (
                    <div className={s.itemInst}>{item.section.instructor}</div>
                  )}
                  {item.section?.days2 && item.section.days2 !== 'TBA' && (
                    <div className={s.itemSec} style={{marginTop:2}}>
                      <span className={s.secBadge}>+</span>
                      <span>{item.section.days2} · {item.section.time_slot2}</span>
                      {item.section.room2 && <span>· {item.section.room2}</span>}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Right — schedule grid */}
        <div className={s.gridCol}>
          <div className={s.gridTitle}>Weekly Schedule</div>
          <div className={s.gridWrap}>
            <ScheduleGrid cartItems={cartItems} />
          </div>
          {cartItems.length === 0 && (
            <p className={s.gridEmpty}>Add courses to see your schedule.</p>
          )}
        </div>

      </div>
    </div>
  )
}
