import { useState } from 'react'
import s from './CourseBrowser.module.css'

function StatusDot({ status }) {
  const cls = status === 'open' ? s.dotOpen : status === 'waitlist' ? s.dotWait : s.dotClosed
  return <span className={`${s.dot} ${cls}`} />
}

export default function CourseBrowser({ recommendations, cart, onToggleCart, semester }) {
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('all')
  const [expanded, setExpanded] = useState({})
  const [selected, setSelected] = useState({}) // code → section_number

  const toggle = code => setExpanded(prev => ({ ...prev, [code]: !prev[code] }))

  const filtered = recommendations.filter(r => {
    if (filter === 'available' && (!r.prereqsMet || r.isBlocked)) return false
    if (filter === 'blocked'   && !r.isBlocked) return false
    if (search) {
      const q = search.toLowerCase()
      return r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    }
    return true
  })

  const semLabel = semester === 'spring' ? 'Spring 2026' : 'Fall 2026'
  const semYear  = '2026'

  function handleAdd(r) {
    // Build the cart item with selected section info attached
    const secNum  = selected[r.code]
    const section = r.sections?.find(s => s.section_number === secNum) || r.sections?.[0] || null
    onToggleCart(r.code, section)
  }

  return (
    <div className={s.page}>

      {/* Top bar */}
      <div className={s.topbar}>
        <span className={s.foundCount}>{filtered.length} class section{filtered.length !== 1 ? 's' : ''} found</span>
        <div className={s.topRight}>
          <input
            className={s.search}
            placeholder="Search code or name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className={s.filters}>
            {[['all','All'],['available','Can enroll'],['blocked','Blocked']].map(([val,label]) => (
              <button key={val}
                className={`${s.filterBtn} ${filter===val?s.filterActive:''}`}
                onClick={() => setFilter(val)}
              >{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* List */}
      <div className={s.body}>
        {filtered.map((r, idx) => {
          const inCart   = cart.some(c => c.code === r.code)
          const blocked  = r.isBlocked
          const noPrereq = !r.prereqsMet && !blocked
          const isOpen   = expanded[r.code]
          const sections = r.sections || []
          const selSec   = selected[r.code] || (sections[0]?.section_number ?? null)
          const baseClass = 1100 + idx * 3

          return (
            <div key={r.code} className={`${s.card} ${blocked ? s.cardBlocked : ''} ${inCart ? s.cardInCart : ''} ${!r.prereqsMet && !blocked ? s.cardLocked : ''}`}>

              {/* Header row */}
              <div className={`${s.hdr} ${isOpen ? s.hdrOpen : ''}`}
                onClick={() => !blocked && sections.length > 0 && toggle(r.code)}>
                <span className={s.tri}>{sections.length > 0 ? (isOpen ? '▼' : '▶') : '◦'}</span>
                <span className={s.hCode}>{r.code}</span>
                <span className={s.hSep}> – </span>
                <span className={s.hName}>{r.name}</span>
                {r.downstreamUnlocks > 0 && (
                  <span className={s.unlockScore} title={`Unlocks ${r.downstreamUnlocks} future course${r.downstreamUnlocks !== 1 ? 's' : ''} (direct + indirect)`}>
                    {r.downstreamUnlocks} pts
                  </span>
                )}
                <div className={s.hRight}>
                  {blocked  && <span className={`${s.badge} ${s.badgeBlocked}`}>blocked</span>}
                  {noPrereq && <span className={`${s.badge} ${s.badgePending}`}>prereqs pending</span>}
                  {r.oncePerYear && !blocked && (
                    <span className={`${s.badge} ${s.badgeSem}`}>
                      {r.semesterOffered === 'spring' ? 'Spring only' : 'Fall only'}
                    </span>
                  )}
                  <span className={s.cr}>{r.credits} cr</span>
                  {!blocked && (
                    <button
                      className={`${s.addBtn} ${inCart ? s.addBtnIn : ''} ${!r.prereqsMet && !inCart ? s.addBtnDisabled : ''}`}
                      onClick={e => {
                        e.stopPropagation()
                        if (!r.prereqsMet && !inCart) return
                        handleAdd(r)
                      }}
                      title={!r.prereqsMet && !inCart ? `Missing: ${r.missingPrereqs?.join(', ')}` : ''}
                    >
                      {inCart ? '✓ Added' : !r.prereqsMet ? '🔒 Locked' : '+ Add'}
                    </button>
                  )}
                </div>
              </div>

              {/* Sections table — expanded */}
              {isOpen && sections.length > 0 && (
                <div className={s.secWrap}>
                  <div className={s.colHdr}>
                    <span className={s.cSel}></span>
                    <span className={s.cClass}>Class</span>
                    <span className={s.cSec}>Section</span>
                    <span className={s.cDT}>Days & Times</span>
                    <span className={s.cRoom}>Room</span>
                    <span className={s.cInst}>Instructor</span>
                    <span className={s.cDates}>Meeting Dates</span>
                    <span className={s.cStat}>Status</span>
                  </div>

                  {sections.map((sec, si) => {
                    const isSelected = selSec === sec.section_number
                    const has2 = sec.days2 && sec.time_slot2 && sec.days2 !== 'TBA'
                    return (
                      <div key={sec.section_number}
                        className={`${s.secBlock} ${isSelected ? s.secSelected : ''}`}
                        onClick={() => setSelected(prev => ({ ...prev, [r.code]: sec.section_number }))}>

                        {/* Row 1 */}
                        <div className={s.secRow}>
                          <span className={s.cSel}>
                            <span className={isSelected ? s.radioOn : s.radioOff} />
                          </span>
                          <span className={s.cClass}>
                            <span className={s.classNum}>{baseClass + si}</span>
                          </span>
                          <span className={s.cSec}>
                            <span className={s.secNum}>{sec.section_number}</span>
                            <br/><span className={s.semTag}>{semYear}</span>
                          </span>
                          <span className={s.cDT}>
                            {sec.days && sec.days !== 'TBA' ? `${sec.days} ${sec.time_slot}` : 'TBA'}
                          </span>
                          <span className={s.cRoom}>{sec.room ?? 'TBA'}</span>
                          <span className={s.cInst}>{sec.instructor ?? 'TBA'}</span>
                          <span className={s.cDates}>
                            05/01/{semYear} –<br/>15/02/{semYear}
                          </span>
                          <span className={s.cStat}><StatusDot status={sec.status} /></span>
                        </div>

                        {/* Row 2 — second slot */}
                        {has2 && (
                          <div className={`${s.secRow} ${s.secRow2}`}>
                            <span className={s.cSel} />
                            <span className={s.cClass} />
                            <span className={s.cSec} />
                            <span className={s.cDT}>{sec.days2} {sec.time_slot2}</span>
                            <span className={s.cRoom}>{sec.room2 ?? sec.room ?? 'TBA'}</span>
                            <span className={s.cInst}>{sec.instructor2 ?? 'To be Announced'}</span>
                            <span className={s.cDates} />
                            <span className={s.cStat} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && <div className={s.empty}>No courses match your search.</div>}
      </div>
    </div>
  )
}