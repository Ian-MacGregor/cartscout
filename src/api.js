// ─── CartScout API Client ───
// Update these URLs to match your deployment
const API_URL = import.meta.env.PROD
  ? "https://cartscout-api-production.up.railway.app"  // ← Replace with your Railway URL
  : "http://localhost:3001";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

let session = null;

export function setSession(s) {
  session = s;
  if (s) {
    sessionStorage.setItem("cartscout_session", JSON.stringify(s));
    sessionStorage.setItem("cartscout_session_last_active", Date.now().toString());
  } else {
    sessionStorage.removeItem("cartscout_session");
    sessionStorage.removeItem("cartscout_session_last_active");
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
  sessionStorage.removeItem("cartscout_session_last_active");
}

export function touchSession() {
  sessionStorage.setItem("cartscout_session_last_active", Date.now().toString());
}

export function isSessionExpired() {
  const lastActive = sessionStorage.getItem("cartscout_session_last_active");
  if (!lastActive) return true;
  return Date.now() - parseInt(lastActive) > SESSION_TIMEOUT_MS;
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

  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new CustomEvent("cartscout:session_expired"));
    throw new Error("Session expired");
  }

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

// ─── Location ───
export const location = {
  update: (lat, lng) =>
    request("/api/location", {
      method: "POST",
      body: JSON.stringify({ lat, lng }),
    }),
};

// ─── Stores ───
export const stores = {
  nearby: (lat, lng, radius = 20) =>
    request(`/api/stores?lat=${lat}&lng=${lng}&radius=${radius}`),
};

// ─── Products ───
export const products = {
  search: (query) =>
    request(`/api/products/search?q=${encodeURIComponent(query)}`),
};

// ─── Price Comparison ───
export const compare = {
  run: (lat, lng, radius, items) =>
    request("/api/compare", {
      method: "POST",
      body: JSON.stringify({ lat, lng, radius, items }),
    }),
};

// ─── Reverse Geocode (free, no API key, called directly) ───
export async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=12`,
      {
        headers: { "User-Agent": "CartScout/1.0" },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const city = a.city || a.town || a.village || a.hamlet || a.county || "";
    const state = a.state || "";
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    return null;
  } catch {
    return null;
  }
}