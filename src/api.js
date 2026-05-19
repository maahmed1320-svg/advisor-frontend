const BASE = import.meta.env.VITE_API_URL ?? ''

// ── Fetch student data (call once, cache raw on client) ───────
// Returns { raw, result } — store raw in state, pass to compute()
export async function fetchStudent(id, semester = 'spring') {
  const params = new URLSearchParams({ semester })
  const res = await fetch(`${BASE}/api/student/${id}?${params}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json() // { raw, result }
}

// ── Re-run engine with overrides (zero DB queries) ────────────
// overrides: { "CSC202": true, "MTT204": false }  (true=pass, false=fail)
// raw: the raw object received from fetchStudent()
export async function computeAdvisory(id, raw, overrides = {}) {
  const res = await fetch(`${BASE}/api/student/${id}/compute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw, overrides }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() // { result }
}