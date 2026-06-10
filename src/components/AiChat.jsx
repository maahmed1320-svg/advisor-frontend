import { useState, useRef, useEffect } from 'react'
import s from './AiChat.module.css'

const BASE = import.meta.env.VITE_API_URL ?? ''

// 💡 NEW LOGIC: Flattened specialty list array for quick lookups
const MejorElectiveList = [
  { code: "CME460", name: "Natural Gas Processing", track: "Gas Processing & Petrochemicals" },
  { code: "CME461", name: "Petroleum Refining Process", track: "Gas Processing & Petrochemicals" },
  { code: "CME462", name: "Chemical Process Industries", track: "Gas Processing & Petrochemicals" },
  { code: "CME463", name: "Corrosion Engineer", track: "Gas Processing & Petrochemicals" },
  { code: "CME464", name: "Chemical Process Safety", track: "Gas Processing & Petrochemicals" },
  { code: "CME465", name: "Process Heat Transfer", track: "Gas Processing & Petrochemicals" },
  { code: "CME470", name: "Introduction To Polymer Science And Technology", track: "Polymer & Materials" },
  { code: "CME471", name: "Polymer Chemistry And Reaction Engineering", track: "Polymer & Materials" },
  { code: "CME472", name: "Polymer properties, testing and characterization", track: "Polymer & Materials" },
  { code: "CME473", name: "Polymer Processing And Materials Design", track: "Polymer & Materials" },
  { code: "CME480", name: "Water Technology And Membrane Processes", track: "Water Treatments & Desalination" },
  { code: "CME481", name: "Thermal Desalination", track: "Water Treatments & Desalination" },
  { code: "CME482", name: "Membrane Desalination", track: "Water Treatments & Desalination" },
  { code: "CME483", name: "Industrial Wastewater Treatment", track: "Water Treatments & Desalination" },
  { code: "CME484", name: "Industrial Water Pollution And Control", track: "Water Treatments & Desalination" },
  { code: "CME490", name: "Chemical Engineering Biology", track: "Biotechnology" },
  { code: "CME491", name: "Biochemical Engineering", track: "Biotechnology" },
  { code: "CME492", name: "Biochemical Treatment", track: "Biotechnology" },
  { code: "CME493", name: "Biofuels Technology", track: "Biotechnology" },
]

function formatGroupedMeetings(recCourse) {
  // Read section array strings dynamically out of recommendations
  const sections = recCourse.sections || [];
  if (sections.length === 0) return 'No section time schedules available';

  return sections.map((sec, idx) => {
    const days = [];
    if (sec.Mon) days.push('Mon');
    if (sec.Tues) days.push('Tues');
    if (sec.Wed) days.push('Wed');
    if (sec.Thurs) days.push('Thurs');
    if (sec.Fri) days.push('Fri');
    const dayStr = days.length > 0 ? days.join('/') : 'TBA';
    const timeStr = sec.mtg_start && sec.mtg_end ? `${sec.mtg_start.slice(0,5)}-${sec.mtg_end.slice(0,5)}` : 'TBA';
    
    return `   [Section Nbr: ${sec.class_nbr || 'TBA'}] ${dayStr} @ ${timeStr} (${sec.campus || 'AD'} Campus, Rm: ${sec.room || 'TBA'}) - Instructor: ${sec.first_name ?? ''} ${sec.last_name ?? ''}`;
  }).join('\n');
}

