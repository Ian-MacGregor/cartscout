import { useState, useEffect, useCallback, useRef } from "react";

// ─── Utility: Persistent Storage ───
const Storage = {
  async get(key) {
    try {
      const r = await window.storage.get(key);
      return r ? JSON.parse(r.value) : null;
    } catch { return null; }
  },
  async set(key, val) {
    try {
      await window.storage.set(key, JSON.stringify(val));
    } catch (e) { console.error("Storage error:", e); }
  },
  async delete(key) {
    try { await window.storage.delete(key); } catch {}
  },
  async list(prefix) {
    try {
      const r = await window.storage.list(prefix);
      return r?.keys || [];
    } catch { return []; }
  }
};

// ─── Grocery Database (realistic items with base prices) ───
const GROCERY_DB = [
  { name: "Whole Milk (1 gal)", category: "Dairy", basePrice: 3.99 },
  { name: "2% Milk (1 gal)", category: "Dairy", basePrice: 3.89 },
  { name: "Large Eggs (dozen)", category: "Dairy", basePrice: 3.49 },
  { name: "Butter (1 lb)", category: "Dairy", basePrice: 4.29 },
  { name: "Cheddar Cheese (8 oz)", category: "Dairy", basePrice: 3.99 },
  { name: "Greek Yogurt (32 oz)", category: "Dairy", basePrice: 5.49 },
  { name: "Heavy Cream (16 oz)", category: "Dairy", basePrice: 3.99 },
  { name: "Sour Cream (16 oz)", category: "Dairy", basePrice: 2.49 },
  { name: "Bananas (1 lb)", category: "Produce", basePrice: 0.59 },
  { name: "Apples (3 lb bag)", category: "Produce", basePrice: 4.99 },
  { name: "Avocados (each)", category: "Produce", basePrice: 1.49 },
  { name: "Tomatoes (1 lb)", category: "Produce", basePrice: 2.49 },
  { name: "Onions (3 lb bag)", category: "Produce", basePrice: 3.29 },
  { name: "Potatoes (5 lb bag)", category: "Produce", basePrice: 4.49 },
  { name: "Carrots (2 lb bag)", category: "Produce", basePrice: 2.29 },
  { name: "Broccoli (1 bunch)", category: "Produce", basePrice: 2.49 },
  { name: "Spinach (10 oz)", category: "Produce", basePrice: 3.49 },
  { name: "Lettuce (head)", category: "Produce", basePrice: 1.99 },
  { name: "Bell Peppers (each)", category: "Produce", basePrice: 1.29 },
  { name: "Garlic (3-pack)", category: "Produce", basePrice: 1.99 },
  { name: "Lemons (each)", category: "Produce", basePrice: 0.69 },
  { name: "Strawberries (1 lb)", category: "Produce", basePrice: 3.99 },
  { name: "Blueberries (6 oz)", category: "Produce", basePrice: 3.49 },
  { name: "Chicken Breast (1 lb)", category: "Meat", basePrice: 5.49 },
  { name: "Ground Beef 80/20 (1 lb)", category: "Meat", basePrice: 5.99 },
  { name: "Ground Turkey (1 lb)", category: "Meat", basePrice: 5.49 },
  { name: "Pork Chops (1 lb)", category: "Meat", basePrice: 4.99 },
  { name: "Bacon (12 oz)", category: "Meat", basePrice: 6.49 },
  { name: "Salmon Fillet (1 lb)", category: "Meat", basePrice: 9.99 },
  { name: "Italian Sausage (1 lb)", category: "Meat", basePrice: 4.99 },
  { name: "Deli Turkey (1 lb)", category: "Meat", basePrice: 7.99 },
  { name: "White Bread (loaf)", category: "Bakery", basePrice: 2.99 },
  { name: "Whole Wheat Bread (loaf)", category: "Bakery", basePrice: 3.49 },
  { name: "Hamburger Buns (8-pack)", category: "Bakery", basePrice: 2.99 },
  { name: "Tortillas (10-pack)", category: "Bakery", basePrice: 3.29 },
  { name: "White Rice (2 lb)", category: "Pantry", basePrice: 2.99 },
  { name: "Pasta (1 lb)", category: "Pantry", basePrice: 1.49 },
  { name: "Pasta Sauce (24 oz)", category: "Pantry", basePrice: 2.99 },
  { name: "Olive Oil (16 oz)", category: "Pantry", basePrice: 6.99 },
  { name: "Canola Oil (48 oz)", category: "Pantry", basePrice: 4.49 },
  { name: "All-Purpose Flour (5 lb)", category: "Pantry", basePrice: 3.49 },
  { name: "Granulated Sugar (4 lb)", category: "Pantry", basePrice: 3.49 },
  { name: "Peanut Butter (16 oz)", category: "Pantry", basePrice: 3.49 },
  { name: "Canned Tomatoes (28 oz)", category: "Pantry", basePrice: 1.99 },
  { name: "Black Beans (15 oz can)", category: "Pantry", basePrice: 1.29 },
  { name: "Chicken Broth (32 oz)", category: "Pantry", basePrice: 2.49 },
  { name: "Cereal (family size)", category: "Pantry", basePrice: 4.99 },
  { name: "Oatmeal (42 oz)", category: "Pantry", basePrice: 4.49 },
  { name: "Coffee (12 oz bag)", category: "Beverages", basePrice: 8.99 },
  { name: "Orange Juice (64 oz)", category: "Beverages", basePrice: 4.49 },
  { name: "Sparkling Water (12-pack)", category: "Beverages", basePrice: 5.49 },
  { name: "Paper Towels (6-pack)", category: "Household", basePrice: 8.99 },
  { name: "Dish Soap (22 oz)", category: "Household", basePrice: 3.49 },
  { name: "Trash Bags (50-count)", category: "Household", basePrice: 9.99 },
  { name: "Frozen Pizza", category: "Frozen", basePrice: 5.99 },
  { name: "Frozen Vegetables (16 oz)", category: "Frozen", basePrice: 2.49 },
  { name: "Ice Cream (1.5 qt)", category: "Frozen", basePrice: 5.49 },
];

