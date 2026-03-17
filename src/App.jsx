import { useState, useEffect, useCallback, useRef } from "react";
import {
  auth, lists as listsApi, items as itemsApi,
  location as locationApi, stores as storesApi,
  compare as compareApi, products as productsApi,
  setSession, getSession, clearSession,
  setStoredUser, getStoredUser,
  touchSession, isSessionExpired,
  reverseGeocode,
} from "./api";

// ─── Simulated fallbacks (kept for offline/fallback use) ───
const STORE_CHAINS = [
  { name: "Walmart Supercenter", tier: "budget", variance: 0.85 },
  { name: "Aldi", tier: "budget", variance: 0.80 },
  { name: "Kroger", tier: "mid", variance: 0.95 },
  { name: "Stop & Shop", tier: "mid", variance: 1.00 },
  { name: "Trader Joe's", tier: "specialty", variance: 0.92 },
  { name: "Whole Foods Market", tier: "premium", variance: 1.25 },
  { name: "Target", tier: "mid", variance: 0.97 },
  { name: "Costco", tier: "budget", variance: 0.78 },
];

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateNearbyStores(lat, lng, radiusMiles = 20) {
  const stores = [];
  for (let i = 0; i < STORE_CHAINS.length; i++) {
    const chain = STORE_CHAINS[i];
    const dist = seededRandom(i * 200 + lng) * radiusMiles;
    stores.push({
      id: `store-${i}`, name: chain.name, tier: chain.tier,
      address: `${Math.floor(1000 + seededRandom(i * 300 + lat) * 9000)} Main St`,
      distance: Math.round(dist * 10) / 10, lat, lng, prices: {},
    });
  }
  return stores.sort((a, b) => a.distance - b.distance);
}

function estimateBasePrice(category) {
  const estimates = {
    Dairy: 4.29, Produce: 2.99, Meat: 6.49, Bakery: 3.29, Pantry: 3.49,
    Beverages: 4.99, Frozen: 4.49, Snacks: 3.99, Breakfast: 4.49,
    Condiments: 3.29, Household: 6.99, Baby: 8.99, Pet: 7.99, Grocery: 3.99,
  };
  return estimates[category] || 3.99;
}

// ─── Icons ───
const icon = (size, children, fill = "none") => (
  <svg viewBox="0 0 24 24" fill={fill} stroke={fill === "none" ? "currentColor" : "none"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size, minWidth: size, minHeight: size, flexShrink: 0, display: "block" }}>{children}</svg>
);
const Icons = {
  cart: icon(20, <><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></>),
  plus: icon(18, <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>),
  minus: icon(16, <><line x1="5" y1="12" x2="19" y2="12"/></>),
  trash: icon(16, <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>),
  search: icon(18, <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>),
  pin: icon(16, <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>),
  list: icon(20, <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>),
  star: icon(16, <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>, "currentColor"),
  logout: icon(18, <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>),
  back: icon(20, <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>),
  dollar: icon(20, <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>),
  tag: icon(14, <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>),
  close: icon(20, <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>),
  mapPin: icon(20, <><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></>),
  crosshair: icon(16, <><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></>),
};

const TIER_COLORS = { budget: "#22c55e", mid: "#3b82f6", specialty: "#f59e0b", premium: "#a855f7" };

function normalizeList(apiList) {
  return {
    id: apiList.id, name: apiList.name, createdAt: apiList.created_at,
    items: (apiList.list_items || []).map(li => ({
      id: li.id, name: li.product_name, category: li.category,
      basePrice: parseFloat(li.base_price), qty: li.quantity,
    })),
  };
}

