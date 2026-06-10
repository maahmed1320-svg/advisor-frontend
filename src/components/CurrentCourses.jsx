import s from './CurrentCourses.module.css'

export default function CurrentCourses({ courses = [], overrides = {}, onToggle }) {
  return (
    <div className={s.wrap}>
      {courses.map(c => {
        // 💡 Check if an override exists in state first, otherwise fall back to database value
        const currentStatus = overrides[c.code] !== undefined ? overrides[c.code] : c.passFail;
        
        const isPass = currentStatus === true;
        const isFail = currentStatus === false;

        return (
          <div key={c.code} className={s.row}>
            <div className={s.name}>{c.code} - {c.name}</div>
            <div className={s.toggle}>
              <button
                className={`${s.btn} ${isPass ? s.passActive : ''}`}
                onClick={() => onToggle(c.code, true)}
              >
                Pass
              </button>
              <button
                className={`${s.btn} ${isFail ? s.failActive : ''}`}
                onClick={() => onToggle(c.code, false)}
              >
                Fail
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}