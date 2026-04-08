import { useState, useMemo } from 'react'
import { submitCart } from '../api.js'
import s from './Cart.module.css'

const DAY_MAP  = { Mo:0, Tu:1, We:2, Th:3, Fr:4 }
const DAY_LABELS = ['MON','TUE','WED','THU','FRI']
const START_H  = 9
const END_H    = 22
const TOTAL_M  = (END_H - START_H) * 60

const PALETTE = [
  '#dce8f5','#d5ecd8','#f5ebd5','#ecd5ec','#d5ecec','#f5d5d5','#e8f0d5',
]

function toMins(t) {
  if (!t || t === 'TBA') return null
  const [h, m] = t.trim().split(':').map(Number)
  return h * 60 + m
}

function parseDays(days) {
  if (!days || days === 'TBA') return []
  const out = []
  let i = 0
  while (i < days.length) {
    const two = days.slice(i, i+2)
    if (DAY_MAP[two] !== undefined) { out.push(DAY_MAP[two]); i += 2 }
    else i++
  }
  return out
}

function hourLabel(h) {
  if (h === 12) return '12pm'
  if (h > 12) return `${h-12}pm`
  return `${h}am`
}

function ScheduleGrid({ cartItems }) {
  const blocks = useMemo(() => {
    const result = []
    cartItems.forEach((item, idx) => {
      const slots = []
      if (item.section) {
        slots.push({ days: item.section.days, time: item.section.time_slot })
        if (item.section.days2 && item.section.time_slot2 && item.section.days2 !== 'TBA') {
          slots.push({ days: item.section.days2, time: item.section.time_slot2 })
        }
      } else if (item.days) {
        slots.push({ days: item.days, time: item.timeSlot })
      }

      slots.forEach(slot => {
        const dayNums = parseDays(slot.days)
        if (!dayNums.length) return
        const parts = (slot.time || '').split(' - ')
        if (parts.length < 2) return
        const startM = toMins(parts[0])
        const endM   = toMins(parts[1])
        if (!startM || !endM) return
        dayNums.forEach(day => {
          result.push({ code: item.code, name: item.name, day, startM, endM, color: PALETTE[idx % PALETTE.length] })
        })
      })
    })
    return result
  }, [cartItems])

  const hours = []
  for (let h = START_H; h <= END_H; h++) hours.push(h)

  return (
    <div className={s.grid}>
      {/* Time gutter */}
      <div className={s.gutter}>
        <div className={s.gutterTop} />
        {hours.map(h => <div key={h} className={s.gutterCell}>{hourLabel(h)}</div>)}
      </div>
      {/* Day columns */}
      {DAY_LABELS.map((label, di) => (
        <div key={label} className={s.dayCol}>
          <div className={s.dayHd}>{label}</div>
          <div className={s.dayBody}>
            {hours.map(h => <div key={h} className={s.hourLine} style={{top:`${((h-START_H)/TOTAL_M*3600).toFixed(2)}%`}} />)}
            {blocks.filter(b => b.day === di).map((b, i) => {
              const top = ((b.startM - START_H*60) / TOTAL_M * 100).toFixed(3)
              const ht  = ((b.endM - b.startM) / TOTAL_M * 100).toFixed(3)
              return (
                <div key={i} className={s.block} style={{ top:`${top}%`, height:`${ht}%`, background:b.color }}>
                  <div className={s.bCode}>{b.code}</div>
                  <div className={s.bName}>{b.name}</div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Cart({ studentId, cartItems, onRemove, onSubmitted }) {
  const [showSched, setShowSched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)

  const totalCr = cartItems.reduce((sum, c) => sum + (c.credits ?? 3), 0)

  async function handleSubmit() {
    if (!cartItems.length) return
    setSubmitting(true)
    try {
      await submitCart(studentId, cartItems.map(c => c.code), 'Fall 2026')
      setSubmitted(true)
      setTimeout(() => { setSubmitted(false); onSubmitted() }, 2000)
    } catch (e) { console.error(e) }
    finally { setSubmitting(false) }
  }

  return (
    <div className={s.wrap}>
      {/* Header */}
      <div className={s.hdr}>
        <span className={s.hdrTitle}>My Cart</span>
        <div className={s.hdrRight}>
          <button
            className={`${s.schedBtn} ${showSched ? s.schedBtnOn : ''}`}
            onClick={() => setShowSched(o => !o)}
          >
            {showSched ? 'Hide calendar' : 'View calendar'}
          </button>
          <span className={s.count}>{cartItems.length} courses</span>
        </div>
      </div>

      {/* Schedule grid */}
      {showSched && (
        <div className={s.schedWrap}>
          <ScheduleGrid cartItems={cartItems} />
          {cartItems.length === 0 && (
            <p className={s.schedEmpty}>Add courses to your cart to see them on the calendar.</p>
          )}
        </div>
      )}

      {/* Course list */}
      <div className={s.list}>
        {cartItems.length === 0 && !showSched && (
          <p className={s.empty}>No courses added yet.<br/>Click a recommendation card to add.</p>
        )}
        {cartItems.map(item => (
          <div key={item.code} className={s.item}>
            <div className={s.itemLeft}>
              <div className={s.itemCode}>{item.code}</div>
              <div className={s.itemName}>{item.name}</div>
              {item.section && (
                <div className={s.itemSec}>
                  {item.section.section_number}
                  {item.section.days && item.section.days !== 'TBA' && ` · ${item.section.days} ${item.section.time_slot}`}
                  {item.section.room && item.section.room !== 'TBA' && ` · ${item.section.room}`}
                </div>
              )}
              {item.section?.instructor && (
                <div className={s.itemInst}>{item.section.instructor}</div>
              )}
            </div>
            <div className={s.itemRight}>
              <span className={s.itemCr}>{item.credits} cr</span>
              <button className={s.removeBtn} onClick={() => onRemove(item.code)}>×</button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {cartItems.length > 0 && (
        <div className={s.footer}>
          <div className={s.total}>{totalCr} total credits</div>
          <button
            className={s.submitBtn}
            onClick={handleSubmit}
            disabled={submitting || submitted}
          >
            {submitted ? '✓ Submitted' : submitting ? 'Submitting…' : 'Submit to registrar →'}
          </button>
        </div>
      )}
    </div>
  )
}
