import { useState, useEffect } from 'react'
import s from './CourseBrowser.module.css'

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
  const timeSlot = sec.mtg_start && sec.mtg_end ? ` ${sec.mtg_start.slice(0, 5)} - ${sec.mtg_end.slice(0, 5)}` : '';
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
        missingPrereqs: liveData ? liveData.missingPrereqs : [],
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

      const inCart = (cart || []).some(c => c.code === course.code)
      const isAlreadySubmitted = submittedDbCodes?.has?.(course.code) ?? false
      
      const childPairConfig = COREQS.find(([parent, child]) => child === course.code);
      const parentCode = childPairConfig ? childPairConfig[0] : null;
      const isParentInCart = parentCode ? (cart || []).some(c => c.code === parentCode) : false;
      
      const missingParentCoReq = !!parentCode && !isAlreadySubmitted && !inCart && !isParentInCart;
      const nativePrereqsMet = filter === 'allful' ? true : course.prereqsMet !== false;

      let hasPrereqsMet = nativePrereqsMet;
      if (isParentInCart) {
        const otherMissing = (course.missingPrereqs || []).filter(p => p !== parentCode && !p.startsWith('Required:'));
        if (otherMissing.length === 0) {
          hasPrereqsMet = true; 
        }
      } else if (missingParentCoReq) {
        hasPrereqsMet = false;
      }

      course.missingParentCoReq = missingParentCoReq;
      course.computedPrereqsMet = hasPrereqsMet;
      course.parentCode = parentCode;
    })

    const freshList = copied.filter(r => {
      const isCurrentlyBlocked = blockedSet.includes(r.code)
      if ((r.displayGroups || []).length === 0) return false
      
      if (filter !== 'allful') {
        if (filter === 'available') {
          const canEnroll = (r.computedPrereqsMet || r.missingParentCoReq) && !isCurrentlyBlocked;
          if (!canEnroll) return false;
        }
        if (filter === 'blocked' && !isCurrentlyBlocked) return false
      }
      
      if (search) {
        const q = search.toLowerCase()
        if (!r.code?.toLowerCase().includes(q) && !r.name?.toLowerCase().includes(q)) return false
      }
      return true
    })

    setVisibleCourses(freshList)
  }, [recommendations, All_courses, filter, search, termFilter, campusFilter, blockedSet, cart, submittedDbCodes])

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
            placeholder="Search code or name..."
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
      <div className={s.subFilterBar}>
        <div className={s.subFilterGroup}>
          <span className={s.subFilterLabel}>Session:</span>
          {[['all','All'], ['SUM','Summer'], ['FAL','Fall']].map(([val, label]) => (
            <button key={val}
              className={`${s.subFilterBtn} ${termFilter === val ? s.subFilterBtnActive : ''}`}
              onClick={() => setTermFilter(val)}
            >{label}</button>
          ))}
        </div>
        <div className={s.subFilterGroup}>
          <span className={s.subFilterLabel}>Campus:</span>
          {[['all','All'], ['AD','AD Campus'], ['AA','AA Campus']].map(([val, label]) => (
            <button key={val}
              className={`${s.subFilterBtn} ${campusFilter === val ? s.subFilterBtnActive : ''}`}
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
          
          const cartItemForCourse = (cart || []).find(c => c.code === r.code)
          const currentSelection  = selected[r.code] ?? cartItemForCourse?.section?.class_nbr
          const displayCredits    = r.credits ?? displayGroups[0]?.primary?.max_units ?? 0

          const missingParentCoReq = r.missingParentCoReq;
          const hasPrereqsMet     = r.computedPrereqsMet;
          const parentCode        = r.parentCode;

          const courseCredits     = r.credits ?? displayGroups[0]?.primary?.max_units ?? 0
          const isLimitExceeded   = !inCart && (totalCartCredits + courseCredits > 20)

          return (
            <div key={r.code}
              className={`
                ${s.card}
                ${blocked           ? s.cardBlocked : ''}
                ${inCart            ? s.cardInCart  : ''}
                ${!hasPrereqsMet && !blocked && !missingParentCoReq ? s.cardLocked : ''}
                ${missingParentCoReq && !blocked ? s.cardMissingParent : ''}
                ${isAlreadySubmitted ? s.cardSubmitted : ''}
              `}
            >

              {/* ── Header row ──────────────────────────────── */}
              <div
                className={`${s.hdr} ${isOpen ? s.hdrOpen : ''} ${isAlreadySubmitted ? s.hdrSubmitted : ''}`}
                onClick={() => !blocked && displayGroups.length > 0 && toggle(r.code)}
              >
                <span className={s.tri}>
                  {displayGroups.length > 0 ? (isOpen ? '▼' : '▶') : '◦'}
                </span>
                <span className={s.hCode}>{r.code}</span>
                <span className={s.hSep}> – </span>
                <span className={s.hName}>{r.name}</span>

                {missingParentCoReq && !blocked && (
                  <div className={s.alertBanner}>
                    Warning: You must take {parentCode} with this course. Add {parentCode} to cart first.
                  </div>
                )}

                <div className={s.hRight}>
                  {(r.downstreamUnlocks || 0) > 0 && (
                    <span className={s.unlockScore} title={`Unlocks ${r.downstreamUnlocks} future courses`}>
                      {r.downstreamUnlocks} pts
                    </span>
                  )}

                  {blocked && (
                    <span className={`${s.badge} ${s.badgeBlocked}`}>blocked</span>
                  )}
                  
                  {isAlreadySubmitted && (
                    <span className={s.badgeSubmitted}>Already Enrolled</span>
                  )}

                  <span className={s.cr}>{displayCredits} cr</span>

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
                          handleAdd(r);
                        } else {
                          handleAdd(r);
                        }
                      }}
                    >
                      {inCart            ? 'Added'
                        : missingParentCoReq ? `Needs ${parentCode}`
                        : !hasPrereqsMet    ? 'Locked'
                        : isLimitExceeded   ? 'Max Credits'
                        : '+ Add'}
                    </button>
                  )}
                </div>
              </div>

              {/* ── Sections table ──────────────────────────── */}
              {isOpen && displayGroups.length > 0 && (
                <div className={s.secWrap}>
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

                    // Compute dynamic section block wrapper state mapping
                    const secBlockClass = isAlreadySubmitted
                      ? (isSelected ? s.secBlockSubmittedSelected : s.secBlockSubmitted)
                      : (isSelected ? `${s.secBlock} ${s.secSelected}` : s.secBlock);

                    return (
                      <div
                        key={`${r.code}-${group.class_nbr}`}
                        className={secBlockClass}
                        onClick={() => {
                          if (isAlreadySubmitted) return
                          setSelected(prev => ({ ...prev, [r.code]: group.class_nbr }))
                        }}
                      >
                        {group.subSections.map((subSec, sIdx) => (
                          <div 
                            key={`${group.class_nbr}-${sIdx}`} 
                            className={`${s.secRow} ${sIdx < group.subSections.length - 1 ? s.secRowNotLast : ''}`}
                          >
                            <span className={s.cSel}>
                              {sIdx === 0
                                ? <span className={isSelected ? s.radioOn : s.radioOff} />
                                : <span className={s.radioPlaceholder} />}
                            </span>

                            <span className={s.classNum}>
                              <span className={s.mobileLabel}>Class Nbr:</span>
                              {sIdx === 0 ? group.class_nbr : <span className={s.contLabel}>↳ cont.</span>}
                            </span>

                            <span className={s.cSec}>
                              <span className={s.mobileLabel}>Section:</span>
                              <span className={s.secNum}>ID: {subSec.section}</span>&nbsp;
                              <span className={s.semTag}>{subSec.session || 'Regular'}</span>
                            </span>

                            <span className={s.cCr}>
                              <span className={s.mobileLabel}>Credits:</span>
                              {r.credits ?? subSec.max_units ?? 0} cr
                            </span>

                            <span className={s.cDT}>
                              <span className={s.mobileLabel}>Schedule:</span>
                              {formatDaysAndTimes(subSec)}
                            </span>

                            <span className={s.cRoom}>
                              <span className={s.mobileLabel}>Location:</span>
                              <span className={s.campusName}>{subSec.campus || 'Main'}</span>
                              {subSec.room && <span>&nbsp;(Rm: {subSec.room})</span>}
                            </span>

                            <span className={s.cInst}>
                              <span className={s.mobileLabel}>Instructor:</span>
                              {`${subSec.first_name ?? ''} ${subSec.last_name ?? ''}`.trim() || 'TBA'}
                            </span>

                            <span className={s.cDates}>
                              <span className={s.mobileLabel}>Dates:</span>
                              {formatDate(subSec.start_date)} – {formatDate(subSec.end_date)}
                            </span>

                            <span className={s.cStat}>
                              <span className={s.mobileLabel}>Status:</span>
                              <StatusDot />
                            </span>
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