import { useState, useEffect } from 'react'
import s from './CourseBrowser.module.css'

// ── Co-requisite pairs matrix added to the frontend ───────────────────
const COREQS = [
  ['PHY102',  'PHY102L'],
  ['PHY201',  'PHY201L'],
  ['CHE205',  'CHE201L'],
  ['CHE205',  'CME210'],
  ['CHE206',  'CHE206L'],
  ['MTT204',  'MTT205'],

  ['CME331',  'CME305'],
  ['CME301',  'CME320'],
  ['CME331',  'CME321'],

  ['CME400',  'CME430'],
  ['CME400',  'CME450'],
  ['CME400',  'CME455'],
]

function StatusDot() {
  return <span className={`${s.dot} ${s.dotOpen}`} title="Open" />
}

function formatDaysAndTimes(sec) {
  const days = [];
  if (sec.Mon)   days.push('Mon');
  if (sec.Tues)  days.push('Tues');
  if (sec.Wed)   days.push('Wed');
  if (sec.Thurs) days.push('Thurs');
  if (sec.Fri)   days.push('Fri');
  if (sec.Sat)   days.push('Sat');
  if (sec.Sun)   days.push('Sun');
  if (days.length === 0) return 'TBA';
  const timeSlot = sec.mtg_start && sec.mtg_end ? ` ${sec.mtg_start} - ${sec.mtg_end}` : '';
  return days.join(' ') + timeSlot;
}

function formatDate(dateStr) {
  if (!dateStr) return 'TBA';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB');
  } catch { return dateStr; }
}

