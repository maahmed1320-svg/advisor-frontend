import { useState, useEffect, useRef } from "react"
import { STUDY_PLAN } from './Studyplans'

export default function Chains({ chains, coReqEdges, blockedCodes, prereqEdges, completed, inProgress }) {

  const [hoveredCode,   setHoveredCode]   = useState(null)
  const [prereqNodes,   setPrereqNodes]   = useState(new Set())
  const [unlockNodes,   setUnlockNodes]   = useState(new Set())
  const [arrows,        setArrows]        = useState([])
  const [tooltip,       setTooltip]       = useState(null)
  const pillRefs     = useRef({})
  const containerRef = useRef(null)

  // ── New State for Search, Filter, and Sort Control ───────
  const [completedSearch, setCompletedSearch] = useState("")
  const [completedSortKey, setCompletedSortKey] = useState("date") // date, code, name, credits, grade
  const [isInverted, setIsInverted] = useState(false)

  // ── Arrow drawing ─────────────────────────────────────────
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
  }, [hoveredCode])

  // ── Course data map ───────────────────────────────────────
  const chainMap = {}
  for (const c of chains) chainMap[c.code] = c

  // ── Styles ────────────────────────────────────────────────
  const STATE_STYLE = {
    completed:   { background: '#d4edda', border: '1px solid #28a745', color: '#155724' },
    in_progress: { background: '#fff3cd', border: '1px solid #856404', color: '#856404' },
    locked:      { background: '#e2e3e5', border: '1px solid #6c757d', color: '#6c757d' },
  }

  const LEGEND = [
    { state: 'completed',   label: 'Completed',   extra: 'Course passed' },
    { state: 'in_progress', label: 'In Progress', extra: 'Currently enrolled' },
    { state: 'locked',      label: 'For the future',      extra: 'Available/Locked' },
  ]

  // ── OE / ME from completed and inProgress lists ───────────
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

  // ── Recursive prereqs ─────────────────────────────────────
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

  // ── Hover handlers ────────────────────────────────────────
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

  // ── Pill overlay ──────────────────────────────────────────
  const getPillOverlay = (code) => {
    if (hoveredCode === code)  return { outline: '3px solid #333',    outlineOffset: 2 }
    if (prereqNodes.has(code)) return { outline: '3px solid #28a745', outlineOffset: 2 }
    if (unlockNodes.has(code)) return { outline: '3px solid #0066cc', outlineOffset: 2 }
    return {}
  }

  const renderTooltip = () => {
    if (!tooltip) return null
    
    const display = chainMap[tooltip] 
      || completed?.find(c => c.code === tooltip)
      || inProgress?.find(c => c.code === tooltip)
      || { code: tooltip, state: 'locked' }

    const state = display.state 
      ?? (display.grade ? 'completed' : 'in_progress')

    const stateLabel = {
      completed:   display.grade ? `Grade: ${display.grade}` : 'Completed',
      in_progress: 'Currently enrolled',
      locked:      'Locked — prerequisites not met',
    }

    return (
      <div style={{
        position: 'fixed', bottom: 32, left: '50%',
        transform: 'translateX(-50%)',
        background: '#fff', border: '1px solid #ddd',
        borderRadius: 10, padding: '10px 20px', fontSize: 13,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        zIndex: 9999, pointerEvents: 'none',
        minWidth: 160, maxWidth: 260,
        textAlign: 'center', lineHeight: 1.6,
      }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{display.code}</div>
        {(display.title || display.name) && (
          <div style={{ color: '#444', fontSize: 12, marginBottom: 4 }}>
            {display.title || display.name}
          </div>
        )}
        <div style={{ fontSize: 12, fontWeight: 500, color: STATE_STYLE[state]?.color || '#6c757d' }}>
          {stateLabel[state] || state}
        </div>
      </div>
    )
  }

  // ── Study plan ────────────────────────────────────────────
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

  // Major Elective List
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

  // ── Filter & Sort Logic Computation for Completed Courses ──
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
    <div ref={containerRef} style={{ overflowX: 'auto', padding: '1rem', position: 'relative' }}>

      <svg style={{
        position: 'absolute', top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 10, overflow: 'visible',
      }}>
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
      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
        <thead>
          <tr>
            {year.map((value, i) => (
              <th key={value.label} colSpan={value.span} style={{
                textAlign: 'center', padding: '16px 4px 24px',
                borderBottom: '2px solid #ccc',
                borderRight: i < year.length - 1 ? '2px solid #ccc' : 'none',
                fontSize: 18, fontWeight: 600,
              }}>
                {value.label.toUpperCase()}
              </th>
            ))}
          </tr>
          <tr>
            {SEMESTERS.map(value => (
              <th key={value.key} style={{
                textAlign: 'center', padding: '10px 8px',
                background: '#f5f5f5', border: '1px solid #ddd',
                fontSize: 18, color: '#555',
              }}>
                {value.sem.toUpperCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {SEMESTERS.map(value => (
              <td key={value.key} style={{
                verticalAlign: value.key === '2Sum' || value.key === '3Sum' ? 'middle' : 'top',
                padding: '44px 8px', border: '1px solid #eee', minWidth: 120,
                textAlign: value.key === '2Sum' || value.key === '3Sum' ? 'center' : 'left',
              }}>
                {(NewPlanFormat[value.key] || []).map((c, i) => {
                  const display     = getDisplayForCode(c)
                  const isHovered   = hoveredCode === display.code
                  const isPrereq    = prereqNodes.has(display.code)
                  const isUnlock    = unlockNodes.has(display.code)
                  const isAnyActive = isHovered || isPrereq || isUnlock

                  return (
                    <div
                      key={c + i}
                      ref={el => pillRefs.current[display.code] = el}
                      onMouseEnter={() => handleEnter(display.code)}
                      onMouseLeave={handleLeave}
                      style={{
                        ...(STATE_STYLE[display.state] || STATE_STYLE.locked),
                        ...getPillOverlay(display.code),
                        borderRadius: 6, padding: '13px 10px',
                        margin: '25px 25px', textAlign: 'center',
                        fontSize: 16, fontWeight: 500,
                        cursor: 'pointer', transition: '0.2s',
                        filter:    hoveredCode && !isAnyActive ? 'blur(2px)' : 'none',
                        opacity:   hoveredCode && !isAnyActive ? 0.35 : 1,
                        transform: isHovered ? 'scale(1.05)' : isAnyActive ? 'scale(1.02)' : 'scale(1)',
                      }}
                    >
                      {display.code}
                    </div>
                  )
                })}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <footer style={{ marginTop: 24, padding: '16px', borderTop: '1px solid #eee' }}>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {LEGEND.map(({ state, label, extra }) => (
            <div key={state} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ ...STATE_STYLE[state], width: 32, height: 20, borderRadius: 4, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>{label}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{extra}</div>
              </div>
            </div>
          ))}
          {[
            { color: '#28a745', label: 'Prerequisite courses' },
            { color: '#0066cc', label: 'Unlocks these courses' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 20, borderRadius: 4, border: `3px solid ${color}`, background: '#fff' }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Extra courses */}
        {[...extraOE, ...extraME, ...extraOther].length > 0 && (
          <div style={{ marginTop: 20, borderTop: '1px solid #eee', paddingTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#555' }}>
              Extra Courses
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {extraOE.map(c => (
                <div key={c.code} style={{ ...(STATE_STYLE[c.grade ? 'completed' : 'in_progress'] || STATE_STYLE.locked), borderRadius: 6, padding: '6px 12px', fontSize: 13 }}>
                  {c.code} <span style={{ fontSize: 11, opacity: 0.7 }}>OE</span>
                </div>
              ))}
              {extraME.map(c => (
                <div key={c.code} style={{ ...(STATE_STYLE[c.grade ? 'completed' : 'in_progress'] || STATE_STYLE.locked), borderRadius: 6, padding: '6px 12px', fontSize: 13 }}>
                  {c.code} <span style={{ fontSize: 11, opacity: 0.7 }}>ME</span>
                </div>
              ))}
              {extraOther.map(c => (
                <div key={c.code} style={{ ...(STATE_STYLE[c.state] || STATE_STYLE.locked), borderRadius: 6, padding: '6px 12px', fontSize: 13 }}>
                  {c.code}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MAJOR ELECTIVES CHECKER TABLE ── */}
        <div style={{ marginTop: 48, borderTop: '3px solid #1a3a6a', paddingTop: 24 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: 20 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#1a3a6a', letterSpacing: '-0.3px' }}>
              🔬 Major Track Electives Specialty Dashboard
            </span>
            <span style={{ fontSize: 14, color: '#4a5568', fontWeight: '500' }}>
              Verify required prerequisite pathways and trace specific chemical engine track milestone eligibility parameters.
            </span>
          </div>

          <div style={{ overflowX: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.04)', borderRadius: '8px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, minWidth: 1000, background: '#fff', border: '1px solid #cbd5e0' }}>
              <thead>
                <tr style={{ background: '#edf2f7', borderBottom: '3px solid #cbd5e0' }}>
                  {['Specialty Track', 'Course Code', 'Course Title', 'Prerequisites Requirement Path', 'Prereqs Status', 'Enrollment Status'].map(h => (
                    <th key={h} style={{ padding: '16px 20px', textAlign: 'left', fontWeight: 700, color: '#2d3748', fontSize: 15 }}>
                      {h}
                    </th>
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
                    <tr key={course.code + idx} style={{ background: idx % 2 === 0 ? '#fff' : '#f7fafc', borderBottom: '1px solid #e2e8f0', transition: 'background 0.15s' }}>
                      <td style={{ padding: '16px 20px', verticalAlign: 'middle' }}>
                        <span style={{ 
                          fontSize: '13px', 
                          fontWeight: '700', 
                          padding: '6px 14px', 
                          borderRadius: '20px', 
                          background: course.theme.bg, 
                          color: course.theme.txt,
                          border: `1px solid ${course.theme.bdr}`,
                          display: 'inline-block',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px'
                        }}>
                          {course.theme.label}
                        </span>
                      </td>

                      <td style={{ padding: '16px 20px', fontWeight: 800, color: '#1a3a6a', fontFamily: 'monospace', fontSize: '16px' }}>{course.code}</td>
                      <td style={{ padding: '16px 20px', color: '#2d3748', fontWeight: 600, fontSize: '15px' }}>{course.name}</td>
                      
                      <td style={{ padding: '16px 20px' }}>
                        {directPrereqs.length === 0 ? (
                          <span style={{ color: '#a0aec0', fontStyle: 'italic', fontSize: '14px' }}>None</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {directPrereqs.map(p => {
                              const passed = completedSet.has(p);
                              return (
                                <span key={p} style={{ 
                                  fontSize: '12px', 
                                  padding: '4px 10px', 
                                  borderRadius: '4px', 
                                  fontFamily: 'monospace',
                                  fontWeight: '700',
                                  background: passed ? '#d4edda' : '#f8d7da',
                                  color: passed ? '#155724' : '#721c24',
                                  border: passed ? '1px solid #c3e6cb' : '1px solid #f5c6cb',
                                }}>
                                  {p}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      
                      <td style={{ padding: '16px 20px' }}>
                        {directPrereqs.length === 0 ? (
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#319795', background: '#e6fffa', padding: '4px 12px', borderRadius: '12px' }}>No Prereqs</span>
                        ) : holdsPrereqs ? (
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#155724', background: '#d4edda', padding: '4px 12px', borderRadius: '12px', border: '1px solid #c3e6cb' }}>Ready</span>
                        ) : (
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#721c24', background: '#f8d7da', padding: '4px 12px', borderRadius: '12px', border: '1px solid #f5c6cb' }}>Locked</span>
                        )}
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        {isPassed ? (
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#1a3a6a', background: '#ebf8ff', padding: '6px 14px', borderRadius: '4px', border: '1px solid #bee3f8', display: 'inline-block', width: '100px', textAlign: 'center' }}>PASSED</span>
                        ) : isInProgress ? (
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#856404', background: '#fff3cd', padding: '6px 14px', borderRadius: '4px', border: '1px solid #ffeeba', display: 'inline-block', width: '100px', textAlign: 'center' }}>IN PROGRESS</span>
                        ) : holdsPrereqs ? (
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#155724', background: '#f0fdf4', padding: '6px 14px', borderRadius: '4px', border: '1px solid #bbf7d0', display: 'inline-block', width: '100px', textAlign: 'center' }}>ELIGIBLE</span>
                        ) : (
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#4a5568', background: '#e2e3e5', padding: '6px 14px', borderRadius: '4px', opacity: 0.65, display: 'inline-block', width: '100px', textAlign: 'center' }}>LOCKED</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 📊 COMPLETED COURSES TABLE (WITH CONTROL BAR) ── */}
        {completed?.length > 0 && (
          <div style={{ marginTop: 48, borderTop: '2px solid #cbd5e0', paddingTop: 24 }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: '#2d3748' }}>
              📚 Student History : {processedCompleted.length} Completed Courses 
            </div>

            {/* Interactive Search, Filter & Ordering Dashboard Controls */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: '1', minWidth: '260px' }}>
                <input 
                  type="text" 
                  placeholder="🔍 Search anything (Code, Name, Grade, Term, Year)..." 
                  value={completedSearch}
                  onChange={(e) => setCompletedSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '14px', outline: 'none' }}
                />
              </div>
              <div>
                <select 
                  value={completedSortKey} 
                  onChange={(e) => setCompletedSortKey(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '14px', background: '#fff', fontWeight: 600, color: '#4a5568', cursor: 'pointer' }}
                >
                  <option value="date">Sort Option: Term & Year (Default)</option>
                  <option value="code">Sort Option: Course Code</option>
                  <option value="name">Sort Option: Course Title Name</option>
                  <option value="credits">Sort Option: Credit Hours</option>
                  <option value="grade">Sort Option: Performance Grade</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600, color: '#4a5568', cursor: 'pointer', userSelect: 'none' }}>
                <input 
                  type="checkbox" 
                  checked={isInverted} 
                  onChange={(e) => setIsInverted(e.target.checked)}
                  style={{ width: '17px', height: '17px', cursor: 'pointer' }}
                />
                Invert Ordering (Newest First / Descending)
              </label>
            </div>

            <div style={{ overflowX: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15, minWidth: 950, border: '1px solid #cbd5e0' }}>
                <thead>
                  <tr style={{ background: '#edf2f7', borderBottom: '2px solid #cbd5e0' }}>
                    {['Course Code', 'Official Course Title', 'Credits Earned', 'Final Grade', 'Academic Term', 'Enrollment Date', 'Category Key'].map(h => (
                      <th key={h} style={{ padding: '14px 18px', textAlign: 'left', border: '1px solid #cbd5e0', fontWeight: 700, color: '#4a5568', fontSize: '15px' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {processedCompleted.map((c, i) => (
                    <tr key={c.code + i} style={{ background: i % 2 === 0 ? '#fff' : '#f7fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '14px 18px', border: '1px solid #e2e8f0', fontWeight: 700, color: '#1a3a6a', fontFamily: 'monospace', fontSize: '15px' }}>{c.code}</td>
                      <td style={{ padding: '14px 18px', border: '1px solid #e2e8f0', color: '#2d3748', fontWeight: 500 }}>{c.name ?? '—'}</td>
                      <td style={{ padding: '14px 18px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '600' }}>{c.credits ?? '—'}</td>
                      <td style={{ padding: '14px 18px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 800, color: '#2f855a', fontSize: '16px' }}>{c.grade ?? '—'}</td>
                      <td style={{ padding: '14px 18px', border: '1px solid #e2e8f0', color: '#4a5568', fontWeight: '500' }}>{c.term ?? '—'}</td>
                      <td style={{ padding: '14px 18px', border: '1px solid #e2e8f0', color: '#718096' }}>{c.enrolledDate  ?? '—'}</td>
                      <td style={{ padding: '14px 18px', border: '1px solid #e2e8f0', color: '#2b6cb0', fontWeight: '600', fontFamily: 'monospace' }}>{c.type2  ?? '—'}</td>
                    </tr>
                  ))}
                  {processedCompleted.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#a0aec0', fontStyle: 'italic' }}>
                        No matched completed courses found for your search query criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <pre style={{ fontSize: 10, background: '#ffe', padding: 8, marginBottom: 8, marginTop: 24 }}>
          inProgress[0]: {JSON.stringify(inProgress?.[0], null, 2)}
          allOE length: {allOE.length}
          completed OE: {completed?.filter(c => c.type2 === 'OE').length}
          inProgress OE: {inProgress?.filter(c => c.type2 === 'OE').length}
        </pre>

      </footer>
    </div>
  )
}