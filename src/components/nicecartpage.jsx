import { useMemo } from 'react'
import s from './CartPage.module.css'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const DAY_MAP = { Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu', Fri: 'Fri' }
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
      if (sec.Mon) daysField.push('Mon');
      if (sec.Tues) daysField.push('Tue');
      if (sec.Wed) daysField.push('Wed');
      if (sec.Thurs) daysField.push('Thu');
      if (sec.Fri) daysField.push('Fri');

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
            idx
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
      {/* Time Gutter column labels */}
      <div className={s.gutter}>
        <div className={s.gutterTop} />
        {hours.map(h => (
          <div key={h} className={s.gutterCell}>
            <span className={s.timeText}>{hourLabel(h)}</span>
          </div>
        ))}
      </div>

      {/* Week Day Columns */}
      {DAYS.map(day => {
        const dayBlocks = blocks.filter(b => b.day === day)
        return (
          <div key={day} className={s.dayCol}>
            <div className={s.dayHd}>{day.toUpperCase()}</div>
            <div className={s.dayBody}>
              
              {/* Aligned Hour Rows */}
              {hours.map((h, i) => (
                <div key={h} className={s.hourRow} style={{ height: `${100 / HOURS}%` }}>
                  {/* 💡 Only render lines if it is not the very first boundary top line */}
                  {i > 0 && <div className={s.hourLine} />}
                  {i < HOURS && <div className={s.halfLine} />}
                </div>
              ))}

              {/* Absolute Positioned Event Blocks */}
              {dayBlocks.map((b, i) => {
                const top = ((b.startM - START_H * 60) / TOTAL_M * 100).toFixed(4)
                const ht  = ((b.endM - b.startM) / TOTAL_M * 100).toFixed(4)
                const hasConflict = conflicts.has(b.code)
                return (
                  <div key={i} className={`${s.block} ${hasConflict ? s.blockConflict : ''}`}
                    style={{
                      top: `${top}%`,
                      height: `${ht}%`,
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

export default function CartPage({ cartItems = [], onRemove, onBack }) {
  const blocks       = useMemo(() => buildBlocks(cartItems), [cartItems])
  const conflicts    = useMemo(() => detectConflicts(blocks), [blocks])
  const hasConflicts = conflicts.size > 0
  const totalCr      = cartItems.reduce((acc, c) => acc + (c.credits ?? 0), 0)

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <button className={s.backBtn} onClick={onBack}>← Back</button>
        <span className={s.title}>My Saved Schedule Cart</span>
        <span className={s.subtitle}>
          {cartItems.length} course{cartItems.length !== 1 ? 's' : ''} · {totalCr} / 20 max credits
        </span>
        {hasConflicts && <span className={s.conflictPill}>⚠ Time conflict detected</span>}
      </div>

      <div className={s.body}>
        <div className={s.listCol}>
          {cartItems.length === 0 && (
            <div className={s.empty}>Your advising cart is currently empty.<br />Return back to look over your major requirements checklist.</div>
          )}
          {cartItems.map((item, idx) => {
            const color      = PALETTE[idx % PALETTE.length]
            const isConflict = conflicts.has(item.code)
            const sec        = item.section

            const daysArr = [];
            if (sec?.Mon) daysArr.push('Mon');
            if (sec?.Tues) daysArr.push('Tues');
            if (sec?.Wed) daysArr.push('Wed');
            if (sec?.Thurs) daysArr.push('Thurs');
            if (sec?.Fri) daysArr.push('Fri');

            return (
              <div key={item.code} className={`${s.item} ${isConflict ? s.itemConflict : ''}`}>
                <div className={s.colorBar} style={{ background: isConflict ? '#dc2626' : color.border }} />
                <div className={s.itemBody}>
                  <div className={s.itemTop}>
                    <span className={s.itemCode}>{item.code}</span>
                    <span className={s.itemCr}>{item.credits} cr</span>
                    {isConflict && <span className={s.conflictTag}>⚠ conflict</span>}
                    <button className={s.removeBtn} onClick={() => onRemove(item.code)}>Remove</button>
                  </div>
                  <div className={s.itemName}>{item.name}</div>
                  
                  {sec && (
                    <div className={s.itemSec}>
                      <span className={s.secBadge}>ID: {sec.section || '101'}</span>
                      <span>Class Nbr: {sec.class_nbr}</span>
                      {daysArr.length > 0 && (
                        <span> · {daysArr.join(' ')} ({sec.mtg_start?.slice(0, 5)} - {sec.mtg_end?.slice(0, 5)})</span>
                      )}
                      {sec.room && <span> · Rm: {sec.room}</span>}
                      {sec.campus && <span> · Campus: {sec.campus}</span>}
                    </div>
                  )}
                  {item.instructor && <div className={s.itemInst}>Instructor: {item.instructor}</div>}
                </div>
              </div>
            )
          })}
        </div>

        <div className={s.gridCol}>
          <div className={s.gridTitle}>Weekly Calendar Preview</div>
          <div className={s.gridWrap}>
            <ScheduleGrid blocks={blocks} conflicts={conflicts} />
          </div>
        </div>
      </div>
    </div>
  )
}