// ─── Location Map Modal ───
function LocationMapModal({ location, radius, locationName, onClose, onApply }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const [tempLat, setTempLat] = useState(location.lat);
  const [tempLng, setTempLng] = useState(location.lng);
  const [tempRadius, setTempRadius] = useState(radius);
  const [tempCity, setTempCity] = useState(locationName);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  // Load Leaflet dynamically
  useEffect(() => {
    if (window.L) { setLeafletLoaded(true); return; }

    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setLeafletLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Initialize map
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || mapInstanceRef.current) return;
    const L = window.L;

    const map = L.map(mapRef.current).setView([tempLat, tempLng], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const marker = L.marker([tempLat, tempLng], { draggable: true }).addTo(map);
    const circle = L.circle([tempLat, tempLng], {
      radius: tempRadius * 1609.34, // miles to meters
      color: "#6366f1", fillColor: "#6366f1", fillOpacity: 0.1, weight: 2,
    }).addTo(map);

    marker.on("dragend", async (e) => {
      const pos = e.target.getLatLng();
      setTempLat(pos.lat);
      setTempLng(pos.lng);
      circle.setLatLng(pos);
      const city = await reverseGeocode(pos.lat, pos.lng);
      if (city) setTempCity(city);
    });

    map.on("click", async (e) => {
      const pos = e.latlng;
      marker.setLatLng(pos);
      circle.setLatLng(pos);
      setTempLat(pos.lat);
      setTempLng(pos.lng);
      const city = await reverseGeocode(pos.lat, pos.lng);
      if (city) setTempCity(city);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    // Cleanup
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, [leafletLoaded]);

  // Update circle radius when slider changes
  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(tempRadius * 1609.34);
    }
    if (mapInstanceRef.current && circleRef.current) {
      mapInstanceRef.current.fitBounds(circleRef.current.getBounds(), { padding: [20, 20] });
    }
  }, [tempRadius]);

  const handleUseMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setTempLat(lat);
        setTempLng(lng);
        if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
        if (circleRef.current) circleRef.current.setLatLng([lat, lng]);
        if (mapInstanceRef.current) mapInstanceRef.current.setView([lat, lng], 11);
        const city = await reverseGeocode(lat, lng);
        if (city) setTempCity(city);
      },
      () => {},
      { timeout: 8000 }
    );
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Set Search Location</h3>
          <button style={styles.modalCloseBtn} onClick={onClose}>{Icons.close}</button>
        </div>

        <div style={styles.modalBody}>
          <div style={styles.mapLocationInfo}>
            <span style={styles.mapCityName}>{Icons.mapPin} {tempCity || `${tempLat.toFixed(3)}, ${tempLng.toFixed(3)}`}</span>
            <button style={styles.useMyLocationBtn} onClick={handleUseMyLocation}>
              {Icons.crosshair} Use my location
            </button>
          </div>

          <div ref={mapRef} style={styles.mapContainer} />

          <p style={styles.mapHint}>Click or drag the marker to change location</p>

          <div style={styles.radiusControl}>
            <label style={styles.radiusLabel}>
              Search Radius: <strong>{tempRadius} miles</strong>
            </label>
            <input
              type="range" min="5" max="50" step="5"
              value={tempRadius}
              onChange={e => setTempRadius(parseInt(e.target.value))}
              style={styles.radiusSlider}
            />
            <div style={styles.radiusTicks}>
              <span>5 mi</span><span>25 mi</span><span>50 mi</span>
            </div>
          </div>
        </div>

        <div style={styles.modalFooter}>
          <button style={styles.secondaryBtn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...styles.primaryBtn, marginTop: 0, width: "auto", padding: "12px 32px" }}
            onClick={() => onApply(tempLat, tempLng, tempRadius, tempCity)}
          >
            Apply Location
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── App Component ───
export default function GroceryApp() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login");
  const [lists, setLists] = useState([]);
  const [currentList, setCurrentList] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationName, setLocationName] = useState("");
  const [locationCoords, setLocationCoords] = useState("");
  const [searchRadius, setSearchRadius] = useState(20);
  const [stores, setStores] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "", username: "" });
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [expandedStore, setExpandedStore] = useState(null);
  const [animateIn, setAnimateIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const searchRef = useRef(null);
  const saveTimeoutRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // ── Session timeout ──
  useEffect(() => {
    if (!user) return;
    let idleTimer = null;
    const resetTimer = () => {
      touchSession();
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => handleLogout(), 30 * 60 * 1000);
    };
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => { clearTimeout(idleTimer); events.forEach(e => window.removeEventListener(e, resetTimer)); };
  }, [user]);

  useEffect(() => {
    const handleExpired = () => { setError("Your session has expired. Please sign in again."); handleLogout(); };
    window.addEventListener("cartscout:session_expired", handleExpired);
    return () => window.removeEventListener("cartscout:session_expired", handleExpired);
  }, []);

  // ── Restore session ──
  useEffect(() => {
    const existingSession = getSession();
    const existingUser = getStoredUser();
    if (existingSession && existingUser) {
      if (isSessionExpired()) {
        clearSession();
        setError("Your session has expired. Please sign in again.");
        return;
      }
      setUser(existingUser);
      triggerTransition("lists");
      fetchLists();
      getLocation();
    }
  }, []);

  // ── Auth ──
  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) { setError("Please fill in all fields"); return; }
    setLoading(true); setError("");
    try {
      const data = await auth.login(loginForm.email, loginForm.password);
      setSession(data.session); setStoredUser(data.user); setUser(data.user);
      const serverLists = await listsApi.getAll();
      setLists(serverLists.map(normalizeList));
      triggerTransition("lists");
      getLocation();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleRegister = async () => {
    if (!loginForm.email || !loginForm.password || !loginForm.username) { setError("Please fill in all fields"); return; }
    if (loginForm.username.length < 3) { setError("Username must be at least 3 characters"); return; }
    if (loginForm.password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true); setError("");
    try {
      const data = await auth.signup(loginForm.email, loginForm.password, loginForm.username);
      setSession(data.session); setStoredUser(data.user); setUser(data.user);
      setLists([]);
      triggerTransition("lists");
      getLocation();
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleLogout = () => {
    clearSession(); setUser(null); setLists([]); setCurrentList(null);
    setLoginForm({ email: "", password: "", username: "" });
    setLocation(null); setLocationName(""); setLocationCoords("");
    triggerTransition("login");
  };

  const fetchLists = async () => {
    try { const serverLists = await listsApi.getAll(); setLists(serverLists.map(normalizeList)); }
    catch (err) { console.error("Failed to fetch lists:", err); }
  };

  // ── Location with reverse geocoding ──
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation({ lat: 43.1979, lng: -70.8737 });
      setLocationCoords("43.198°N, 70.874°W");
      setLocationName("Dover, NH");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocation({ lat, lng });
        setLocationCoords(`${lat.toFixed(3)}°N, ${Math.abs(lng).toFixed(3)}°W`);
        locationApi.update(lat, lng).catch(() => {});
        const city = await reverseGeocode(lat, lng);
        setLocationName(city || `${lat.toFixed(3)}, ${lng.toFixed(3)}`);
      },
      () => {
        setLocation({ lat: 43.1979, lng: -70.8737 });
        setLocationCoords("43.198°N, 70.874°W");
        setLocationName("Dover, NH");
      },
      { timeout: 8000 }
    );
  }, []);

  // ── Fetch stores when location or radius changes ──
  useEffect(() => {
    if (!location) return;
    const fetchStores = async () => {
      try {
        const data = await storesApi.nearby(location.lat, location.lng, searchRadius);
        setStores(data.map(s => ({ ...s, name: s.store_name || s.name })));
      } catch (err) {
        console.error("Failed to fetch stores:", err);
        setStores(generateNearbyStores(location.lat, location.lng, searchRadius));
      }
    };
    fetchStores();
  }, [location, searchRadius]);

  // ── Map modal apply ──
  const handleMapApply = async (lat, lng, radius, city) => {
    setLocation({ lat, lng });
    setSearchRadius(radius);
    setLocationCoords(`${lat.toFixed(3)}°N, ${Math.abs(lng).toFixed(3)}°W`);
    setLocationName(city || `${lat.toFixed(3)}, ${lng.toFixed(3)}`);
    setShowMapModal(false);
    locationApi.update(lat, lng).catch(() => {});
  };

  // ── List Management ──
  const createList = async () => {
    setLoading(true);
    try {
      const newList = await listsApi.create("New Grocery List");
      const normalized = normalizeList({ ...newList, list_items: [] });
      setLists(prev => [normalized, ...prev]); setCurrentList(normalized);
      triggerTransition("editList");
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const deleteList = async (id) => {
    try { await listsApi.delete(id); setLists(prev => prev.filter(l => l.id !== id)); }
    catch (err) { setError(err.message); }
  };

  const saveListName = useCallback((listId, name) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      try { await listsApi.update(listId, name); setLists(prev => prev.map(l => l.id === listId ? { ...l, name } : l)); }
      catch (err) { console.error("Failed to save list name:", err); }
      finally { setSaving(false); }
    }, 500);
  }, []);

  const updateListName = (name) => {
    if (!currentList) return;
    setCurrentList(prev => ({ ...prev, name }));
    saveListName(currentList.id, name);
  };

  // ── Item Management ──
  const addItem = async (groceryItem) => {
    if (!currentList) return;
    const itemWithPrice = { ...groceryItem, basePrice: groceryItem.basePrice || estimateBasePrice(groceryItem.category) };
    const existingItem = currentList.items.find(i => i.name === itemWithPrice.name);

    if (existingItem) {
      const newQty = existingItem.qty + 1;
      try {
        await itemsApi.update(existingItem.id, newQty);
        setCurrentList(prev => ({ ...prev, items: prev.items.map(i => i.id === existingItem.id ? { ...i, qty: newQty } : i) }));
        setLists(prev => prev.map(l => l.id === currentList.id ? { ...l, items: l.items.map(i => i.id === existingItem.id ? { ...i, qty: newQty } : i) } : l));
      } catch (err) { setError(err.message); }
    } else {
      try {
        const newItem = await itemsApi.add(currentList.id, itemWithPrice);
        const normalizedItem = { id: newItem.id, name: newItem.product_name, category: newItem.category, basePrice: parseFloat(newItem.base_price), qty: newItem.quantity };
        setCurrentList(prev => ({ ...prev, items: [...prev.items, normalizedItem] }));
        setLists(prev => prev.map(l => l.id === currentList.id ? { ...l, items: [...l.items, normalizedItem] } : l));
      } catch (err) { setError(err.message); }
    }
    setSearchQuery(""); setSearchResults([]);
  };

  const updateItemQty = async (itemId, delta) => {
    if (!currentList) return;
    const item = currentList.items.find(i => i.id === itemId);
    if (!item) return;
    const newQty = Math.max(0, item.qty + delta);
    if (newQty === 0) {
      try {
        await itemsApi.delete(itemId);
        setCurrentList(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }));
        setLists(prev => prev.map(l => l.id === currentList.id ? { ...l, items: l.items.filter(i => i.id !== itemId) } : l));
      } catch (err) { setError(err.message); }
    } else {
      try {
        await itemsApi.update(itemId, newQty);
        setCurrentList(prev => ({ ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, qty: newQty } : i) }));
        setLists(prev => prev.map(l => l.id === currentList.id ? { ...l, items: l.items.map(i => i.id === itemId ? { ...i, qty: newQty } : i) } : l));
      } catch (err) { setError(err.message); }
    }
  };

  const removeItem = async (itemId) => {
    if (!currentList) return;
    try {
      await itemsApi.delete(itemId);
      setCurrentList(prev => ({ ...prev, items: prev.items.filter(i => i.id !== itemId) }));
      setLists(prev => prev.map(l => l.id === currentList.id ? { ...l, items: l.items.filter(i => i.id !== itemId) } : l));
    } catch (err) { setError(err.message); }
  };

  // ── Debounced product search ──
  useEffect(() => {
    if (searchQuery.trim().length < 2) { setSearchResults([]); return; }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await productsApi.search(searchQuery);
        setSearchResults(results);
      } catch { setSearchResults([]); }
    }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  // ── Price Comparison ──
  const comparePrices = async () => {
    if (!currentList || currentList.items.length === 0 || !location) return;
    setLoading(true);
    try {
      const data = await compareApi.run(location.lat, location.lng, searchRadius, currentList.items);
      setResults(data);
      triggerTransition("results");
    } catch (err) {
      console.error("Compare failed, falling back to simulated:", err);
      const ranked = stores.map(store => ({
        ...store, hasLiveData: false, liveItemCount: 0, totalItemCount: currentList.items.length,
        total: currentList.items.reduce((s, i) => s + i.basePrice * i.qty, 0),
        itemPrices: currentList.items.map(item => ({
          name: item.name, qty: item.qty, unitPrice: item.basePrice,
          subtotal: item.basePrice * item.qty, isLive: false,
        })),
      })).sort((a, b) => a.total - b.total);
      setResults(ranked.slice(0, 5));
      triggerTransition("results");
    } finally { setLoading(false); }
  };

  const triggerTransition = (newView) => {
    setAnimateIn(false);
    setTimeout(() => { setView(newView); setAnimateIn(true); }, 50);
  };

  useEffect(() => { setAnimateIn(true); }, []);

  const isLoggedIn = !!user && view !== "login" && view !== "register";

  // ─── RENDER ───
  return (
    <div style={styles.app}>
      <div style={styles.grain} />

      {/* ══════ PERSISTENT HEADER (shown on all pages except login/register) ══════ */}
      {isLoggedIn && (
        <div style={styles.persistentHeader}>
          <div style={styles.headerInner}>
            <div style={styles.headerLeft}>
              {(view === "editList" || view === "results") && (
                <button style={styles.backBtn} onClick={() => {
                  if (view === "results") triggerTransition("editList");
                  else { fetchLists(); triggerTransition("lists"); }
                }}>{Icons.back}</button>
              )}
              <div style={styles.headerLogo}>{Icons.cart}</div>
              <div>
                <h2 style={styles.headerTitle}>CartScout</h2>
                <span style={styles.headerSub}>Welcome, {user.username}</span>
              </div>
            </div>
            <div style={styles.headerRight}>
              <button style={styles.locationChipBtn} onClick={() => setShowMapModal(true)} title="Change location">
                {Icons.pin}
                <div style={styles.locationChipText}>
                  <span style={styles.locationCity}>{locationName || "Locating..."}</span>
                  <span style={styles.locationMeta}>{locationCoords} · {searchRadius} mi radius</span>
                </div>
              </button>
              <button style={styles.iconBtn} onClick={handleLogout} title="Log out">{Icons.logout}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ LOGIN ══════ */}
      {view === "login" && (
        <div style={{ ...styles.centerPanel, opacity: animateIn ? 1 : 0, transform: animateIn ? "translateY(0)" : "translateY(20px)", transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <div style={styles.logoArea}>
            <div style={styles.logoIcon}>{Icons.cart}</div>
            <h1 style={styles.logoTitle}>CartScout</h1>
            <p style={styles.logoSub}>Find the cheapest groceries near you</p>
          </div>
          <div style={styles.authCard}>
            {error && <div style={styles.errorBanner}>{error}</div>}
            <label style={styles.label}>Email</label>
            <input style={styles.input} type="email" value={loginForm.email}
              onChange={e => { setLoginForm({ ...loginForm, email: e.target.value }); setError(""); }}
              placeholder="you@example.com" onKeyDown={e => e.key === "Enter" && handleLogin()} />
            <label style={{ ...styles.label, marginTop: 16 }}>Password</label>
            <input style={styles.input} type="password" value={loginForm.password}
              onChange={e => { setLoginForm({ ...loginForm, password: e.target.value }); setError(""); }}
              placeholder="Enter password" onKeyDown={e => e.key === "Enter" && handleLogin()} />
            <button style={styles.primaryBtn} onClick={handleLogin} disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </button>
            <button style={styles.secondaryBtn} onClick={() => { setView("register"); setError(""); }}>Create Account</button>
          </div>
        </div>
      )}

      {/* ══════ REGISTER ══════ */}
      {view === "register" && (
        <div style={{ ...styles.centerPanel, opacity: animateIn ? 1 : 0, transform: animateIn ? "translateY(0)" : "translateY(20px)", transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <div style={styles.logoArea}>
            <div style={styles.logoIcon}>{Icons.cart}</div>
            <h1 style={styles.logoTitle}>CartScout</h1>
            <p style={styles.logoSub}>Create your account</p>
          </div>
          <div style={styles.authCard}>
            {error && <div style={styles.errorBanner}>{error}</div>}
            <label style={styles.label}>Email</label>
            <input style={styles.input} type="email" value={loginForm.email}
              onChange={e => { setLoginForm({ ...loginForm, email: e.target.value }); setError(""); }}
              placeholder="you@example.com" />
            <label style={{ ...styles.label, marginTop: 16 }}>Display Name</label>
            <input style={styles.input} value={loginForm.username}
              onChange={e => { setLoginForm({ ...loginForm, username: e.target.value }); setError(""); }}
              placeholder="At least 3 characters" />
            <label style={{ ...styles.label, marginTop: 16 }}>Password</label>
            <input style={styles.input} type="password" value={loginForm.password}
              onChange={e => { setLoginForm({ ...loginForm, password: e.target.value }); setError(""); }}
              placeholder="At least 6 characters" onKeyDown={e => e.key === "Enter" && handleRegister()} />
            <button style={styles.primaryBtn} onClick={handleRegister} disabled={loading}>
              {loading ? "Creating account..." : "Create Account"}
            </button>
            <button style={styles.secondaryBtn} onClick={() => { triggerTransition("login"); setError(""); }}>Back to Sign In</button>
          </div>
        </div>
      )}

      {/* ══════ LISTS DASHBOARD ══════ */}
      {view === "lists" && user && (
        <div style={{ ...styles.mainPanel, opacity: animateIn ? 1 : 0, transform: animateIn ? "translateY(0)" : "translateY(12px)", transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <div style={styles.content}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>My Grocery Lists</h3>
              <button style={styles.addBtn} onClick={createList} disabled={loading}>
                {Icons.plus} {loading ? "Creating..." : "New List"}
              </button>
            </div>

            {lists.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>{Icons.list}</div>
                <p style={styles.emptyText}>No lists yet. Create one to start comparing prices!</p>
              </div>
            ) : (
              <div style={styles.listGrid}>
                {lists.map((list, i) => (
                  <div key={list.id} style={{ ...styles.listCard, animationDelay: `${i * 60}ms` }}
                    onClick={() => { setCurrentList(list); triggerTransition("editList"); }}>
                    <div style={styles.listCardHeader}>
                      <h4 style={styles.listCardTitle}>{list.name}</h4>
                      <button style={styles.deleteBtn} onClick={e => { e.stopPropagation(); deleteList(list.id); }}>{Icons.trash}</button>
                    </div>
                    <div style={styles.listCardMeta}>
                      {list.items.length} item{list.items.length !== 1 ? "s" : ""}
                      <span style={styles.dot}>·</span>
                      ~${list.items.reduce((s, i) => s + (i.basePrice || 0) * (i.qty || 1), 0).toFixed(2)} est.
                    </div>
                    <div style={styles.listCardCategories}>
                      {[...new Set(list.items.map(i => i.category))].slice(0, 4).map(cat => (
                        <span key={cat} style={styles.catChip}>{cat}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {stores.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <h3 style={styles.sectionTitle}>{stores.length} Stores Within {searchRadius} Miles</h3>
                <div style={styles.storeChips}>
                  {stores.slice(0, 8).map(s => (
                    <span key={s.id} style={{ ...styles.storeChip, borderColor: TIER_COLORS[s.tier] || "#64748b" }}>
                      <span style={{ ...styles.tierDot, background: TIER_COLORS[s.tier] || "#64748b" }} />
                      {s.name} — {s.distance} mi
                    </span>
                  ))}
                  {stores.length > 8 && <span style={styles.storeChip}>+{stores.length - 8} more</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════ EDIT LIST ══════ */}
      {view === "editList" && currentList && (
        <div style={{ ...styles.mainPanel, opacity: animateIn ? 1 : 0, transform: animateIn ? "translateY(0)" : "translateY(12px)", transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <div style={styles.editListBar}>
            <div style={styles.editListLeft}>
              <input style={styles.listNameInput} value={currentList.name}
                onChange={e => updateListName(e.target.value)} placeholder="List name..." />
              {saving && <span style={styles.savingIndicator}>Saving...</span>}
            </div>
            <button
              style={{ ...styles.primaryBtn, margin: 0, opacity: currentList.items.length === 0 ? 0.4 : 1, padding: "10px 24px", width: "auto" }}
              disabled={currentList.items.length === 0 || loading}
              onClick={comparePrices}
            >
              {Icons.dollar} {loading ? "Comparing..." : "Compare Prices"}
            </button>
          </div>

          <div style={styles.content}>
            <div style={styles.searchArea}>
              <div style={styles.searchBox}>
                {Icons.search}
                <input ref={searchRef} style={styles.searchInput} value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search groceries (e.g. milk, chicken, bananas)..." />
              </div>
              {searchResults.length > 0 && (
                <div style={styles.searchDropdown}>
                  {searchResults.map((item, idx) => (
                    <button key={`${item.name}-${idx}`} style={styles.searchItem} onClick={() => addItem(item)}>
                      <div>
                        <span style={styles.searchItemName}>{item.name}</span>
                        <span style={styles.searchItemCat}>
                          {item.category}
                          {item.source === "local" && <span style={styles.localTag}> · Price tracked</span>}
                        </span>
                      </div>
                      <span style={styles.searchItemPrice}>
                        {item.basePrice ? `$${item.basePrice.toFixed(2)}` : "est. price"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {searchQuery === "" && currentList.items.length === 0 && (
              <div style={styles.browseSection}>
                <p style={styles.browseHint}>Try searching for:</p>
                <div style={styles.catGrid}>
                  {["milk", "eggs", "bread", "chicken", "rice", "pasta", "butter", "cheese", "coffee", "cereal", "apples", "orange juice"].map(term => (
                    <button key={term} style={styles.catButton} onClick={() => setSearchQuery(term)}>{term}</button>
                  ))}
                </div>
              </div>
            )}

            {currentList.items.length > 0 && (
              <div style={styles.itemList}>
                <div style={styles.itemListHeader}>
                  <span>{currentList.items.length} item{currentList.items.length !== 1 ? "s" : ""}</span>
                  <span style={styles.estTotal}>
                    Est. total: ${currentList.items.reduce((s, i) => s + i.basePrice * i.qty, 0).toFixed(2)}
                  </span>
                </div>
                {currentList.items.map((item, idx) => (
                  <div key={item.id} style={{ ...styles.itemRow, animationDelay: `${idx * 30}ms` }}>
                    <div style={styles.itemInfo}>
                      <span style={styles.itemName}>{item.name}</span>
                      <span style={styles.itemCat}>{Icons.tag} {item.category}</span>
                    </div>
                    <div style={styles.qtyControls}>
                      <button style={styles.qtyBtn} onClick={() => updateItemQty(item.id, -1)}>{Icons.minus}</button>
                      <span style={styles.qtyNum}>{item.qty}</span>
                      <button style={styles.qtyBtn} onClick={() => updateItemQty(item.id, 1)}>{Icons.plus}</button>
                    </div>
                    <span style={styles.itemSubtotal}>${(item.basePrice * item.qty).toFixed(2)}</span>
                    <button style={styles.removeBtn} onClick={() => removeItem(item.id)}>{Icons.trash}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════ RESULTS ══════ */}
      {view === "results" && results.length > 0 && (
        <div style={{ ...styles.mainPanel, opacity: animateIn ? 1 : 0, transform: animateIn ? "translateY(0)" : "translateY(12px)", transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <div style={styles.content}>
            <div style={styles.resultsSubHeader}>
              <span style={styles.resultsSubTitle}>Price Comparison</span>
              <span style={styles.resultsMeta}>{currentList?.name} · {currentList?.items.length} items · {searchRadius} mi radius</span>
            </div>

            <div style={styles.savingsBanner}>
              <div style={styles.savingsAmount}>
                Save ${(results[results.length - 1].total - results[0].total).toFixed(2)}
              </div>
              <div style={styles.savingsDesc}>
                by shopping at <strong>{results[0].name}</strong> instead of {results[results.length - 1].name}
              </div>
            </div>

            {results.some(s => !s.hasLiveData) && (
              <div style={styles.dataBanner}>
                <span style={styles.dataBannerIcon}>i</span>
                <span>
                  Some stores show <strong>estimated prices</strong> because live
                  pricing data is not yet available. Stores with live data
                  are marked with a <span style={{ color: "#22c55e" }}>●</span> indicator.
                </span>
              </div>
            )}

            <div style={styles.resultsGrid}>
              {results.map((store, idx) => {
                const isExpanded = expandedStore === store.id;
                const isBest = idx === 0;
                return (
                  <div key={store.id} style={{ ...styles.resultCard, ...(isBest ? styles.resultCardBest : {}), animationDelay: `${idx * 80}ms` }}
                    onClick={() => setExpandedStore(isExpanded ? null : store.id)}>
                    <div style={styles.resultHeader}>
                      <div style={styles.resultRank}>
                        {isBest ? <span style={styles.bestBadge}>{Icons.star} BEST PRICE</span> : <span style={styles.rankNum}>#{idx + 1}</span>}
                      </div>
                      <div style={styles.resultInfo}>
                        <h4 style={styles.resultName}>
                          {store.name}
                          {store.hasLiveData ? <span style={styles.liveBadge}>● LIVE</span> : <span style={styles.estBadge}>◐ EST</span>}
                        </h4>
                        <p style={styles.resultAddr}>{Icons.pin} {store.address} — {store.distance} mi away</p>
                      </div>
                      <div style={styles.resultTotal}>
                        <span style={styles.totalAmount}>${store.total.toFixed(2)}</span>
                        <span style={{ ...styles.tierTag, background: (TIER_COLORS[store.tier] || "#64748b") + "22", color: TIER_COLORS[store.tier] || "#64748b" }}>
                          {store.tier}
                        </span>
                      </div>
                    </div>

                    {isBest && !isExpanded && <p style={styles.expandHint}>Tap to see item breakdown</p>}

                    {isExpanded && (
                      <div style={styles.breakdown}>
                        <div style={styles.breakdownHeader}>
                          <span>Item</span><span>Qty</span><span>Unit</span><span>Subtotal</span>
                        </div>
                        {store.itemPrices.map(ip => (
                          <div key={ip.name} style={styles.breakdownRow}>
                            <span style={styles.bkName}>{ip.name}</span>
                            <span style={styles.bkQty}>x{ip.qty}</span>
                            <span style={{ ...styles.bkUnit, color: ip.isLive ? "#22d3ee" : "#64748b" }}>
                              ${ip.unitPrice.toFixed(2)}{!ip.isLive && <span style={{ fontSize: 9 }}> est</span>}
                            </span>
                            <span style={styles.bkSub}>${ip.subtotal.toFixed(2)}</span>
                          </div>
                        ))}
                        <div style={styles.breakdownTotal}>
                          <span>Total</span><span>${store.total.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════ MAP MODAL ══════ */}
      {showMapModal && location && (
        <LocationMapModal
          location={location} radius={searchRadius}
          locationName={locationName}
          onClose={() => setShowMapModal(false)}
          onApply={handleMapApply}
        />
      )}
    </div>
  );
}

// ─── Styles ───
const styles = {
  app: {
    minHeight: "100vh", width: "100%",
    background: "linear-gradient(145deg, #0c0f1a 0%, #131829 40%, #0f1520 100%)",
    fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif",
    color: "#e2e8f0", position: "relative", overflow: "hidden", boxSizing: "border-box",
  },
  grain: {
    position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.03,
    background: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
  },
  // ── Persistent Header ──
  persistentHeader: {
    position: "sticky", top: 0, zIndex: 50, width: "100%",
    background: "rgba(12,15,26,0.85)", backdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  headerInner: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    maxWidth: 1200, margin: "0 auto", padding: "14px 32px", gap: 12, flexWrap: "wrap",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  headerLogo: {
    width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #22d3ee, #6366f1)", color: "#fff",
  },
  headerTitle: { fontSize: 18, fontWeight: 800, margin: 0, color: "#f1f5f9", letterSpacing: "-0.01em" },
  headerSub: { fontSize: 12, color: "#64748b" },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  locationChipBtn: {
    display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 12,
    background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.15)",
    color: "#22d3ee", cursor: "pointer", textAlign: "left", transition: "all 0.15s",
  },
  locationChipText: { display: "flex", flexDirection: "column" },
  locationCity: { fontSize: 13, fontWeight: 600, color: "#e2e8f0" },
  locationMeta: { fontSize: 10, color: "#64748b", marginTop: 1 },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  // ── Auth ──
  centerPanel: {
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    minHeight: "100vh", padding: 24, position: "relative", zIndex: 1,
  },
  logoArea: { textAlign: "center", marginBottom: 32 },
  logoIcon: {
    width: 64, height: 64, borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #22d3ee, #6366f1)", margin: "0 auto 16px", color: "#fff",
    boxShadow: "0 8px 32px rgba(99,102,241,0.3)",
  },
  logoTitle: {
    fontSize: 36, fontWeight: 800, margin: 0,
    background: "linear-gradient(135deg, #22d3ee, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    letterSpacing: "-0.02em",
  },
  logoSub: { fontSize: 15, color: "#94a3b8", marginTop: 6 },
  authCard: {
    background: "rgba(255,255,255,0.04)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20, padding: 32, width: "100%", maxWidth: 440,
  },
  label: { fontSize: 13, fontWeight: 600, color: "#94a3b8", display: "block", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" },
  input: {
    width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(0,0,0,0.3)", color: "#e2e8f0", fontSize: 15, outline: "none", boxSizing: "border-box",
  },
  primaryBtn: {
    width: "100%", padding: "14px", borderRadius: 12, border: "none", cursor: "pointer",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 15, fontWeight: 700,
    marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxShadow: "0 4px 20px rgba(99,102,241,0.3)",
  },
  secondaryBtn: {
    width: "100%", padding: "12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
    background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 600, marginTop: 12, cursor: "pointer",
  },
  errorBanner: {
    background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10,
    padding: "10px 14px", color: "#fca5a5", fontSize: 13, marginBottom: 16,
  },
  // ── Main Panel ──
  mainPanel: { position: "relative", zIndex: 1, maxWidth: 1200, width: "100%", margin: "0 auto", padding: "24px 32px 40px", boxSizing: "border-box" },
  content: { padding: "0 0 20px" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 700, margin: 0, color: "#e2e8f0" },
  addBtn: {
    display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 12, border: "none",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 14, fontWeight: 700,
    cursor: "pointer", boxShadow: "0 4px 16px rgba(99,102,241,0.25)",
  },
  emptyState: { textAlign: "center", padding: "60px 20px" },
  emptyIcon: { color: "#334155", marginBottom: 12, display: "flex", justifyContent: "center", transform: "scale(2.5)", opacity: 0.5 },
  emptyText: { color: "#64748b", fontSize: 15, marginTop: 24 },
  listGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 },
  listCard: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16,
    padding: 20, cursor: "pointer", animation: "fadeSlideIn 0.4s ease both",
  },
  listCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  listCardTitle: { fontSize: 16, fontWeight: 700, margin: 0, color: "#f1f5f9" },
  deleteBtn: { background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4, borderRadius: 6 },
  listCardMeta: { fontSize: 13, color: "#64748b", marginTop: 8 },
  dot: { margin: "0 6px" },
  listCardCategories: { display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" },
  catChip: { fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(99,102,241,0.12)", color: "#818cf8", fontWeight: 600 },
  // ── Edit List ──
  editListBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    marginBottom: 24, flexWrap: "wrap",
  },
  editListLeft: { display: "flex", alignItems: "center", gap: 12, flex: 1 },
  listNameInput: { fontSize: 20, fontWeight: 800, background: "none", border: "none", color: "#f1f5f9", outline: "none", flex: 1, minWidth: 200 },
  savingIndicator: { fontSize: 12, color: "#64748b", fontStyle: "italic" },
  searchArea: { position: "relative", marginBottom: 24 },
  searchBox: {
    display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 14,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8",
  },
  searchInput: { flex: 1, background: "none", border: "none", color: "#e2e8f0", fontSize: 15, outline: "none" },
  searchDropdown: {
    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, marginTop: 6,
    background: "#1e2336", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
    boxShadow: "0 16px 48px rgba(0,0,0,0.5)", overflow: "hidden", maxHeight: 360, overflowY: "auto",
  },
  searchItem: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px",
    border: "none", background: "none", color: "#e2e8f0", cursor: "pointer", width: "100%",
    textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.04)",
  },
  searchItemName: { fontSize: 14, fontWeight: 600, display: "block" },
  searchItemCat: { fontSize: 12, color: "#64748b" },
  searchItemPrice: { fontSize: 13, color: "#22d3ee", fontWeight: 600, flexShrink: 0 },
  localTag: { color: "#22c55e", fontWeight: 600 },
  browseSection: { marginBottom: 24 },
  browseHint: { fontSize: 13, color: "#64748b", marginBottom: 12 },
  catGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  catButton: {
    padding: "8px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  itemList: { background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" },
  itemListHeader: {
    display: "flex", justifyContent: "space-between", padding: "14px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 600, color: "#64748b",
  },
  estTotal: { color: "#22d3ee" },
  itemRow: { display: "flex", alignItems: "center", padding: "12px 20px", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.03)", animation: "fadeSlideIn 0.3s ease both" },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, fontWeight: 600, display: "block", color: "#e2e8f0" },
  itemCat: { fontSize: 11, color: "#64748b", display: "flex", alignItems: "center", gap: 4, marginTop: 2 },
  qtyControls: { display: "flex", alignItems: "center", gap: 4 },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)", color: "#94a3b8", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  qtyNum: { fontSize: 15, fontWeight: 700, color: "#f1f5f9", minWidth: 24, textAlign: "center" },
  itemSubtotal: { fontSize: 14, fontWeight: 700, color: "#818cf8", minWidth: 60, textAlign: "right" },
  removeBtn: { background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 4, borderRadius: 6 },
  storeChips: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 },
  storeChip: {
    display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 12px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", background: "rgba(255,255,255,0.02)",
  },
  tierDot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
  // ── Results ──
  resultsSubHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 },
  resultsSubTitle: { fontSize: 18, fontWeight: 700, color: "#e2e8f0" },
  resultsMeta: { fontSize: 13, color: "#64748b" },
  savingsBanner: {
    background: "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,211,238,0.08))",
    border: "1px solid rgba(34,197,94,0.2)", borderRadius: 16, padding: "24px 28px", marginBottom: 24, textAlign: "center",
  },
  savingsAmount: {
    fontSize: 32, fontWeight: 800,
    background: "linear-gradient(135deg, #22c55e, #22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  savingsDesc: { fontSize: 14, color: "#94a3b8", marginTop: 4 },
  dataBanner: {
    display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 18px",
    background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)",
    borderRadius: 12, marginBottom: 16, fontSize: 13, color: "#fbbf24", lineHeight: 1.5,
  },
  dataBannerIcon: { fontSize: 16, fontWeight: 700, flexShrink: 0, width: 20, height: 20, borderRadius: "50%", background: "rgba(234,179,8,0.2)", display: "flex", alignItems: "center", justifyContent: "center" },
  liveBadge: { fontSize: 10, fontWeight: 700, color: "#22c55e", marginLeft: 8, letterSpacing: "0.03em" },
  estBadge: { fontSize: 10, fontWeight: 700, color: "#f59e0b", marginLeft: 8, letterSpacing: "0.03em" },
  resultsGrid: { display: "flex", flexDirection: "column", gap: 12 },
  resultCard: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16,
    padding: 20, cursor: "pointer", animation: "fadeSlideIn 0.4s ease both",
  },
  resultCardBest: {
    background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)",
    boxShadow: "0 4px 24px rgba(34,197,94,0.1)",
  },
  resultHeader: { display: "flex", alignItems: "center", gap: 16 },
  resultRank: { flexShrink: 0 },
  bestBadge: {
    display: "flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.15)",
    color: "#22c55e", fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 8, letterSpacing: "0.05em",
  },
  rankNum: { fontSize: 20, fontWeight: 800, color: "#475569", minWidth: 32 },
  resultInfo: { flex: 1, minWidth: 0 },
  resultName: { fontSize: 16, fontWeight: 700, margin: 0, color: "#f1f5f9" },
  resultAddr: { fontSize: 12, color: "#64748b", marginTop: 2, display: "flex", alignItems: "center", gap: 4 },
  resultTotal: { textAlign: "right", flexShrink: 0 },
  totalAmount: { fontSize: 24, fontWeight: 800, color: "#f1f5f9", display: "block" },
  tierTag: { fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 6, textTransform: "uppercase", letterSpacing: "0.05em" },
  expandHint: { fontSize: 12, color: "#64748b", marginTop: 10, textAlign: "center" },
  breakdown: { marginTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 },
  breakdownHeader: {
    display: "grid", gridTemplateColumns: "1fr 50px 70px 80px", gap: 8, padding: "6px 0",
    fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em",
  },
  breakdownRow: { display: "grid", gridTemplateColumns: "1fr 50px 70px 80px", gap: 8, padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 13 },
  bkName: { color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  bkQty: { color: "#64748b", textAlign: "center" },
  bkUnit: { color: "#94a3b8", textAlign: "right" },
  bkSub: { color: "#e2e8f0", fontWeight: 600, textAlign: "right" },
  breakdownTotal: {
    display: "flex", justifyContent: "space-between", padding: "12px 0 0", marginTop: 4,
    borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 15, fontWeight: 800, color: "#f1f5f9",
  },
  // ── Map Modal ──
  modalOverlay: {
    position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)",
    display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
  },
  modalContent: {
    background: "#1a1f35", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20,
    width: "100%", maxWidth: 600, maxHeight: "90vh", overflow: "auto",
    boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
  },
  modalHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  modalTitle: { fontSize: 18, fontWeight: 700, margin: 0, color: "#f1f5f9" },
  modalCloseBtn: { background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4 },
  modalBody: { padding: "20px 24px" },
  mapLocationInfo: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 },
  mapCityName: { fontSize: 15, fontWeight: 600, color: "#e2e8f0", display: "flex", alignItems: "center", gap: 6 },
  useMyLocationBtn: {
    display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 8,
    background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)",
    color: "#818cf8", fontSize: 12, fontWeight: 600, cursor: "pointer",
  },
  mapContainer: { width: "100%", height: 300, borderRadius: 12, overflow: "hidden", marginBottom: 8, background: "#0f1520" },
  mapHint: { fontSize: 12, color: "#64748b", textAlign: "center", marginBottom: 16 },
  radiusControl: { marginTop: 8 },
  radiusLabel: { fontSize: 14, color: "#94a3b8", display: "block", marginBottom: 10 },
  radiusSlider: {
    width: "100%", height: 6, borderRadius: 3, appearance: "none", background: "rgba(255,255,255,0.1)",
    outline: "none", cursor: "pointer",
  },
  radiusTicks: { display: "flex", justifyContent: "space-between", fontSize: 11, color: "#475569", marginTop: 4 },
  modalFooter: {
    display: "flex", justifyContent: "flex-end", gap: 12, padding: "16px 24px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
  },
};

// Inject styles
if (typeof document !== "undefined") {
  const styleEl = document.createElement("style");
  styleEl.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;0,9..40,800&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    html, body, #root { margin: 0; padding: 0; width: 100%; min-height: 100vh; }
    @keyframes fadeSlideIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    input::placeholder { color: #475569; }
    button:hover { filter: brightness(1.1); }
    *::-webkit-scrollbar { width: 6px; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
    input[type="range"]::-webkit-slider-thumb {
      appearance: none; width: 20px; height: 20px; border-radius: 50%;
      background: #6366f1; cursor: pointer; box-shadow: 0 2px 8px rgba(99,102,241,0.4);
    }
    input[type="range"]::-moz-range-thumb {
      width: 20px; height: 20px; border-radius: 50%; border: none;
      background: #6366f1; cursor: pointer;
    }
    .leaflet-control-attribution { font-size: 9px !important; opacity: 0.6; }
  `;
  document.head.appendChild(styleEl);
}