import s from './CurrentCourses.module.css'

export default function CurrentCourses({ courses, overrides, onToggle }) {
  return (
    <div className={s.wrap}>
      {courses.map(c => {
        const isPass = c.passFail

        return (
          <div key={c.code} className={s.row}>
            <div className={s.top}>
              <div className={s.name}>{c.name}</div>
              <div className={s.toggle}>
                <button
                  className={`${s.btn} ${isPass ? s.passActive : ''}`}
                  onClick={() => onToggle(c.code, true)}
                >Pass</button>
                <button
                  className={`${s.btn} ${!isPass ? s.failActive : ''}`}
                  onClick={() => onToggle(c.code, false)}
                >Fail</button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
