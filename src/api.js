const BASE = import.meta.env.VITE_API_URL ?? ''
export async function fetchStudent(id) {
  
  const res = await fetch(`${BASE}/api/student/${id}`)
  if (!res.ok) {
    const body = await res.json()
    throw new Error(body.error)    
  }
  return res.json()
}

// ── Re-run engine with overrides (zero DB queries) ────────────
// overrides: { "CSC202": true, "MTT204": false }  (true=pass, false=fail)
// raw: the raw object received from fetchStudent()
export async function computeAdvisory(id, overrides = {}) {
  const res = await fetch(`${BASE}/api/student/${id}/compute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ overrides }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() // { result }
}