import s from './Completed.module.css'

export default function Completed({ courses }) {
  if (!courses.length) return (
    <p style={{ fontSize: 12, color: 'var(--gray-400)', fontStyle: 'italic' }}>
      No completed courses yet.
    </p>
  )

  return (
    <div className={s.wrap}>
      {courses.map(c => (
        <div key={c.code} className={s.row}>
          <div className={s.dot} />
          <div>
            <div className={s.name}>{c.name}</div>
            <div className={s.meta}>{c.code}{c.term ? ` · ${c.term}` : ''}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
