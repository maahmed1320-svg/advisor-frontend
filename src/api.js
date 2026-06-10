// Force https:// protocol even if the variable in Railway UI is just the domain
const API_DOMAIN = import.meta.env.VITE_API_URL || "localhost:3001";
const BASE = API_DOMAIN.startsWith("http") 
  ? API_DOMAIN 
  : `https://${API_DOMAIN}`;

export async function fetchStudent(id) {
  // Use the new BASE variable here
  const res = await fetch(`${BASE}/api/student/${id}`);

  if (!res.ok) {
    // Check if the response is actually JSON before trying to parse it
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      const body = await res.json();
      throw new Error(body.error || "Failed to fetch student");
    } else {
      throw new Error(`Server error: ${res.status}`);
    }
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