export default function CourseBrowser({
  recommendations = [],
  blockedSet = [],
  cart = [],
  onToggleCart,
  All_courses = [],
  totalCartCredits = 0,
  submittedDbCodes = new Set()
}) {
  const [search,        setSearch]        = useState('')
  const [filter,        setFilter]        = useState('all')
  const [expanded,      setExpanded]      = useState({})
  const [selected,      setSelected]      = useState({})
  const [termFilter,    setTermFilter]    = useState('all')
  const [campusFilter,  setCampusFilter]  = useState('all')
  const [visibleCourses, setVisibleCourses] = useState([])

  const toggle = code => setExpanded(prev => ({ ...prev, [code]: !prev[code] }))

  useEffect(() => {
    const courseSource = filter === 'allful' ? (All_courses || []) : (recommendations || [])

    const copied = courseSource.map(course => {
      const liveData = recommendations.find(rec => rec.code === course.code)
      return {
        ...course,
        prereqsMet: liveData ? liveData.prereqsMet : course.prereqsMet,
        sections: course.sections ? course.sections.map(s => ({ ...s })) : []
      }
    })

    copied.forEach(course => {
      let sections = course.sections

      if (termFilter !== 'all') {
        sections = sections.filter(sec =>
          (sec.session || '').toUpperCase().includes(termFilter.toUpperCase())
        )
      }
      if (campusFilter !== 'all') {
        sections = sections.filter(sec =>
          (sec.campus || '').toUpperCase().includes(campusFilter.toUpperCase())
        )
      }

      const groupedMap = {}
      sections.forEach(sec => {
        const key = sec.class_nbr || 'TBA'
        if (!groupedMap[key]) groupedMap[key] = []
        groupedMap[key].push(sec)
      })

      course.displayGroups = Object.entries(groupedMap).map(([classNbr, subSections]) => ({
        class_nbr: classNbr,
        subSections,
        primary: subSections[0] || {}
      }))
    })

    const freshList = copied.filter(r => {
      const isCurrentlyBlocked = blockedSet.includes(r.code)
      if ((r.displayGroups || []).length === 0) return false
      if (filter !== 'allful') {
        if (filter === 'available' && (!r.prereqsMet || isCurrentlyBlocked)) return false
        if (filter === 'blocked'   && !isCurrentlyBlocked) return false
      }
      if (search) {
        const q = search.toLowerCase()
        if (!r.code?.toLowerCase().includes(q) && !r.name?.toLowerCase().includes(q)) return false
      }
      return true
    })

    setVisibleCourses(freshList)
  }, [recommendations, All_courses, filter, search, termFilter, campusFilter, blockedSet])

  function handleAdd(r) {
    if (submittedDbCodes?.has?.(r.code)) return
    const groups = r.displayGroups || []
    const chosenClassNbr = selected[r.code]
    const group = groups.find(g => g.class_nbr === chosenClassNbr) || groups[0]
    if (!group) return

    const sectionToInject = {
      class_nbr: group.class_nbr,
      section:   group.primary?.section,
      session:   group.primary?.session,
      campus:    group.primary?.campus,
      room:      group.primary?.room,
      first_name: group.primary?.first_name,
      last_name:  group.primary?.last_name,
      mtg_start:  group.primary?.mtg_start,
      mtg_end:    group.primary?.mtg_end,
      Mon:   group.primary?.Mon,
      Tues:  group.primary?.Tues,
      Wed:   group.primary?.Wed,
      Thurs: group.primary?.Thurs,
      Fri:   group.primary?.Fri,
      subSections: group.subSections
    }
    onToggleCart(r.code, sectionToInject)
  }

  return (
    <div className={s.page}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className={s.topbar}>
        <span className={s.foundCount}>
          {visibleCourses.length} course{visibleCourses.length !== 1 ? 's' : ''} found
        </span>
        <div className={s.topRight}>
          <input
            className={s.search}
            placeholder="Search code or name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className={s.filters}>
            {[
              ['allful', 'All Courses'],
              ['all',    'All for my major'],
              ['available', 'Can enroll'],
              ['blocked',   'Blocked'],
            ].map(([val, label]) => (
              <button key={val}
                className={`${s.filterBtn} ${filter === val ? s.filterActive : ''}`}
                onClick={() => setFilter(val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Session / Campus filter bar ──────────────────────── */}
      <div style={{ display: 'flex', gap: 20, padding: '6px 14px', background: '#ece9df', borderBottom: '1px solid #d8d5cc', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#555' }}>Session:</span>
          {[['all','All'], ['SUM','Summer Only'], ['FAL','Fall Only']].map(([val, label]) => (
            <button key={val}
              style={{ fontSize: 13, padding: '2px 10px', border: '1px solid #ccc', borderRadius: 4,
                cursor: 'pointer',
                background: termFilter === val ? '#1a3a6a' : '#fff',
                color:       termFilter === val ? '#fff'    : '#555' }}
              onClick={() => setTermFilter(val)}
            >{label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#555' }}>Campus:</span>
          {[['all','All'], ['AD','AD Campus'], ['AA','AA Campus']].map(([val, label]) => (
            <button key={val}
              style={{ fontSize: 13, padding: '2px 10px', border: '1px solid #ccc', borderRadius: 4,
                cursor: 'pointer',
                background: campusFilter === val ? '#1a3a6a' : '#fff',
                color:       campusFilter === val ? '#fff'    : '#555' }}
              onClick={() => setCampusFilter(val)}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* ── Course list ──────────────────────────────────────── */}
      <div className={s.body}>
        {visibleCourses.map(r => {
          const inCart             = (cart || []).some(c => c.code === r.code)
          const blocked           = blockedSet.includes(r.code)
          const isAlreadySubmitted = submittedDbCodes?.has?.(r.code) ?? false
          const isOpen            = expanded[r.code] || false
          const displayGroups     = r.displayGroups || []
          
          // Match and identify verified database sync rows from global props
          const cartItemForCourse = (cart || []).find(c => c.code === r.code)
          const isRecordFromDb    = !!cartItemForCourse?.fromDb

          // Auto-default selection pointer to the verified class registration ID
          const currentSelection  = selected[r.code] ?? cartItemForCourse?.section?.class_nbr

          const displayCredits    = r.credits ?? displayGroups[0]?.primary?.max_units ?? 0

          // ── Co-requisite Parent-Child Tracking Engine ──────────────────
          const childPairConfig = COREQS.find(([parent, child]) => child === r.code);
          const parentCode = childPairConfig ? childPairConfig[0] : null;
          const isParentInCart = parentCode ? (cart || []).some(c => c.code === parentCode) : false;
          
          // Flag indicating that the module is a child lab missing its parent lecture module in the registration cart
          const missingParentCoReq = !!parentCode && !isAlreadySubmitted && !inCart && !isParentInCart;

          const nativePrereqsMet   = filter === 'allful' ? true : r.prereqsMet !== false
          // Strictly block child co-req matching lines until parent lecture gets selected
          const hasPrereqsMet     = missingParentCoReq ? false : nativePrereqsMet;

          const courseCredits     = r.credits ?? displayGroups[0]?.primary?.max_units ?? 0
          const isLimitExceeded   = !inCart && (totalCartCredits + courseCredits > 20)

          return (
            <div key={r.code}
              className={`
                ${s.card}
                ${blocked           ? s.cardBlocked : ''}
                ${inCart            ? s.cardInCart  : ''}
                ${!hasPrereqsMet && !blocked && !missingParentCoReq ? s.cardLocked : ''}
              `}
              style={
                isAlreadySubmitted 
                  ? { borderLeft: '3px solid #6b46c1', background: '#faf5ff', opacity: 0.55 }
                  : (missingParentCoReq && !blocked)
                    ? { borderLeft: '4px solid #d97706', background: '#fffbeb', borderTop: '1px solid #fcd34d', borderRight: '1px solid #fcd34d', borderBottom: '1px solid #fcd34d' }
                    : {}
              }
            >

              {/* ── Header row ──────────────────────────────── */}
              <div
                className={`${s.hdr} ${isOpen ? s.hdrOpen : ''}`}
                style={{ cursor: isAlreadySubmitted ? 'default' : undefined }}
                onClick={() => !blocked && displayGroups.length > 0 && toggle(r.code)}
              >
                <span className={s.tri}>
                  {displayGroups.length > 0 ? (isOpen ? '▼' : '▶') : '◦'}
                </span>
                <span className={s.hCode}>{r.code}</span>
                <span className={s.hSep}> – </span>
                <span className={s.hName}>{r.name}</span>

                {/* ── Real-time Alert Note Banner ──────────────── */}
                {missingParentCoReq && !blocked && (
                  <span style={{
                    marginLeft: 12, fontSize: 11, color: '#b45309', fontWeight: 700,
                    background: '#fef3c7', padding: '3px 8px', borderRadius: 4, border: '1px solid #f59e0b'
                  }}>
                    ⚠️ You must take {parentCode} with this course. Add {parentCode} to cart first.
                  </span>
                )}

                {(r.downstreamUnlocks || 0) > 0 && (
                  <span className={s.unlockScore} title={`Unlocks ${r.downstreamUnlocks} future courses`}>
                    {r.downstreamUnlocks} pts
                  </span>
                )}

                <div className={s.hRight}>
                  {blocked && (
                    <span className={`${s.badge} ${s.badgeBlocked}`}>blocked</span>
                  )}
                  
                  {isAlreadySubmitted && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: '#6b46c1',
                      background: '#f3e8ff', border: '1px solid #e9d5ff',
                      padding: '2px 8px', borderRadius: 4, marginRight: 6,
                    }}>
                      🔒 Already Enrolled
                    </span>
                  )}

                  <span className={s.cr}>{displayCredits} cr</span>

                  {/* Drop out button panel entirely for confirmed records */}
                  {!blocked && !isAlreadySubmitted && (
                    <button
                      className={`${s.addBtn}
                        ${inCart ? s.addBtnIn : ''}
                        ${((!hasPrereqsMet || isLimitExceeded) && !inCart) ? s.addBtnDisabled : ''}
                      `}
                      onClick={e => {
                        e.stopPropagation()
                        if (!hasPrereqsMet && !inCart) return
                        if (isLimitExceeded  && !inCart) return
                        
                        if (inCart) {
                          // Cascading deletion configuration: If it's a parent course, remove its children co-reqs too
                          const pairsAsParent = COREQS.filter(([a, b]) => a === r.code);
                          pairsAsParent.forEach(([a, b]) => {
                            if ((cart || []).some(c => c.code === b)) {
                              const childCourse = recommendations.find(x => x.code === b) || All_courses.find(x => x.code === b);
                              const childGroup = childCourse?.displayGroups?.[0] || {};
                              const childSectionToInject = {
                                class_nbr: childGroup.class_nbr,
                                section:   childGroup.primary?.section,
                              };
                              onToggleCart(b, childSectionToInject);
                            }
                          });
                          // Finally remove the parent item out of the cart array list
                          handleAdd(r);
                        } else {
                          handleAdd(r);
                        }
                      }}
                    >
                      {inCart            ? '✓ Added'
                        : missingParentCoReq ? `🔒 Needs ${parentCode}`
                        : !hasPrereqsMet    ? '🔒 Locked'
                        : isLimitExceeded   ? '⚠️ Max Credits'
                        : '+ Add'}
                    </button>
                  )}
                </div>
              </div>

              {/* ── Sections table ──────────────────────────── */}
              {isOpen && displayGroups.length > 0 && (
                <div className={s.secWrap} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10 }}>
                  <div className={s.colHdr}>
                    <span className={s.cSel}></span>
                    <span className={s.cClass}>Class Nbr</span>
                    <span className={s.cSec}>Section (Session)</span>
                    <span className={s.cCr}>Credits</span>
                    <span className={s.cDT}>Days & Times</span>
                    <span className={s.cRoom}>Campus</span>
                    <span className={s.cInst}>Instructor</span>
                    <span className={s.cDates}>Meeting Dates</span>
                    <span className={s.cStat}>Status</span>
                  </div>

                  {displayGroups.map(group => {
                    const isSelected = String(currentSelection) === String(group.class_nbr) ||
                      (currentSelection === undefined && displayGroups[0].class_nbr === group.class_nbr)

                    return (
                      <div
                        key={`${r.code}-${group.class_nbr}`}
                        className={`${s.secBlock} ${isSelected ? s.secSelected : ''}`}
                        style={{
                          border:       isSelected ? (isAlreadySubmitted ? '2px solid #6b46c1' : '2px solid #1a3a6a') : '1px solid #e2e8f0',
                          borderRadius: 6,
                          background:   isAlreadySubmitted
                            ? (isSelected ? '#e9d5ff' : '#f3e8ff')
                            : (isSelected ? '#f7fafc'  : '#fff'),
                          // Lock clicks and disable cursor options on database items
                          cursor:        isAlreadySubmitted ? 'not-allowed' : 'pointer',
                          opacity:       isAlreadySubmitted ? 0.75 : 1,
                          pointerEvents: isAlreadySubmitted ? 'none' : 'auto',
                          padding:       4,
                        }}
                        onClick={() => {
                          if (isAlreadySubmitted) return
                          setSelected(prev => ({ ...prev, [r.code]: group.class_nbr }))
                        }}
                      >
                        {group.subSections.map((subSec, sIdx) => (
                          <div key={`${group.class_nbr}-${sIdx}`} className={s.secRow}
                            style={{
                              borderBottom: sIdx < group.subSections.length - 1 ? '1px dashed #edf2f7' : 'none',
                              padding: '6px 0',
                            }}
                          >
                            <span className={s.cSel}>
                              {sIdx === 0
                                ? <span className={isSelected ? s.radioOn : s.radioOff} />
                                : <span style={{ width: 12, display: 'inline-block' }} />}
                            </span>

                            <span className={s.classNum}>
                              {sIdx === 0
                                ? <span style={{ fontWeight: 700 }}>{group.class_nbr}</span>
                                : <span style={{ color: '#aaa', fontSize: 11 }}>↳ cont.</span>}
                            </span>

                            <span className={s.cSec}>
                              <span className={s.secNum}>ID: {subSec.section}</span><br />
                              <span className={s.semTag}>{subSec.session || 'Regular'}</span>
                            </span>

                            <span className={s.cCr}>{r.credits ?? subSec.max_units ?? 0} cr</span>

                            <span className={s.cDT} style={{ fontWeight: 600, color: '#2d3748' }}>
                              {formatDaysAndTimes(subSec)}
                            </span>

                            <span className={s.cRoom}>
                              <span className={s.campusName}>{subSec.campus || 'Main'}</span>
                              {subSec.room && <><br /><span>Rm: {subSec.room}</span></>}
                            </span>

                            <span className={s.cInst}>
                              {`${subSec.first_name ?? ''} ${subSec.last_name ?? ''}`.trim() || 'TBA'}
                            </span>

                            <span className={s.cDates}>
                              {formatDate(subSec.start_date)} –<br />{formatDate(subSec.end_date)}
                            </span>

                            <span className={s.cStat}><StatusDot /></span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {visibleCourses.length === 0 && (
          <div className={s.empty}>No courses match your search.</div>
        )}
      </div>
    </div>
  )
}