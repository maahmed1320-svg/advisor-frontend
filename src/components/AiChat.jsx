import { useState, useRef, useEffect } from 'react'
import s from './AiChat.module.css'

const BASE = import.meta.env.VITE_API_URL ?? ''

function buildSystemPrompt(student, inProgress, completed, recommendations) {
  const available = recommendations.filter(r => r.prereqsMet && !r.isBlocked)
  const locked    = recommendations.filter(r => !r.prereqsMet && !r.isBlocked)
  return `You are an academic advisor assistant for a university student.
Here is the student's current academic profile (names are kept private for privacy):

ACADEMIC STATUS:
- Major: ${student.major}
- Current Semester: ${student.semester}
- GPA: ${student.gpa} (trend: ${student.gpaTrend >= 0 ? '+' : ''}${student.gpaTrend} this semester)
- Earned Credits: ${student.earnedCredits} / ${student.requiredCredits} required
- Credits Remaining: ${student.requiredCredits - student.earnedCredits}

CURRENTLY ENROLLED (${inProgress.length} courses):
${inProgress.map(c => `- ${c.code}: ${c.name}`).join('\n') || '- None'}

COMPLETED COURSES (${completed.length} total):
${completed.map(c => `- ${c.code}: ${c.name}`).join('\n') || '- None'}

AVAILABLE TO ENROLL NOW (${available.length} courses — prereqs met):
${available.map(r => `- ${r.code}: ${r.name} (${r.credits} cr) — unlocks ${r.downstreamUnlocks} future courses`).join('\n') || '- None available this semester'}

LOCKED COURSES (prereqs not yet met):
${locked.slice(0, 8).map(r => `- ${r.code}: ${r.name} — needs: ${r.missingPrereqs?.join(', ')}`).join('\n') || '- None'}

Your role: Help the student understand their academic progress, explain prerequisites, suggest which courses to prioritize, warn about risks, and answer questions about their study plan. Be concise, friendly, and practical. Never reveal or guess the student's name.`
}

function renderText(text) {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2,-2)}</strong>
      : <span key={i}>{part}</span>
  )
}

export default function AiChat({ student, inProgress, completed, recommendations }) {
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
      setMessages([{ role: 'assistant', content:
        `Hi! I'm your academic advisor assistant. I can see your full profile — Semester ${student.semester} of ${student.major}, GPA ${student.gpa}, ${student.earnedCredits} credits completed.\n\nYou have **${available.length} courses available** to enroll in this semester.${atRisk.length > 0 ? `\n\n⚠️ **${atRisk.length} course${atRisk.length>1?'s are':' is'} at risk** — let's talk about that.` : ''}\n\nHow can I help you today?`
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
          systemPrompt: buildSystemPrompt(student, inProgress, completed, recommendations),
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'API error')
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}. Make sure ANTHROPIC_API_KEY is set in Railway backend variables.` }])
    } finally { setLoading(false) }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  return (
    <>
      <button className={`${s.fab} ${open ? s.fabOpen : ''}`}
        onClick={() => setOpen(o => !o)} title="AI Academic Advisor">
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
                    <p key={j} style={{margin: j > 0 ? '5px 0 0' : 0}}>{renderText(line)}</p>
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
            <textarea ref={inputRef} className={s.input} value={input}
              onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder="Ask about courses, GPA, what to take next…" rows={2} />
            <button className={s.sendBtn} onClick={sendMessage}
              disabled={!input.trim() || loading}>→</button>
          </div>
        </div>
      )}
    </>
  )
}