function buildSystemPrompt(student, inProgress, completed, recommendations, prereqEdges) {
  const available = recommendations.filter(r => r.prereqsMet && !r.isBlocked)
  const locked    = recommendations.filter(r => !r.prereqsMet && !r.isBlocked)
  const remaining = (student.requiredCredits ?? 136) - (student.totalCreditsPassed ?? 0)
  
  const completedSet = new Set((completed || []).map(c => c.code));

  // Build the context string for the 19 major electives and their prerequisites
  const majorElectivesContext = MejorElectiveList.map(m => {
    const prereqs = prereqEdges?.[m.code] || [];
    const isPassed = completedSet.has(m.code);
    const prereqsFulfilled = prereqs.length === 0 || prereqs.every(p => completedSet.has(p));
    const prereqListStr = prereqs.length > 0 ? prereqs.join(', ') : 'None';
    return `- ${m.code}: ${m.name} (${m.track})\n  * Prerequisites: ${prereqListStr} | Prereqs Met: ${prereqsFulfilled ? 'YES' : 'NO'} | Course Passed: ${isPassed ? 'YES' : 'NO'}`;
  }).join('\n');

  return `You are an expert academic advisor assistant for a university student.
Here is the student's comprehensive academic profile and timetable framework (names are kept private for privacy):

ACADEMIC METRICS:
- Major: ${student.major}
- Plan Layout ID: ${student.chainKey}
- Current CGPA: ${student.cgpa ?? '—'}
- Active Campus Base: ${student.campus ?? '—'}
- Admission Term Group: ${student.admitTerm ?? '—'}
- Registration Status: ${student.status ?? '—'}
- Total Passed Courses: ${completed.length} passed
- Total Credits Completed: ${student.totalCreditsPassed ?? 0} / ${student.requiredCredits ?? 136} required
- Remaining Credits Left: ${remaining} cr

CURRENTLY ENROLLED / PASSING COURSES (${inProgress.length} items):
${inProgress.map(c => `- ${c.code}: ${c.name} (Academic Prediction Slates: ${c.prediction || 'Stable'})`).join('\n') || '- None'}

COMPLETED COURSES WITH OFFICIAL HISTORICAL GRADES (${completed.length} entries):
${completed.map(c => `- ${c.code}: ${c.name} [Grade Earned: ${c.grade ?? 'Passed'}] (Term: ${c.term ?? '—'})`).join('\n') || '- None'}

RECOMMENDED / AVAILABLE COURSES FOR NEXT ENROLLMENT (${available.length} options — Prereqs Satisfied):
${available.map(r => `- ${r.code}: ${r.name} (${r.credits} cr) — Unlocks: ${r.downstreamUnlocks} future courses\n${formatGroupedMeetings(r)}`).join('\n') || '- None available this semester'}

LOCKED CHECKLIST TARGETS (Prerequisites Pending):
${locked.slice(0, 10).map(r => `- ${r.code}: ${r.name} — Missing Prerequisite Chain Requirements: ${r.missingPrereqs?.join(', ')}`).join('\n') || '- None'}

🔬 MAJOR SPECIALTY TRACK ELECTIVES BLUEPRINT & PREREQUISITE MATRIX:
${majorElectivesContext}

Your role:
1. Help the student analyze their current parameters, explain prerequisite blocks, and outline elective paths.
2. If the student asks about scheduling, cross-reference day and time parameters from the RECOMMENDED section.
3. Be professional, friendly, and practical. Never reveal or guess the student's name.`
}

function renderText(text) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : <span key={i}>{part}</span>
  )
}

export default function AiChat({ student, inProgress, completed, recommendations, prereqEdges }) {
  if (!student || !inProgress || !completed || !recommendations) return null

  const [open,     setOpen]     = useState(false)
  const [messages, setMessages] = useState([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100) }, [open])

  useEffect(() => {
    if (open && messages.length === 0) {
      const available = recommendations.filter(r => r.prereqsMet && !r.isBlocked)
      const atRisk    = inProgress.filter(c => !c.passFail)
      setMessages([{
        role: 'assistant',
        content:
          `Hi! I'm your academic advisor AI assistant. I have reviewed your profile — ${student.major}, CGPA ${student.cgpa ?? '—'}, ${student.totalCreditsPassed ?? 0} credits completed.\n\nYou have **${available.length} courses available** with active schedules ready for next semester enrollment.${atRisk.length > 0 ? `\n\n⚠️ **${atRisk.length} course${atRisk.length > 1 ? 's are' : ' is'} currently flagged at risk** — let's look over your study options.` : ''}\n\nHow can I assist you with your curriculum path today?`,
      }])
    }
  }, [open])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    const newMessages = [...messages, { role: 'user', content: text }]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: buildSystemPrompt(student, inProgress, completed, recommendations, prereqEdges),
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'API error')
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Something went wrong: ${e.message}. Please try again.`,
      }])
    } finally { setLoading(false) }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <>
      <button
        className={`${s.fab} ${open ? s.fabOpen : ''}`}
        onClick={() => setOpen(o => !o)}
        title="AI Academic Advisor"
      >
        {open ? '✕' : '💬'}
      </button>

      {open && (
        <div className={s.panel}>
          <div className={s.header}>
            <div className={s.headerIcon}>🎓</div>
            <div>
              <div className={s.headerTitle}>Academic Advisor AI</div>
              <div className={s.headerSub}>Ask me about your study plan</div>
            </div>
            <button className={s.closeBtn} onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className={s.messages}>
            {messages.map((msg, i) => (
              <div key={i} className={`${s.msg} ${msg.role === 'user' ? s.msgUser : s.msgBot}`}>
                {msg.role === 'assistant' && <div className={s.botIcon}>🎓</div>}
                <div className={s.bubble}>
                  {msg.content.split('\n').map((line, j) => (
                    <p key={j} style={{ margin: j > 0 ? '5px 0 0' : 0 }}>{renderText(line)}</p>
                  ))}
                </div>
              </div>
            ))}
            {loading && (
              <div className={`${s.msg} ${s.msgBot}`}>
                <div className={s.botIcon}>🎓</div>
                <div className={`${s.bubble} ${s.typing}`}>
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className={s.inputRow}>
            <textarea
              ref={inputRef}
              className={s.input}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about courses, CGPA, what to take next…"
              rows={2}
            />
            <button
              className={s.sendBtn}
              onClick={sendMessage}
              disabled={!input.trim() || loading}
            >→</button>
          </div>
        </div>
      )}
    </>
  )
}