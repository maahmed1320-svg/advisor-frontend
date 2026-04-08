import s from './Recommendations.module.css'

// Map semester_offered to a human label
const SEM_LABEL = { spring: 'Spring only', fall: 'Fall only', both: null }

function ScoreDots({ score, max = 20 }) {
  // Show up to 5 filled dots proportional to score
  const filled = Math.min(5, Math.round((score / Math.max(max, 1)) * 5))
  return (
    <div className={s.dots}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={`${s.dot} ${i < filled ? s.dotFilled : ''}`} />
      ))}
      <span className={s.unlockTxt}>opens {score} courses</span>
    </div>
  )
}

export default function Recommendations({ recommendations, cart, onToggleCart }) {
  // Max score across non-blocked courses for dot scaling
  const maxScore = Math.max(1, ...recommendations.filter(r => !r.isBlocked).map(r => r.downstreamUnlocks))

  return (
    <div className={s.list}>
      {recommendations.map(r => {
        const inCart   = cart.some(c => c.code === r.code)
        const blocked  = r.isBlocked
        const semLabel = SEM_LABEL[r.semesterOffered]
        const urgent   = r.oncePerYear && r.offeredThisSemester

        // Build schedule line
        const scheduleParts = [r.days, r.timeSlot, r.room].filter(
          p => p && p !== 'TBA'
        )
        const schedule = scheduleParts.length ? scheduleParts.join(' · ') : null

        return (
          <div
            key={r.code}
            className={`${s.card} ${blocked ? s.blocked : ''} ${inCart ? s.inCart : ''}`}
            onClick={() => !blocked && onToggleCart(r.code)}
          >
            {inCart && <div className={s.check}>&#x2713;</div>}

            <div className={s.cardMain}>
              <div className={s.cardName}>{r.name}</div>
              <div className={s.cardMeta}>
                {r.code} &middot; {r.credits} cr
                {blocked && ' · blocked — prerequisite failing'}
                {!blocked && !r.prereqsMet && ' · prerequisites pending'}
              </div>
              {r.instructor && <div className={s.instructor}>{r.instructor}</div>}
              {schedule       && <div className={s.schedule}>{schedule}</div>}
            </div>

            <div className={s.tags}>
              {urgent && (
                <span className={`${s.tag} ${s.tagUrgent}`}>
                  {semLabel} — priority
                </span>
              )}
              {!urgent && semLabel && (
                <span className={`${s.tag} ${s.tagSem}`}>{semLabel}</span>
              )}
              {r.type === 'elective' && (
                <span className={`${s.tag} ${s.tagElec}`}>Elective</span>
              )}
              {r.type === 'gen_ed' && (
                <span className={`${s.tag} ${s.tagElec}`}>Gen Ed</span>
              )}
              {inCart && (
                <span className={`${s.tag} ${s.tagCart}`}>In cart</span>
              )}
            </div>

            <div className={s.footer}>
              <ScoreDots score={r.downstreamUnlocks} max={maxScore} />
              <span className={s.unlocks}>
                opens {r.downstreamUnlocks} course{r.downstreamUnlocks !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        )
      })}

      {recommendations.length === 0 && (
        <p className={s.empty}>All courses are completed or in progress.</p>
      )}
    </div>
  )
}
