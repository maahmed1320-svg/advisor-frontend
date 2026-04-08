const BASE = import.meta.env.VITE_API_URL ?? ''

export async function fetchStudent(id, overrides = {}, semester = 'spring') {
  const ovStr = Object.entries(overrides)
    .map(([k, v]) => `${k}:${v ? 'pass' : 'fail'}`)
    .join(',')
  const params = new URLSearchParams({ semester })
  if (ovStr) params.set('overrides', ovStr)
  const res = await fetch(`${BASE}/api/student/${id}?${params}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function submitCart(studentId, courses, term) {
  const res = await fetch(`${BASE}/api/cart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_id: studentId, courses, term }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
