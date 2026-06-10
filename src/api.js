// Base URL (works for both local + production)
const BASE =
  import.meta.env.VITE_API_URL ||
  "http://localhost:3001";

export async function fetchStudent(id) {
  const res = await fetch(`${BASE}/api/student/${id}`);

  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error || "Failed to fetch student");
  }

  return res.json();
}

export async function computeAdvisory(id, overrides = {}) {
  const res = await fetch(`${BASE}/api/student/${id}/compute`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ overrides })
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}