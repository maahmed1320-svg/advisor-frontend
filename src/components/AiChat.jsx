import { useState, useRef, useEffect } from 'react'
import s from './AiChat.module.css'
const API_DOMAIN = import.meta.env.VITE_API_URL || "localhost:3001";
const BASE = API_DOMAIN.startsWith("http") 
  ? API_DOMAIN 
  : `https://${API_DOMAIN}`;

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
  const sections = recCourse.sections || [];
  if (sections.length === 0) return 'No section time schedules available';

  return sections.map((sec) => {
    const days = [];
    if (sec.Mon) days.push('Mon');
    if (sec.Tues) days.push('Tues');
    if (sec.Wed) days.push('Wed');
    if (sec.Thurs) days.push('Thurs');
    if (sec.Fri) days.push('Fri');
    const dayStr = days.length > 0 ? days.join('/') : 'TBA';
    const timeStr = sec.mtg_start && sec.mtg_end ? `${sec.mtg_start.slice(0,5)}-${sec.mtg_end.slice(0,5)}` : 'TBA';
    
    // 💡 UPDATED: Added SESSION/TERM tag so AI knows when this course happens
    return `   [Section: ${sec.section || 'TBA'}] TERM: ${sec.session || 'Regular'} | ${dayStr} @ ${timeStr} (${sec.campus || 'AD'})`;
  }).join('\n');
}
function buildSystemPrompt(student, inProgress, completed, recommendations, prereqEdges) {
  const available = recommendations.filter(r => r.prereqsMet && !r.isBlocked)
  const locked    = recommendations.filter(r => !r.prereqsMet && !r.isBlocked)
  const remaining = (student.requiredCredits ?? 136) - (student.totalCreditsPassed ?? 0)
  
  const completedSet = new Set((completed || []).map(c => c.code));

  const completedCoursesList = (completed || [])
    .map(c => `- ${c.code}: ${c.name} (${c.credits ?? 0} cr) | Grade: ${c.grade ?? 'N/A'}`)
    .join('\n') || '- None';

  const majorElectivesContext = MejorElectiveList.map(m => {
    const prereqs = prereqEdges?.[m.code] || [];
    const isPassed = completedSet.has(m.code);
    const prereqsFulfilled = prereqs.length === 0 || prereqs.every(p => completedSet.has(p));
    const prereqListStr = prereqs.length > 0 ? prereqs.join(', ') : 'None';

    return `- ${m.code}: ${m.name} (${m.track})\n  * Prerequisites: ${prereqListStr} | Prereqs Met: ${prereqsFulfilled ? 'YES' : 'NO'} | Course Passed: ${isPassed ? 'YES' : 'NO'}`;
  }).join('\n');

  return `You are an expert academic advisor assistant for a university student.
  
  PREREQUISITE MAP (Course Code -> Array of Prerequisite Codes):
  ${JSON.stringify(prereqEdges, null, 2)}

  ACADEMIC METRICS:
  - Major: ${student.major} | CGPA: ${student.cgpa ?? '—'} | Remaining Credits: ${remaining} cr

  COMPLETED COURSES & GRADES:
  ${completedCoursesList}

  CURRENTLY ENROLLED:
  ${inProgress.map(c => `- ${c.code}: ${c.name}`).join('\n') || '- None'}

  AVAILABLE COURSES (Prereqs Satisfied):
  ${available.map(r => `- ${r.code}: ${r.name} (${r.credits} cr)\n${formatGroupedMeetings(r)}`).join('\n') || '- None available'}

  🔬 MAJOR SPECIALTY TRACK ELECTIVES:
  ${majorElectivesContext}

  YOUR INSTRUCTIONS:
  1. Only recommend courses from the "AVAILABLE COURSES" list.
  2. If the user asks for "Summer" courses, ONLY suggest courses where the TERM includes 'SUM'. 
  3. Use the PREREQUISITE MAP to explain why a course might be locked.
  4. Be professional and practical.`
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
      setMessages([{
        role: 'assistant',
        content: `Hi! I'm your AI advisor. I have your academic history and current major requirements loaded. How can I assist you with your study plan today?`,
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

      const contentType = res.headers.get("content-type");
      const data = (contentType && contentType.includes("application/json")) 
        ? await res.json() 
        : null;

      if (!res.ok) throw new Error(data?.error || `Server error: ${res.status}`);

      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}` }])
    } finally { setLoading(false) }
  }
  
  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <>
      <button className={`${s.fab} ${open ? s.fabOpen : ''}`} onClick={() => setOpen(o => !o)} title="AI Academic Advisor">
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
                <div className={`${s.bubble} ${s.typing}`}><span /><span /><span /></div>
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
              placeholder="Ask about Summer courses..."
              rows={2}
            />
            <button className={s.sendBtn} onClick={sendMessage} disabled={!input.trim() || loading}>→</button>
          </div>
        </div>
      )}
    </>
  )
}