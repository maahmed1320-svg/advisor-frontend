import { useMemo } from 'react'
import s from './Calendar.module.css'

const DAYS     = ['Mon','Tue','Wed','Thu','Fri']
const DAY_MAP  = { Mo:'Mon', Tu:'Tue', We:'Wed', Th:'Thu', Fr:'Fri' }
const START_H  = 9
const END_H    = 22
const HOURS    = END_H - START_H          // 13
const TOTAL_M  = HOURS * 60              // 780

const PALETTE = [
  { bg:'#ececea', br:'#8a8880', tx:'#1a1a18' },
  { bg:'#e4f0e4', br:'#5a8e5a', tx:'#0a280a' },
  { bg:'#e4ecf6', br:'#5a72be', tx:'#0a1848' },
  { bg:'#f6ece0', br:'#be9040', tx:'#483008' },
  { bg:'#eee4f2', br:'#9060a8', tx:'#280a36' },
  { bg:'#e0f2f6', br:'#3890a8', tx:'#082838' },
  { bg:'#f6e4e4', br:'#be5858', tx:'#380808' },
]

function toMins(t) {
  const [h, m] = t.trim().split(':').map(Number)
  return h * 60 + m
}

function parseSlot(slot) {
  if (!slot || slot === 'TBA') return null
  const parts = slot.split(' - ')
  if (parts.length < 2) return null
  return { start: toMins(parts[0]), end: toMins(parts[1]) }
}

function parseDays(days) {
  if (!days || days === 'TBA') return []
  const out = []
  let i = 0
  while (i < days.length) {
    const two = days.slice(i, i + 2)
    if (DAY_MAP[two]) { out.push(DAY_MAP[two]); i += 2 }
    else i++
  }
  return out
}

const hourLabel = h => h === 12 ? '12pm' : h > 12 ? `${h - 12}pm` : `${h}am`

export default function Calendar({ cart, allCourses }) {
  const cMap = useMemo(
    () => Object.fromEntries(allCourses.map(c => [c.code, c])),
    [allCourses]
  )

  // blocks[day] = array of { code, name, instructor, start, end, color }
  const blocksByDay = useMemo(() => {
    const map = {}
    DAYS.forEach(d => { map[d] = [] })
    cart.forEach((code, idx) => {
      const c = cMap[code]
      if (!c) return
      const time = parseSlot(c.time_slot)
      const days = parseDays(c.days)
      if (!time || !days.length) return
      const color = PALETTE[idx % PALETTE.length]
      days.forEach(day => {
        if (map[day]) map[day].push({ code, name: c.name, instructor: c.instructor, ...time, color })
      })
    })
    return map
  }, [cart, cMap])

  const hasAny = DAYS.some(d => blocksByDay[d].length > 0)

  return (
    <div className={s.wrap}>
      <div className={s.cal}>

        {/* Time gutter */}
        <div className={s.gutter}>
          <div className={s.gutterTop} />
          {Array.from({ length: HOURS + 1 }, (_, i) => (
            <div key={i} className={s.gutterCell}>
              {hourLabel(START_H + i)}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {DAYS.map(day => (
          <div key={day} className={s.dayCol}>
            <div className={s.dayHd}>{day}</div>
            <div className={s.dayBody}>
              {/* Hour grid lines */}
              {Array.from({ length: HOURS }, (_, i) => (
                <div
                  key={i}
                  className={s.hourLine}
                  style={{ top: `${(i / HOURS) * 100}%` }}
                />
              ))}
              {/* Half-hour lines */}
              {Array.from({ length: HOURS }, (_, i) => (
                <div
                  key={`h${i}`}
                  className={s.halfLine}
                  style={{ top: `${((i + 0.5) / HOURS) * 100}%` }}
                />
              ))}
              {/* Course blocks */}
              {blocksByDay[day].map((b, i) => {
                const top    = ((b.start - START_H * 60) / TOTAL_M) * 100
                const height = ((b.end - b.start) / TOTAL_M) * 100
                return (
                  <div
                    key={i}
                    className={s.block}
                    style={{
                      top:         `${top.toFixed(3)}%`,
                      height:      `${height.toFixed(3)}%`,
                      background:  b.color.bg,
                      borderColor: b.color.br,
                      color:       b.color.tx,
                    }}
                  >
                    <div className={s.bCode}>{b.code}</div>
                    <div className={s.bName}>{b.name}</div>
                    {b.instructor && (
                      <div className={s.bInst}>
                        {b.instructor.replace('Dr. ', '')}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {cart.length === 0 && (
        <p className={s.empty}>Add courses to your cart to see them on the calendar.</p>
      )}
      {cart.length > 0 && !hasAny && (
        <p className={s.empty}>No schedule info available for the selected courses yet.</p>
      )}
    </div>
  )
}
