import { useState, useEffect, useRef } from "react"
import { STUDY_PLAN } from './Studyplans'
import s from './Chains.module.css'

export default function Chains({ chains, coReqEdges, blockedCodes, prereqEdges, completed, inProgress }) {

  const [hoveredCode,   setHoveredCode]   = useState(null)
  const [prereqNodes,   setPrereqNodes]   = useState(new Set())
  const [unlockNodes,   setUnlockNodes]   = useState(new Set())
  const [arrows,        setArrows]        = useState([])
  const [tooltip,       setTooltip]       = useState(null)
  const pillRefs     = useRef({})
  const containerRef = useRef(null)

  const [completedSearch, setCompletedSearch] = useState("")
  const [completedSortKey, setCompletedSortKey] = useState("date") 
  const [isInverted, setIsInverted] = useState(false)

  // ── Arrow drawing computation ──────────────────────────────
  useEffect(() => {
    if (!hoveredCode) { setArrows([]); return }
    const timer = setTimeout(() => {
      const newArrows = []
      const container = containerRef.current

      const getPos = (code) => {
        const el = pillRefs.current[code]
        if (!el || !container) return null
        const eRect = el.getBoundingClientRect()
        const cRect = container.getBoundingClientRect()
        return {
          right:  eRect.right  - cRect.left,
          left:   eRect.left   - cRect.left,
          top:    eRect.top    - cRect.top,
          bottom: eRect.bottom - cRect.top,
          x:      eRect.left   - cRect.left + eRect.width  / 2,
          y:      eRect.top    - cRect.top  + eRect.height / 2,
        }
      }

      const makePath = (from, to) => {
        if (!from || !to) return null
        if (from.right <= to.left) {
          const midX = (from.right + to.left) / 2
          return `M ${from.right} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.left} ${to.y}`
        } else if (from.left >= to.right) {
          const midX = (from.left + to.right) / 2
          return `M ${from.left} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.right} ${to.y}`
        } else {
          const midY = (from.bottom + to.top) / 2
          return `M ${from.x} ${from.bottom} L ${from.x} ${midY} L ${to.x} ${midY} L ${to.x} ${to.top}`
        }
      }

      const myPrereqs = prereqEdges?.[hoveredCode] || []
      for (const prereq of myPrereqs) {
        const d = makePath(getPos(prereq), getPos(hoveredCode))
        if (d) newArrows.push({ d, color: '#28a745' })
      }

      const unlocks = Object.entries(prereqEdges || {})
        .filter(([_, prereqs]) => prereqs.includes(hoveredCode))
        .map(([course]) => course)
      for (const unlock of unlocks) {
        const d = makePath(getPos(hoveredCode), getPos(unlock))
        if (d) newArrows.push({ d, color: '#0066cc' })
      }

      setArrows(newArrows)
    }, 10)
    return () => clearTimeout(timer)
  }, [hoveredCode, prereqEdges])

  const chainMap = {}
  for (const c of chains) chainMap[c.code] = c

  const LEGEND = [
    { state: 'completed',   label: 'Completed',   extra: 'Course passed' },
    { state: 'in_progress', label: 'In Progress', extra: 'Currently enrolled' },
    { state: 'locked',      label: 'For the future',      extra: 'Available/Locked' },
  ]

  const allOE = [
    ...(inProgress || []).filter(c => c.type2 === 'OE'),
    ...(completed  || []).filter(c => c.type2 === 'OE'),
  ]
  const allME = [
    ...(completed  || []).filter(c => c.type2 === 'ME'),
    ...(inProgress || []).filter(c => c.type2 === 'ME'),
  ]

  const planOE  = allOE.slice(0, 2)
  const planME  = allME.slice(0, 3)
  const extraOE = allOE.slice(2)
  const extraME = allME.slice(3)

  const getDisplayForCode = (c) => {
    const makeFromList = (item) => item ? {
      code:  item.code,
      state: item.grade ? 'completed' : 'in_progress',
      title: item.name,
      grade: item.grade,
    } : null

    if (c === 'OEI')   return makeFromList(planOE[0]) || { code: 'OEI',   state: 'locked' }
    if (c === 'OEII')  return makeFromList(planOE[1]) || { code: 'OEII',  state: 'locked' }
    if (c === 'MEI')   return makeFromList(planME[0]) || { code: 'MEI',   state: 'locked' }
    if (c === 'MEII')  return makeFromList(planME[1]) || { code: 'MEII',  state: 'locked' }
    if (c === 'MEIII') return makeFromList(planME[2]) || { code: 'MEIII', state: 'locked' }
    return chainMap[c] || { code: c, state: 'locked' }
  }

  const allPlanCodes = new Set()

  function getAllPrereqs(code, visited = new Set()) {
    const directPrereqs = prereqEdges?.[code] || []
    for (const p of directPrereqs) {
      if (!visited.has(p)) {
        visited.add(p)
        getAllPrereqs(p, visited)
      }
    }
    return visited
  }

  const handleEnter = (code) => {
    setHoveredCode(code)
    setTooltip(code)
    const prereqs = getAllPrereqs(code)
    setPrereqNodes(prereqs)
    const unlocks = new Set(
      Object.entries(prereqEdges || {})
        .filter(([_, prereqs]) => prereqs.includes(code))
        .map(([course]) => course)
    )
    setUnlockNodes(unlocks)
  }

  const handleLeave = () => {
    setHoveredCode(null)
    setTooltip(null)
    setPrereqNodes(new Set())
    setUnlockNodes(new Set())
  }

  const renderTooltip = () => {
    if (!tooltip) return null
    
    const display = chainMap[tooltip] 
      || completed?.find(c => c.code === tooltip)
      || inProgress?.find(c => c.code === tooltip)
      || { code: tooltip, state: 'locked' }

    const state = display.state 
      || (display.grade ? 'completed' : 'in_progress')

    const stateLabel = {
      completed:   display.grade ? `Grade: ${display.grade}` : 'Completed',
      in_progress: 'Currently enrolled',
      locked:      'Locked — prerequisites not met',
    }

    // Colors mapping used exclusively for text coloring in the component
    const textColorMap = { completed: '#155724', in_progress: '#856404', locked: '#6c757d' };

    return (
      <div className={s.tooltipWindow}>
        <div className={s.tooltipCode}>{display.code}</div>
        {(display.title || display.name) && (
          <div className={s.tooltipTitle}>
            {display.title || display.name}
          </div>
        )}
        <div className={s.tooltipState} style={{ color: textColorMap[state] || '#6c757d' }}>
          {stateLabel[state] || state}
        </div>
      </div>
    )
  }

  const plan = STUDY_PLAN["CME"]
  const course_year_map = {
    11: '1F', 12: '1S',
    21: '2F', 22: '2S', 222: '2Sum',
    31: '3F', 32: '3S', 322: '3Sum',
    41: '4F', 42: '4S',
  }
  const SEMESTERS = [
    { sem: 'Fall',   key: '1F'   },
    { sem: 'Spring', key: '1S'   },
    { sem: 'Fall',   key: '2F'   },
    { sem: 'Spring', key: '2S'   },
    { sem: 'Summer', key: '2Sum' },
    { sem: 'Fall',   key: '3F'   },
    { sem: 'Spring', key: '3S'   },
    { sem: 'Summer', key: '3Sum' },
    { sem: 'Fall',   key: '4F'   },
    { sem: 'Spring', key: '4S'   },
  ]
  const year = [
    { label: 'Freshman',  span: 2 },
    { label: 'Sophomore', span: 3 },
    { label: 'Junior',    span: 3 },
    { label: 'Senior',    span: 2 },
  ]

  const MejorElectiveList = [
    { code: "CME460", name: "Natural Gas Processing", theme: { label: "Gas Processing & Petrochemicals", bg: "#e0f2fe", txt: "#0369a1", bdr: "#bae6fd" } },
    { code: "CME461", name: "Petroleum Refining Process", theme: { label: "Gas Processing & Petrochemicals", bg: "#e0f2fe", txt: "#0369a1", bdr: "#bae6fd" } },
    { code: "CME462", name: "Chemical Process Industries", theme: { label: "Gas Processing & Petrochemicals", bg: "#e0f2fe", txt: "#0369a1", bdr: "#bae6fd" } },
    { code: "CME463", name: "Corrosion Engineer", theme: { label: "Gas Processing & Petrochemicals", bg: "#e0f2fe", txt: "#0369a1", bdr: "#bae6fd" } },
    { code: "CME464", name: "Chemical Process Safety", theme: { label: "Gas Processing & Petrochemicals", bg: "#e0f2fe", txt: "#0369a1", bdr: "#bae6fd" } },
    { code: "CME465", name: "Process Heat Transfer", theme: { label: "Gas Processing & Petrochemicals", bg: "#e0f2fe", txt: "#0369a1", bdr: "#bae6fd" } },
    
    { code: "CME470", name: "Introduction To Polymer Science And Technology", theme: { label: "Polymer & Materials", bg: "#f3e8ff", txt: "#6b21a8", bdr: "#e9d5ff" } },
    { code: "CME471", name: "Polymer Chemistry And Reaction Engineering", theme: { label: "Polymer & Materials", bg: "#f3e8ff", txt: "#6b21a8", bdr: "#e9d5ff" } },
    { code: "CME472", name: "Polymer properties, testing and characterization", theme: { label: "Polymer & Materials", bg: "#f3e8ff", txt: "#6b21a8", bdr: "#e9d5ff" } },
    { code: "CME473", name: "Polymer Processing And Materials Design", theme: { label: "Polymer & Materials", bg: "#f3e8ff", txt: "#6b21a8", bdr: "#e9d5ff" } },
    
    { code: "CME480", name: "Water Technology And Membrane Processes", theme: { label: "Water Treatments & Desalination", bg: "#ccfbf1", txt: "#0f766e", bdr: "#99f6e4" } },
    { code: "CME481", name: "Thermal Desalination", theme: { label: "Water Treatments & Desalination", bg: "#ccfbf1", txt: "#0f766e", bdr: "#99f6e4" } },
    { code: "CME482", name: "Membrane Desalination", theme: { label: "Water Treatments & Desalination", bg: "#ccfbf1", txt: "#0f766e", bdr: "#99f6e4" } },
    { code: "CME483", name: "Industrial Wastewater Treatment", theme: { label: "Water Treatments & Desalination", bg: "#ccfbf1", txt: "#0f766e", bdr: "#99f6e4" } },
    { code: "CME484", name: "Industrial Water Pollution And Control", theme: { label: "Water Treatments & Desalination", bg: "#ccfbf1", txt: "#0f766e", bdr: "#99f6e4" } },
    
    { code: "CME490", name: "Chemical Engineering Biology", theme: { label: "Biotechnology", bg: "#fce7f3", txt: "#9d174d", bdr: "#fbcfe8" } },
    { code: "CME491", name: "Biochemical Engineering", theme: { label: "Biotechnology", bg: "#fce7f3", txt: "#9d174d", bdr: "#fbcfe8" } },
    { code: "CME492", name: "Biochemical Treatment", theme: { label: "Biotechnology", bg: "#fce7f3", txt: "#9d174d", bdr: "#fbcfe8" } },
    { code: "CME493", name: "Biofuels Technology", theme: { label: "Biotechnology", bg: "#fce7f3", txt: "#9d174d", bdr: "#fbcfe8" } },
  ]

  const completedSet = new Set((completed || []).map(c => c.code))
  const inProgressSet = new Set((inProgress || []).map(c => c.code))

  const NewPlanFormat = {}
  for (const [keys, codes] of Object.entries(plan)) {
    const keySem = course_year_map[keys]
    if (!keySem) continue
    if (!NewPlanFormat[keySem]) NewPlanFormat[keySem] = []
    for (const code of codes) {
      NewPlanFormat[keySem].push(code)
      allPlanCodes.add(code)
    }
  }

  const extraOther = chains.filter(c =>
    !allPlanCodes.has(c.code) &&
    c.type2 !== 'OE' &&
    c.type2 !== 'ME' &&
    c.state === 'completed'
  )

  const termOrder = { fall: 1, win: 2, spr: 3, sum: 4 };
  
  const processedCompleted = [...(completed || [])]
    .filter(c => {
      if (!completedSearch.trim()) return true;
      const search = completedSearch.toLowerCase();
      return (
        c.code?.toLowerCase().includes(search) ||
        c.name?.toLowerCase().includes(search) ||
        c.grade?.toLowerCase().includes(search) ||
        c.term?.toLowerCase().includes(search) ||
        c.enrolledDate?.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => {
      let score = 0;

      if (completedSortKey === "date") {
        const yearA = parseInt(a.enrolledDate?.split("-")[0] || 0);
        const yearB = parseInt(b.enrolledDate?.split("-")[0] || 0);
        if (yearA !== yearB) {
          score = yearA - yearB;
        } else {
          score = (termOrder[a.term?.toLowerCase()] || 999) - (termOrder[b.term?.toLowerCase()] || 999);
        }
      } else if (completedSortKey === "name") {
        score = (a.name || "").localeCompare(b.name || "");
      } else if (completedSortKey === "code") {
        score = (a.code || "").localeCompare(b.code || "");
      } else if (completedSortKey === "credits") {
        score = (a.credits || 0) - (b.credits || 0);
      } else if (completedSortKey === "grade") {
        score = (a.grade || "").localeCompare(b.grade || "");
      }

      return isInverted ? -score : score;
    });

  return (
    <div ref={containerRef} className={s.canvasContainer}>

      <svg className={s.arrowSvg}>
        <defs>
          {['#28a745', '#0066cc'].map(color => (
            <marker key={color} id={`arrow-${color.replace('#','')}`}
              markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={color} />
            </marker>
          ))}
        </defs>
        
        {arrows.map((arrow, i) => (
          <path key={i} d={arrow.d} stroke={arrow.color} strokeWidth="2"
            fill="none" markerEnd={`url(#arrow-${arrow.color.replace('#','')})`} />
        ))}
      </svg>

      {renderTooltip()}

      {/* Main Flow Table Canvas Layout */}
      <table className={s.flowTable}>
        <thead>
          <tr>
            {year.map((value, i) => (
              <th 
                key={value.label} 
                colSpan={value.span} 
                className={`${s.yearHeaderCell} ${i < year.length - 1 ? s.yearHeaderCellBorder : ''}`}
              >
                {value.label.toUpperCase()}
              </th>
            ))}
          </tr>
          <tr>
            {SEMESTERS.map(value => (
              <th key={value.key} className={s.semesterHeaderCell}>
                {value.sem.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {SEMESTERS.map(value => {
              const isSummerCell = value.key === '2Sum' || value.key === '3Sum';
              return (
                <td 
                  key={value.key} 
                  className={isSummerCell ? s.flowCellSummer : s.flowCell}
                >
                  {(NewPlanFormat[value.key] || []).map((c, i) => {
                    const display     = getDisplayForCode(c)
                    const isHovered   = hoveredCode === display.code
                    const isPrereq    = prereqNodes.has(display.code)
                    const isUnlock    = unlockNodes.has(display.code)
                    const isAnyActive = isHovered || isPrereq || isUnlock

                    const stateClassMap = { completed: s.pillCompleted, in_progress: s.pillInProgress, locked: s.pillLocked };
                    const activeStateClass = stateClassMap[display.state] || s.pillLocked;

                    const pillClasses = [
                      s.coursePill,
                      activeStateClass,
                      isHovered ? s.pillHovered : '',
                      isPrereq ? s.pillPrereq : '',
                      isUnlock ? s.pillUnlock : '',
                      hoveredCode && !isAnyActive ? s.pillDimmed : ''
                    ].filter(Boolean).join(' ');

                    return (
                      <div
                        key={c + i}
                        ref={el => pillRefs.current[display.code] = el}
                        onMouseEnter={() => handleEnter(display.code)}
                        onMouseLeave={handleLeave}
                        className={pillClasses}
                      >
                        {display.code}
                      </div>
                    )
                  })}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>

      <div className={s.footerWrap}>

        {/* Legend */}
        <div className={s.legendGrid}>
          {LEGEND.map(({ state, label, extra }) => {
            const legendBoxClassMap = { completed: s.pillCompleted, in_progress: s.pillInProgress, locked: s.pillLocked };
            return (
              <div key={state} className={s.legendItem}>
                <div className={`${s.legendBox} ${legendBoxClassMap[state] || s.pillLocked}`} />
                <div className={s.legendTextGroup}>
                  <div className={s.legendLabel}>{label}</div>
                  <div className={s.legendSub}>{extra}</div>
                </div>
              </div>
            );
          })}
          {[
            { color: '#28a745', label: 'Prerequisite courses' },
            { color: '#0066cc', label: 'Unlocks these courses' },
          ].map(({ color, label }) => (
            <div key={label} className={s.legendItem}>
              <div className={s.legendBorderBox} style={{ border: `3px solid ${color}` }} />
              <div className={s.legendLabel}>{label}</div>
            </div>
          ))}
        </div>

        {/* Extra courses */}
        {[...extraOE, ...extraME, ...extraOther].length > 0 && (
          <div className={s.extraSection}>
            <div className={s.extraHeadingTitle}>Extra Courses</div>
            <div className={s.extraItemsRow}>
              {extraOE.map(c => {
                const stateClass = c.grade ? s.pillCompleted : s.pillInProgress;
                return (
                  <div key={c.code} className={`${s.extraItemCard} ${stateClass}`}>
                    {c.code} <span className={s.extraCategoryTag}>OE</span>
                  </div>
                );
              })}
              {extraME.map(c => {
                const stateClass = c.grade ? s.pillCompleted : s.pillInProgress;
                return (
                  <div key={c.code} className={`${s.extraItemCard} ${stateClass}`}>
                    {c.code} <span className={s.extraCategoryTag}>ME</span>
                  </div>
                );
              })}
              {extraOther.map(c => {
                const stateClassMap = { completed: s.pillCompleted, in_progress: s.pillInProgress, locked: s.pillLocked };
                return (
                  <div key={c.code} className={`${s.extraItemCard} ${stateClassMap[c.state] || s.pillLocked}`}>
                    {c.code}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── MAJOR ELECTIVES CHECKER TABLE ── */}
        <div className={s.dashboardSection}>
          <div className={s.dashboardHeaderBox}>
            <span className={s.dashboardMainTitle}>Major Track Electives Specialty Dashboard</span>
            <span className={s.dashboardSubTitle}>Verify required prerequisite pathways and trace specific chemical engine track milestone eligibility parameters.</span>
          </div>

          <div className={s.dashboardTableContainer}>
            <table className={s.dashboardTable}>
              <thead>
                <tr>
                  {['Specialty Track', 'Course Code', 'Course Title', 'Prerequisites Requirement Path', 'Prereqs Status', 'Enrollment Status'].map(h => (
                    <th key={h} className={s.dashboardTh}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {MejorElectiveList.map((course, idx) => {
                  const directPrereqs = prereqEdges?.[course.code] || [];
                  const holdsPrereqs = directPrereqs.length === 0 || directPrereqs.every(p => completedSet.has(p));
                  const isPassed = completedSet.has(course.code);
                  const isInProgress = inProgressSet.has(course.code);

                  return (
                    <tr key={course.code + idx}>
                      <td className={s.dashboardTd}>
                        <span className={s.dashboardTdTrackTag} style={{ background: course.theme.bg, color: course.theme.txt, border: `1px solid ${course.theme.bdr}` }}>
                          {course.theme.label}
                        </span>
                      </td>

                      <td className={`${s.dashboardTd} ${s.dashboardTdCode}`}>{course.code}</td>
                      <td className={`${s.dashboardTd} ${s.dashboardTdTitle}`}>{course.name}</td>
                      
                      <td className={s.dashboardTd}>
                        {directPrereqs.length === 0 ? (
                          <span className={s.dashboardPrereqEmptyText}>None</span>
                        ) : (
                          <div className={s.dashboardPrereqTokenContainer}>
                            {directPrereqs.map(p => {
                              const passed = completedSet.has(p);
                              return (
                                <span key={p} className={s.dashboardPrereqToken} style={{ background: passed ? '#d4edda' : '#f8d7da', color: passed ? '#155724' : '#721c24', border: passed ? '1px solid #c3e6cb' : '1px solid #f5c6cb' }}>
                                  {p}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      
                      <td className={s.dashboardTd}>
                        {directPrereqs.length === 0 ? (
                          <span className={s.dashboardStatusBadge} style={{ color: '#319795', background: '#e6fffa' }}>No Prereqs</span>
                        ) : holdsPrereqs ? (
                          <span className={s.dashboardStatusBadge} style={{ color: '#155724', background: '#d4edda', border: '1px solid #c3e6cb' }}>Ready</span>
                        ) : (
                          <span className={s.dashboardStatusBadge} style={{ color: '#721c24', background: '#f8d7da', border: '1px solid #f5c6cb' }}>Locked</span>
                        )}
                      </td>

                      <td className={s.dashboardTd}>
                        {isPassed ? (
                          <span className={s.dashboardEnrollmentStatusText} style={{ color: '#1a3a6a', background: '#ebf8ff', border: '1px solid #bee3f8' }}>PASSED</span>
                        ) : isInProgress ? (
                          <span className={s.dashboardEnrollmentStatusText} style={{ color: '#856404', background: '#fff3cd', border: '1px solid #ffeeba' }}>IN PROGRESS</span>
                        ) : holdsPrereqs ? (
                          <span className={s.dashboardEnrollmentStatusText} style={{ color: '#155724', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>ELIGIBLE</span>
                        ) : (
                          <span className={s.dashboardEnrollmentStatusText} style={{ color: '#4a5568', background: '#e2e3e5', opacity: 0.65 }}>LOCKED</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── COMPLETED COURSES TABLE (WITH CONTROL BAR) ── */}
        {completed?.length > 0 && (
          <div className={s.historySection}>
            <div className={s.historyHeadingTitle}>Student History : {processedCompleted.length} Completed Courses</div>

            {/* Interactive Controls */}
            <div className={s.historyControlsPanel}>
              <div className={s.historySearchWrapper}>
                <input 
                  type="text" 
                  placeholder="Search anything (Code, Name, Grade, Term, Year)..." 
                  value={completedSearch}
                  onChange={(e) => setCompletedSearch(e.target.value)}
                  className={s.historySearchField}
                />
              </div>
              <div>
                <select 
                  value={completedSortKey} 
                  onChange={(e) => setCompletedSortKey(e.target.value)}
                  className={s.historySelectField}
                >
                  <option value="date">Sort Option: Term & Year (Default)</option>
                  <option value="code">Sort Option: Course Code</option>
                  <option value="name">Sort Option: Course Title Name</option>
                  <option value="credits">Sort Option: Credit Hours</option>
                  <option value="grade">Sort Option: Performance Grade</option>
                </select>
              </div>
              <label className={s.historyLabelCheckbox}>
                <input 
                  type="checkbox" 
                  checked={isInverted} 
                  onChange={(e) => setIsInverted(e.target.checked)}
                  className={s.historyCheckboxInput}
                />
                Invert Ordering (Newest First / Descending)
              </label>
            </div>

            <div className={s.historyTableContainer}>
              <table className={s.historyTable}>
                <thead>
                  <tr>
                    {['Course Code', 'Official Course Title', 'Credits Earned', 'Final Grade', 'Academic Term', 'Enrollment Date', 'Category Key'].map(h => (
                      <th key={h} className={s.historyTh}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {processedCompleted.map((c, i) => (
                    <tr key={c.code + i}>
                      <td className={`${s.historyTd} ${s.historyTdCode}`}>{c.code}</td>
                      <td className={`${s.historyTd} ${s.historyTdName}`}>{c.name ?? '—'}</td>
                      <td className={`${s.historyTd} ${s.historyTdCredits}`}>{c.credits ?? '—'}</td>
                      <td className={`${s.historyTd} ${s.historyTdGrade}`}>{c.grade ?? '—'}</td>
                      <td className={`${s.historyTd} ${s.historyTdTerm}`}>{c.term ?? '—'}</td>
                      <td className={s.historyTd}>{c.enrolledDate  ?? '—'}</td>
                      <td className={`${s.historyTd} ${s.historyTdCategory}`}>{c.type2  ?? '—'}</td>
                    </tr>
                  ))}
                  {processedCompleted.length === 0 && (
                    <tr>
                      <td colSpan={7} className={s.historyEmptyMessageCell}>No matched completed courses found for your search query criteria.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <pre className={s.debugPre}>
          inProgress[0]: {JSON.stringify(inProgress?.[0], null, 2)}
          allOE length: {allOE.length}
          completed OE: {completed?.filter(c => c.type2 === 'OE').length}
          inProgress OE: {inProgress?.filter(c => c.type2 === 'OE').length}
        </pre>

      </div>
    </div>
  )
}