// ─── Simulated Store Generator ───
const STORE_CHAINS = [
  { name: "Walmart Supercenter", tier: "budget", variance: 0.85 },
  { name: "Aldi", tier: "budget", variance: 0.80 },
  { name: "Lidl", tier: "budget", variance: 0.82 },
  { name: "Kroger", tier: "mid", variance: 0.95 },
  { name: "Publix", tier: "mid", variance: 1.05 },
  { name: "H-E-B", tier: "mid", variance: 0.90 },
  { name: "Safeway", tier: "mid", variance: 1.02 },
  { name: "Stop & Shop", tier: "mid", variance: 1.00 },
  { name: "Giant Food", tier: "mid", variance: 0.98 },
  { name: "Meijer", tier: "mid", variance: 0.93 },
  { name: "Food Lion", tier: "budget", variance: 0.88 },
  { name: "Trader Joe's", tier: "specialty", variance: 0.92 },
  { name: "Whole Foods Market", tier: "premium", variance: 1.25 },
  { name: "Sprouts Farmers Market", tier: "specialty", variance: 1.10 },
  { name: "Target", tier: "mid", variance: 0.97 },
  { name: "Costco", tier: "budget", variance: 0.78 },
  { name: "Harris Teeter", tier: "mid", variance: 1.04 },
  { name: "Wegmans", tier: "premium", variance: 1.08 },
  { name: "ShopRite", tier: "mid", variance: 0.94 },
  { name: "Piggly Wiggly", tier: "budget", variance: 0.90 },
];

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function generateNearbyStores(lat, lng, radiusMiles = 20) {
  const stores = [];
  const numStores = 8 + Math.floor(seededRandom(lat * 1000 + lng) * 8);
  for (let i = 0; i < numStores && i < STORE_CHAINS.length; i++) {
    const chain = STORE_CHAINS[i];
    const angle = seededRandom(i * 100 + lat) * Math.PI * 2;
    const dist = seededRandom(i * 200 + lng) * radiusMiles;
    const dLat = (dist / 69) * Math.cos(angle);
    const dLng = (dist / (69 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
    const storeLat = lat + dLat;
    const storeLng = lng + dLng;

    const prices = {};
    GROCERY_DB.forEach((item, idx) => {
      const itemSeed = i * 10000 + idx * 100 + Math.floor(lat * 10);
      const itemVariance = 0.9 + seededRandom(itemSeed) * 0.2;
      prices[item.name] = Math.round(item.basePrice * chain.variance * itemVariance * 100) / 100;
    });

    stores.push({
      id: `store-${i}`,
      name: chain.name,
      address: `${Math.floor(1000 + seededRandom(i * 300 + lat) * 9000)} ${["Main St", "Oak Ave", "Elm Dr", "Market Blvd", "Commerce Way", "Pine Rd"][i % 6]}`,
      distance: Math.round(dist * 10) / 10,
      lat: storeLat,
      lng: storeLng,
      tier: chain.tier,
      prices,
    });
  }
  return stores.sort((a, b) => a.distance - b.distance);
}

function calculateCartTotal(store, items) {
  return items.reduce((sum, item) => {
    const price = store.prices[item.name] || item.basePrice;
    return sum + price * item.qty;
  }, 0);
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
  check: icon(18, <><polyline points="20 6 9 17 4 12"/></>),
  star: icon(16, <><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></>, "currentColor"),
  logout: icon(18, <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>),
  back: icon(20, <><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></>),
  dollar: icon(20, <><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></>),
  tag: icon(14, <><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>),
};

const TIER_COLORS = {
  budget: "#22c55e",
  mid: "#3b82f6",
  specialty: "#f59e0b",
  premium: "#a855f7",
};

// ─── App Component ───
export default function GroceryApp() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login"); // login, register, lists, editList, results
  const [lists, setLists] = useState([]);
  const [currentList, setCurrentList] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationName, setLocationName] = useState("");
  const [stores, setStores] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [expandedStore, setExpandedStore] = useState(null);
  const [animateIn, setAnimateIn] = useState(false);
  const searchRef = useRef(null);

  // ── Auth ──
  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      setError("Please fill in both fields");
      return;
    }
    const userData = await Storage.get(`user:${loginForm.username}`);
    if (!userData || userData.password !== loginForm.password) {
      setError("Invalid username or password");
      return;
    }
    setUser(userData);
    setError("");
    const userLists = await Storage.get(`lists:${loginForm.username}`) || [];
    setLists(userLists);
    triggerTransition("lists");
  };

  const handleRegister = async () => {
    if (!loginForm.username || !loginForm.password) {
      setError("Please fill in both fields");
      return;
    }
    if (loginForm.username.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    const existing = await Storage.get(`user:${loginForm.username}`);
    if (existing) {
      setError("Username already taken");
      return;
    }
    const userData = { username: loginForm.username, password: loginForm.password };
    await Storage.set(`user:${loginForm.username}`, userData);
    setUser(userData);
    setLists([]);
    setError("");
    triggerTransition("lists");
  };

  const handleLogout = () => {
    setUser(null);
    setLists([]);
    setCurrentList(null);
    setLoginForm({ username: "", password: "" });
    triggerTransition("login");
  };

  // ── Location ──
  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationName("Geolocation not supported — using default (Dover, NH)");
      setLocation({ lat: 43.1979, lng: -70.8737 });
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationName(`${pos.coords.latitude.toFixed(3)}°N, ${pos.coords.longitude.toFixed(3)}°W`);
        setLoading(false);
      },
      () => {
        setLocation({ lat: 43.1979, lng: -70.8737 });
        setLocationName("Dover, NH (default)");
        setLoading(false);
      },
      { timeout: 8000 }
    );
  }, []);

  useEffect(() => { if (user) getLocation(); }, [user, getLocation]);

  useEffect(() => {
    if (location) {
      setStores(generateNearbyStores(location.lat, location.lng));
    }
  }, [location]);

  // ── List Management ──
  const saveLists = async (newLists) => {
    setLists(newLists);
    if (user) await Storage.set(`lists:${user.username}`, newLists);
  };

  const createList = () => {
    const newList = { id: Date.now().toString(), name: "New Grocery List", items: [], createdAt: new Date().toISOString() };
    setCurrentList(newList);
    triggerTransition("editList");
  };

  const saveCurrentList = async () => {
    if (!currentList) return;
    const idx = lists.findIndex(l => l.id === currentList.id);
    const newLists = idx >= 0 ? lists.map(l => l.id === currentList.id ? currentList : l) : [...lists, currentList];
    await saveLists(newLists);
  };

  const deleteList = async (id) => {
    await saveLists(lists.filter(l => l.id !== id));
  };

  const addItem = (groceryItem) => {
    if (!currentList) return;
    const exists = currentList.items.find(i => i.name === groceryItem.name);
    if (exists) {
      setCurrentList({
        ...currentList,
        items: currentList.items.map(i => i.name === groceryItem.name ? { ...i, qty: i.qty + 1 } : i)
      });
    } else {
      setCurrentList({
        ...currentList,
        items: [...currentList.items, { ...groceryItem, qty: 1 }]
      });
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const updateItemQty = (name, delta) => {
    if (!currentList) return;
    setCurrentList({
      ...currentList,
      items: currentList.items.map(i => i.name === name ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0)
    });
  };

  const removeItem = (name) => {
    if (!currentList) return;
    setCurrentList({ ...currentList, items: currentList.items.filter(i => i.name !== name) });
  };

  // ── Search ──
  useEffect(() => {
    if (searchQuery.trim().length < 1) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    setSearchResults(GROCERY_DB.filter(item =>
      item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
    ).slice(0, 8));
  }, [searchQuery]);

  // ── Price Comparison ──
  const comparePrices = () => {
    if (!currentList || currentList.items.length === 0 || stores.length === 0) return;
    const ranked = stores.map(store => ({
      ...store,
      total: calculateCartTotal(store, currentList.items),
      itemPrices: currentList.items.map(item => ({
        name: item.name,
        qty: item.qty,
        unitPrice: store.prices[item.name] || item.basePrice,
        subtotal: (store.prices[item.name] || item.basePrice) * item.qty,
      }))
    })).sort((a, b) => a.total - b.total);
    setResults(ranked.slice(0, 5));
    triggerTransition("results");
  };

  const triggerTransition = (newView) => {
    setAnimateIn(false);
    setTimeout(() => { setView(newView); setAnimateIn(true); }, 50);
  };

  useEffect(() => { setAnimateIn(true); }, []);

  // Save list on changes
  useEffect(() => { if (currentList && user) saveCurrentList(); }, [currentList]);

  const categories = [...new Set(GROCERY_DB.map(i => i.category))];

  // ─── RENDER ───
  return (
    <div style={styles.app}>
      <div style={styles.grain} />

      {/* ── Login / Register ── */}
      {view === "login" && (
        <div style={{ ...styles.centerPanel, opacity: animateIn ? 1 : 0, transform: animateIn ? "translateY(0)" : "translateY(20px)", transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <div style={styles.logoArea}>
            <div style={styles.logoIcon}>{Icons.cart}</div>
            <h1 style={styles.logoTitle}>CartScout</h1>
            <p style={styles.logoSub}>Find the cheapest groceries near you</p>
          </div>
          <div style={styles.authCard}>
            {error && <div style={styles.errorBanner}>{error}</div>}
            <label style={styles.label}>Username</label>
            <input
              style={styles.input}
              value={loginForm.username}
              onChange={e => { setLoginForm({ ...loginForm, username: e.target.value }); setError(""); }}
              placeholder="Enter username"
              onKeyDown={e => e.key === "Enter" && handleLogin()}
            />
            <label style={{ ...styles.label, marginTop: 16 }}>Password</label>
            <input
              style={styles.input}
              type="password"
              value={loginForm.password}
              onChange={e => { setLoginForm({ ...loginForm, password: e.target.value }); setError(""); }}
              placeholder="Enter password"
              onKeyDown={e => e.key === "Enter" && handleLogin()}
            />
            <button style={styles.primaryBtn} onClick={handleLogin}>Sign In</button>
            <button style={styles.secondaryBtn} onClick={() => { setView("register"); setError(""); }}>Create Account</button>
          </div>
        </div>
      )}

      {view === "register" && (
        <div style={{ ...styles.centerPanel, opacity: animateIn ? 1 : 0, transform: animateIn ? "translateY(0)" : "translateY(20px)", transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <div style={styles.logoArea}>
            <div style={styles.logoIcon}>{Icons.cart}</div>
            <h1 style={styles.logoTitle}>CartScout</h1>
            <p style={styles.logoSub}>Create your account</p>
          </div>
          <div style={styles.authCard}>
            {error && <div style={styles.errorBanner}>{error}</div>}
            <label style={styles.label}>Choose a Username</label>
            <input
              style={styles.input}
              value={loginForm.username}
              onChange={e => { setLoginForm({ ...loginForm, username: e.target.value }); setError(""); }}
              placeholder="At least 3 characters"
              onKeyDown={e => e.key === "Enter" && handleRegister()}
            />
            <label style={{ ...styles.label, marginTop: 16 }}>Choose a Password</label>
            <input
              style={styles.input}
              type="password"
              value={loginForm.password}
              onChange={e => { setLoginForm({ ...loginForm, password: e.target.value }); setError(""); }}
              placeholder="Enter password"
              onKeyDown={e => e.key === "Enter" && handleRegister()}
            />
            <button style={styles.primaryBtn} onClick={handleRegister}>Create Account</button>
            <button style={styles.secondaryBtn} onClick={() => { triggerTransition("login"); setError(""); }}>Back to Sign In</button>
          </div>
        </div>
      )}

      {/* ── Lists Dashboard ── */}
      {view === "lists" && user && (
        <div style={{ ...styles.mainPanel, opacity: animateIn ? 1 : 0, transform: animateIn ? "translateY(0)" : "translateY(12px)", transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <header style={styles.header}>
            <div style={styles.headerLeft}>
              <div style={styles.headerLogo}>{Icons.cart}</div>
              <div>
                <h2 style={styles.headerTitle}>CartScout</h2>
                <span style={styles.headerSub}>Welcome, {user.username}</span>
              </div>
            </div>
            <div style={styles.headerRight}>
              <div style={styles.locationChip}>{Icons.pin} <span>{locationName || "Locating..."}</span></div>
              <button style={styles.iconBtn} onClick={handleLogout} title="Log out">{Icons.logout}</button>
            </div>
          </header>

          <div style={styles.content}>
            <div style={styles.sectionHeader}>
              <h3 style={styles.sectionTitle}>My Grocery Lists</h3>
              <button style={styles.addBtn} onClick={createList}>{Icons.plus} New List</button>
            </div>

            {lists.length === 0 ? (
              <div style={styles.emptyState}>
                <div style={styles.emptyIcon}>{Icons.list}</div>
                <p style={styles.emptyText}>No lists yet. Create one to start comparing prices!</p>
              </div>
            ) : (
              <div style={styles.listGrid}>
                {lists.map((list, i) => (
                  <div
                    key={list.id}
                    style={{ ...styles.listCard, animationDelay: `${i * 60}ms` }}
                    onClick={() => { setCurrentList(list); triggerTransition("editList"); }}
                  >
                    <div style={styles.listCardHeader}>
                      <h4 style={styles.listCardTitle}>{list.name}</h4>
                      <button
                        style={styles.deleteBtn}
                        onClick={e => { e.stopPropagation(); deleteList(list.id); }}
                      >{Icons.trash}</button>
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
                <h3 style={styles.sectionTitle}>{stores.length} Stores Within 20 Miles</h3>
                <div style={styles.storeChips}>
                  {stores.slice(0, 8).map(s => (
                    <span key={s.id} style={{ ...styles.storeChip, borderColor: TIER_COLORS[s.tier] }}>
                      <span style={{ ...styles.tierDot, background: TIER_COLORS[s.tier] }} />
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

      {/* ── Edit List ── */}
      {view === "editList" && currentList && (
        <div style={{ ...styles.mainPanel, opacity: animateIn ? 1 : 0, transform: animateIn ? "translateY(0)" : "translateY(12px)", transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <header style={styles.header}>
            <div style={styles.headerLeft}>
              <button style={styles.backBtn} onClick={() => triggerTransition("lists")}>{Icons.back}</button>
              <input
                style={styles.listNameInput}
                value={currentList.name}
                onChange={e => setCurrentList({ ...currentList, name: e.target.value })}
                placeholder="List name..."
              />
            </div>
            <button
              style={{ ...styles.primaryBtn, margin: 0, opacity: currentList.items.length === 0 ? 0.4 : 1, padding: "10px 24px" }}
              disabled={currentList.items.length === 0}
              onClick={comparePrices}
            >
              {Icons.dollar} Compare Prices
            </button>
          </header>

          <div style={styles.content}>
            {/* Search */}
            <div style={styles.searchArea}>
              <div style={styles.searchBox}>
                {Icons.search}
                <input
                  ref={searchRef}
                  style={styles.searchInput}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search groceries (e.g. milk, chicken, bananas)..."
                />
              </div>
              {searchResults.length > 0 && (
                <div style={styles.searchDropdown}>
                  {searchResults.map(item => (
                    <button key={item.name} style={styles.searchItem} onClick={() => addItem(item)}>
                      <div>
                        <span style={styles.searchItemName}>{item.name}</span>
                        <span style={styles.searchItemCat}>{item.category}</span>
                      </div>
                      <span style={styles.searchItemPrice}>${item.basePrice.toFixed(2)} avg</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Browse by Category */}
            {searchQuery === "" && currentList.items.length === 0 && (
              <div style={styles.browseSection}>
                <p style={styles.browseHint}>Or browse by category:</p>
                <div style={styles.catGrid}>
                  {categories.map(cat => (
                    <button key={cat} style={styles.catButton} onClick={() => setSearchQuery(cat)}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Current Items */}
            {currentList.items.length > 0 && (
              <div style={styles.itemList}>
                <div style={styles.itemListHeader}>
                  <span>{currentList.items.length} item{currentList.items.length !== 1 ? "s" : ""}</span>
                  <span style={styles.estTotal}>
                    Est. total: ${currentList.items.reduce((s, i) => s + i.basePrice * i.qty, 0).toFixed(2)}
                  </span>
                </div>
                {currentList.items.map((item, idx) => (
                  <div key={item.name} style={{ ...styles.itemRow, animationDelay: `${idx * 30}ms` }}>
                    <div style={styles.itemInfo}>
                      <span style={styles.itemName}>{item.name}</span>
                      <span style={styles.itemCat}>{Icons.tag} {item.category}</span>
                    </div>
                    <div style={styles.qtyControls}>
                      <button style={styles.qtyBtn} onClick={() => updateItemQty(item.name, -1)}>{Icons.minus}</button>
                      <span style={styles.qtyNum}>{item.qty}</span>
                      <button style={styles.qtyBtn} onClick={() => updateItemQty(item.name, 1)}>{Icons.plus}</button>
                    </div>
                    <span style={styles.itemSubtotal}>${(item.basePrice * item.qty).toFixed(2)}</span>
                    <button style={styles.removeBtn} onClick={() => removeItem(item.name)}>{Icons.trash}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {view === "results" && results.length > 0 && (
        <div style={{ ...styles.mainPanel, opacity: animateIn ? 1 : 0, transform: animateIn ? "translateY(0)" : "translateY(12px)", transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <header style={styles.header}>
            <div style={styles.headerLeft}>
              <button style={styles.backBtn} onClick={() => triggerTransition("editList")}>{Icons.back}</button>
              <h2 style={styles.headerTitle}>Price Comparison</h2>
            </div>
            <span style={styles.resultsMeta}>{currentList?.name} · {currentList?.items.length} items</span>
          </header>

          <div style={styles.content}>
            <div style={styles.savingsBanner}>
              <div style={styles.savingsAmount}>
                Save ${(results[results.length - 1].total - results[0].total).toFixed(2)}
              </div>
              <div style={styles.savingsDesc}>
                by shopping at <strong>{results[0].name}</strong> instead of {results[results.length - 1].name}
              </div>
            </div>

            <div style={styles.resultsGrid}>
              {results.map((store, idx) => {
                const isExpanded = expandedStore === store.id;
                const isBest = idx === 0;
                return (
                  <div
                    key={store.id}
                    style={{
                      ...styles.resultCard,
                      ...(isBest ? styles.resultCardBest : {}),
                      animationDelay: `${idx * 80}ms`,
                    }}
                    onClick={() => setExpandedStore(isExpanded ? null : store.id)}
                  >
                    <div style={styles.resultHeader}>
                      <div style={styles.resultRank}>
                        {isBest ? (
                          <span style={styles.bestBadge}>{Icons.star} BEST PRICE</span>
                        ) : (
                          <span style={styles.rankNum}>#{idx + 1}</span>
                        )}
                      </div>
                      <div style={styles.resultInfo}>
                        <h4 style={styles.resultName}>{store.name}</h4>
                        <p style={styles.resultAddr}>{Icons.pin} {store.address} — {store.distance} mi away</p>
                      </div>
                      <div style={styles.resultTotal}>
                        <span style={styles.totalAmount}>${store.total.toFixed(2)}</span>
                        <span style={{ ...styles.tierTag, background: TIER_COLORS[store.tier] + "22", color: TIER_COLORS[store.tier] }}>
                          {store.tier}
                        </span>
                      </div>
                    </div>

                    {isBest && !isExpanded && (
                      <p style={styles.expandHint}>Tap to see item breakdown</p>
                    )}

                    {isExpanded && (
                      <div style={styles.breakdown}>
                        <div style={styles.breakdownHeader}>
                          <span>Item</span>
                          <span>Qty</span>
                          <span>Unit</span>
                          <span>Subtotal</span>
                        </div>
                        {store.itemPrices.map(ip => (
                          <div key={ip.name} style={styles.breakdownRow}>
                            <span style={styles.bkName}>{ip.name}</span>
                            <span style={styles.bkQty}>×{ip.qty}</span>
                            <span style={styles.bkUnit}>${ip.unitPrice.toFixed(2)}</span>
                            <span style={styles.bkSub}>${ip.subtotal.toFixed(2)}</span>
                          </div>
                        ))}
                        <div style={styles.breakdownTotal}>
                          <span>Total</span>
                          <span>${store.total.toFixed(2)}</span>
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
    </div>
  );
}

// ─── Styles ───
const styles = {
  app: {
    minHeight: "100vh",
    width: "100%",
    background: "linear-gradient(145deg, #0c0f1a 0%, #131829 40%, #0f1520 100%)",
    fontFamily: "'DM Sans', 'Outfit', system-ui, sans-serif",
    color: "#e2e8f0",
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
  },
  grain: {
    position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.03,
    background: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")",
  },
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
    transition: "border-color 0.2s",
  },
  primaryBtn: {
    width: "100%", padding: "14px", borderRadius: 12, border: "none", cursor: "pointer",
    background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", fontSize: 15, fontWeight: 700,
    marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    boxShadow: "0 4px 20px rgba(99,102,241,0.3)", transition: "transform 0.15s, box-shadow 0.15s",
  },
  secondaryBtn: {
    width: "100%", padding: "12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
    background: "transparent", color: "#94a3b8", fontSize: 14, fontWeight: 600, marginTop: 12, cursor: "pointer",
  },
  errorBanner: {
    background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10,
    padding: "10px 14px", color: "#fca5a5", fontSize: 13, marginBottom: 16,
  },
  mainPanel: { position: "relative", zIndex: 1, maxWidth: 1200, width: "100%", margin: "0 auto", padding: "0 32px 40px", boxSizing: "border-box" },
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0", gap: 12,
    borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 24, flexWrap: "wrap",
  },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  headerLogo: {
    width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(135deg, #22d3ee, #6366f1)", color: "#fff",
  },
  headerTitle: { fontSize: 20, fontWeight: 800, margin: 0, color: "#f1f5f9", letterSpacing: "-0.01em" },
  headerSub: { fontSize: 13, color: "#64748b" },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  locationChip: {
    display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#22d3ee",
    background: "rgba(34,211,238,0.08)", padding: "6px 12px", borderRadius: 20,
    border: "1px solid rgba(34,211,238,0.15)",
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)", color: "#94a3b8", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
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
    padding: 20, cursor: "pointer", transition: "all 0.2s",
    animation: "fadeSlideIn 0.4s ease both",
  },
  listCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  listCardTitle: { fontSize: 16, fontWeight: 700, margin: 0, color: "#f1f5f9" },
  deleteBtn: {
    background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: 4,
    borderRadius: 6, transition: "color 0.15s",
  },
  listCardMeta: { fontSize: 13, color: "#64748b", marginTop: 8 },
  dot: { margin: "0 6px" },
  listCardCategories: { display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" },
  catChip: {
    fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(99,102,241,0.12)",
    color: "#818cf8", fontWeight: 600,
  },
  listNameInput: {
    fontSize: 20, fontWeight: 800, background: "none", border: "none", color: "#f1f5f9",
    outline: "none", flex: 1, minWidth: 200,
  },
  searchArea: { position: "relative", marginBottom: 24 },
  searchBox: {
    display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 14,
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8",
  },
  searchInput: {
    flex: 1, background: "none", border: "none", color: "#e2e8f0", fontSize: 15, outline: "none",
  },
  searchDropdown: {
    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10, marginTop: 6,
    background: "#1e2336", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14,
    boxShadow: "0 16px 48px rgba(0,0,0,0.5)", overflow: "hidden",
  },
  searchItem: {
    display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px",
    border: "none", background: "none", color: "#e2e8f0", cursor: "pointer", width: "100%",
    textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.04)", transition: "background 0.15s",
  },
  searchItemName: { fontSize: 14, fontWeight: 600, display: "block" },
  searchItemCat: { fontSize: 12, color: "#64748b" },
  searchItemPrice: { fontSize: 13, color: "#22d3ee", fontWeight: 600 },
  browseSection: { marginBottom: 24 },
  browseHint: { fontSize: 13, color: "#64748b", marginBottom: 12 },
  catGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  catButton: {
    padding: "8px 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.04)", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer",
    transition: "all 0.15s",
  },
  itemList: {
    background: "rgba(255,255,255,0.03)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  itemListHeader: {
    display: "flex", justifyContent: "space-between", padding: "14px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 13, fontWeight: 600, color: "#64748b",
  },
  estTotal: { color: "#22d3ee" },
  itemRow: {
    display: "flex", alignItems: "center", padding: "12px 20px", gap: 12,
    borderBottom: "1px solid rgba(255,255,255,0.03)",
    animation: "fadeSlideIn 0.3s ease both",
  },
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
  removeBtn: {
    background: "none", border: "none", color: "#475569", cursor: "pointer", padding: 4, borderRadius: 6,
  },
  storeChips: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 },
  storeChip: {
    display: "flex", alignItems: "center", gap: 6, fontSize: 12, padding: "6px 12px", borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", background: "rgba(255,255,255,0.02)",
  },
  tierDot: { width: 6, height: 6, borderRadius: "50%", flexShrink: 0 },
  resultsMeta: { fontSize: 13, color: "#64748b" },
  savingsBanner: {
    background: "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,211,238,0.08))",
    border: "1px solid rgba(34,197,94,0.2)", borderRadius: 16, padding: "24px 28px", marginBottom: 24,
    textAlign: "center",
  },
  savingsAmount: {
    fontSize: 32, fontWeight: 800, color: "#22c55e",
    background: "linear-gradient(135deg, #22c55e, #22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
  },
  savingsDesc: { fontSize: 14, color: "#94a3b8", marginTop: 4 },
  resultsGrid: { display: "flex", flexDirection: "column", gap: 12 },
  resultCard: {
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16,
    padding: 20, cursor: "pointer", transition: "all 0.2s",
    animation: "fadeSlideIn 0.4s ease both",
  },
  resultCardBest: {
    background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)",
    boxShadow: "0 4px 24px rgba(34,197,94,0.1)",
  },
  resultHeader: { display: "flex", alignItems: "center", gap: 16 },
  resultRank: { flexShrink: 0 },
  bestBadge: {
    display: "flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.15)",
    color: "#22c55e", fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 8,
    letterSpacing: "0.05em",
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
  breakdownRow: {
    display: "grid", gridTemplateColumns: "1fr 50px 70px 80px", gap: 8, padding: "6px 0",
    borderBottom: "1px solid rgba(255,255,255,0.03)", fontSize: 13,
  },
  bkName: { color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  bkQty: { color: "#64748b", textAlign: "center" },
  bkUnit: { color: "#94a3b8", textAlign: "right" },
  bkSub: { color: "#e2e8f0", fontWeight: 600, textAlign: "right" },
  breakdownTotal: {
    display: "flex", justifyContent: "space-between", padding: "12px 0 0", marginTop: 4,
    borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 15, fontWeight: 800, color: "#f1f5f9",
  },
};

// Inject keyframe animation
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
  `;
  document.head.appendChild(styleEl);
}