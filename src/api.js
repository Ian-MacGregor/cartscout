// ─── CartScout API Client ───
// Update these URLs to match your deployment
const API_URL = import.meta.env.PROD
  ? "https://cartscout-api-production.up.railway.app"  // ← API Hosting Location
  : "http://localhost:3001";

let session = null;

export function setSession(s) {
  session = s;
  // Persist session to survive page refresh
  if (s) {
    sessionStorage.setItem("cartscout_session", JSON.stringify(s));
  } else {
    sessionStorage.removeItem("cartscout_session");
  }
}

export function getSession() {
  if (session) return session;
  try {
    const stored = sessionStorage.getItem("cartscout_session");
    if (stored) {
      session = JSON.parse(stored);
      return session;
    }
  } catch {}
  return null;
}

export function clearSession() {
  session = null;
  sessionStorage.removeItem("cartscout_session");
  sessionStorage.removeItem("cartscout_user");
}

export function setStoredUser(u) {
  if (u) {
    sessionStorage.setItem("cartscout_user", JSON.stringify(u));
  } else {
    sessionStorage.removeItem("cartscout_user");
  }
}

export function getStoredUser() {
  try {
    const stored = sessionStorage.getItem("cartscout_user");
    return stored ? JSON.parse(stored) : null;
  } catch { return null; }
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json" };

  const currentSession = getSession();
  if (currentSession?.access_token) {
    headers["Authorization"] = `Bearer ${currentSession.access_token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ─── Auth ───
export const auth = {
  login: (email, password) =>
    request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  signup: (email, password, username) =>
    request("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, username }),
    }),
};

// ─── Lists ───
export const lists = {
  getAll: () => request("/api/lists"),

  create: (name) =>
    request("/api/lists", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  update: (id, name) =>
    request(`/api/lists/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),

  delete: (id) =>
    request(`/api/lists/${id}`, { method: "DELETE" }),
};

// ─── Items ───
export const items = {
  add: (listId, item) =>
    request(`/api/lists/${listId}/items`, {
      method: "POST",
      body: JSON.stringify({
        product_name: item.name,
        category: item.category,
        base_price: item.basePrice,
        quantity: item.qty || 1,
      }),
    }),

  update: (itemId, quantity) =>
    request(`/api/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify({ quantity }),
    }),

  delete: (itemId) =>
    request(`/api/items/${itemId}`, { method: "DELETE" }),
};