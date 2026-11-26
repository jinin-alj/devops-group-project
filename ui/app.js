const serviceUrls = {
  wardrobe: window.APP_CONFIG.wardrobeUrl,
  outfit: window.APP_CONFIG.outfitUrl,
};

const requestTimeoutMs = 20000;

const state = {
  items: [],
  unworn: [],
  outfitIds: [],
  weather: null,
};
const itemColorCache = new WeakMap();
const freshnessCache = new Map();

const els = {
  dateLabel: document.getElementById("date-label"),
  greeting: document.getElementById("greeting"),
  greetingSub: document.getElementById("greeting-sub"),
  syncPill: document.getElementById("sync-pill"),
  syncLabel: document.getElementById("sync-label"),
  outfitTitle: document.getElementById("outfit-title"),
  outfitCopy: document.getElementById("outfit-copy"),
  outfitPieces: document.getElementById("outfit-pieces"),
  outfitPalette: document.getElementById("outfit-palette"),
  outfitMessage: document.getElementById("outfit-message"),
  locationName: document.getElementById("location-name"),
  homeTemp: document.getElementById("home-temp"),
  homeWeatherCopy: document.getElementById("home-weather-copy"),
  homeHours: document.getElementById("home-hours"),
  weatherTemp: document.getElementById("weather-temp"),
  weatherCopy: document.getElementById("weather-copy"),
  weatherHours: document.getElementById("weather-hours"),
  weatherMessage: document.getElementById("weather-message"),
  retryWeather: document.getElementById("retry-weather"),
  recentRow: document.getElementById("recent-row"),
  careList: document.getElementById("care-list"),
  itemForm: document.getElementById("item-form"),
  itemId: document.getElementById("item-id"),
  itemMessage: document.getElementById("item-message"),
  itemsList: document.getElementById("items-list"),
  itemsEmpty: document.getElementById("items-empty"),
  saveItem: document.getElementById("save-item"),
  cancelEdit: document.getElementById("cancel-edit"),
  colorInput: document.getElementById("item-color"),
  colorHex: document.getElementById("color-hex"),
  colorPreview: document.getElementById("color-preview"),
  wornOn: document.getElementById("worn-on"),
  wearButton: document.getElementById("wear-button"),
  wearMessage: document.getElementById("wear-message"),
  costStats: document.getElementById("cost-stats"),
  unwornStats: document.getElementById("unworn-stats"),
};

function showView(name) {
  document.querySelectorAll(".view").forEach((view) => {
    view.hidden = view.id !== `view-${name}`;
  });
  document.querySelectorAll(".nav-button").forEach((button) => {
    if (button.dataset.view === name) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  const titles = {
    home: ["Here is what to wear tomorrow.", greetingText()],
    weather: ["A local forecast to help you choose layers.", "Weather"],
    add: ["New piece? Drop it in. Takes a minute.", document.getElementById("form-title").textContent],
    clothes: ["Everything you own, in one calm place.", "My clothes"],
  };
  els.greetingSub.textContent = titles[name][0];
  if (name !== "home") els.greeting.textContent = titles[name][1];
  else els.greeting.textContent = greetingText();
}

document.querySelectorAll("[data-view]").forEach((el) => {
  el.addEventListener("click", (event) => {
    event.preventDefault();
    showView(el.dataset.view);
  });
});

function greetingText() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning, Sal";
  if (hour < 18) return "Good afternoon, Sal";
  return "Good evening, Sal";
}

function setMessage(el, message, type = "") {
  el.textContent = message;
  el.className = `message ${type}`.trim();
}

function colorToRgb(color) {
  const probe = document.createElement("span");
  probe.style.color = color;
  if (!probe.style.color) return null;
  document.body.append(probe);
  const normalized = getComputedStyle(probe).color;
  probe.remove();
  const channels = normalized.match(/[\d.]+/g);
  return channels && channels.length >= 3 ? channels.slice(0, 3).map(Number) : null;
}

function relativeLuminance(channels) {
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrastTextColor(color) {
  const channels = colorToRgb(color);
  if (!channels) return "#2a2420";
  return relativeLuminance(channels) > 0.179 ? "#2a2420" : "#fffaf6";
}

function rgbToHex(channels) {
  return `#${channels.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

// Soft pastel tile derived from the item's own colour.
function tint(color, amount = 0.82) {
  const rgb = colorToRgb(color);
  if (!rgb) return "#f5ece6";
  return `rgb(${rgb.map((c) => Math.round(c + (255 - c) * amount)).join(",")})`;
}

function pastelFor(item) {
  return tint(item.color);
}

function timeAgo(dateStr) {
  const then = new Date(dateStr);
  if (Number.isNaN(then.getTime())) return dateStr;
  const days = Math.max(0, Math.floor((Date.now() - then) / 864e5));
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

function categoryLabel(category) {
  return (
    {
      top: "Tops",
      bottom: "Bottoms",
      dress: "Dresses",
      shoes: "Shoes",
      outerwear: "Outerwear",
    }[category] || category
  );
}

const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const INK = [44, 36, 31];

function mixRgb(from, to, amount) {
  return from.map((channel, index) => channel + (to[index] - channel) * amount);
}

// Details and the tile both flip for very dark or very light items, otherwise a black boot or a white tee disappears.
function garmentColors(color) {
  const rgb = colorToRgb(color) || [143, 61, 61];
  const light = relativeLuminance(rgb);
  const dark = light < 0.08;
  let tile = mixRgb(rgb, WHITE, 0.8);
  if (light > 0.7) tile = mixRgb(rgb, INK, 0.2);
  else if (dark) tile = mixRgb(rgb, WHITE, 0.9);
  return {
    fill: rgbToHex(rgb),
    shade: rgbToHex(mixRgb(rgb, dark ? WHITE : BLACK, 0.16)),
    detail: rgbToHex(mixRgb(rgb, dark ? WHITE : BLACK, 0.42)),
    outline: rgbToHex(mixRgb(rgb, BLACK, light > 0.5 ? 0.55 : 0.5)),
    tile: rgbToHex(tile),
  };
}

function tileBackground(item) {
  return garmentColors(item.color).tile;
}

// Warmth picks the drawing, so a warmth 1 top is a tank top and a warmth 5 top is a jumper.
const GARMENT_STYLES = {
  top: ["tank", "tee", "knit"],
  bottom: ["shorts", "trousers", "cargo"],
  shoes: ["sandal", "trainer", "boot"],
  outerwear: ["bomber", "jacket", "coat"],
};

function garmentStyle(item) {
  const category = String(item.category || "").toLowerCase();
  const styles = GARMENT_STYLES[category];
  if (!styles) return category === "dress" ? "dress" : "tee";
  const warmth = Number(item.warmth) || 3;
  if (warmth <= 2) return styles[0];
  return warmth === 3 ? styles[1] : styles[2];
}

function drawingKit(c) {
  return {
    c,
    body: (d) => `<path d="${d}" fill="${c.fill}" stroke="${c.outline}" stroke-width="1.6" stroke-linejoin="round"/>`,
    band: (d) => `<path d="${d}" fill="${c.shade}" stroke="${c.outline}" stroke-width="1.1" stroke-linejoin="round"/>`,
    shade: (d) => `<path d="${d}" fill="${c.shade}" opacity=".6"/>`,
    line: (d, width = 1.3, opacity = 1) =>
      `<path d="${d}" fill="none" stroke="${c.detail}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`,
    stitch: (d) =>
      `<path d="${d}" fill="none" stroke="${c.detail}" stroke-width="1" stroke-dasharray="2 2.2" stroke-linecap="round"/>`,
    dot: (x, y, r = 1.7) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c.detail}"/>`,
    loops: (d) => `<path d="${d}" stroke="${c.outline}" stroke-width="2.2"/>`,
    // little vertical ticks along a curved hem, which is what makes a cuff read as knitted
    rib: (x1, x2, y0, depth, height) => {
      let d = "";
      for (let x = x1 + 3; x < x2 - 1; x += 3.4) {
        const t = (x - x1) / (x2 - x1);
        d += `M${x.toFixed(1)} ${(y0 + 2 * t * (1 - t) * depth + 1).toFixed(1)}v${height - 2}`;
      }
      return `<path d="${d}" fill="none" stroke="${c.detail}" stroke-width=".8" opacity=".7"/>`;
    },
  };
}

// All drawings share a 100 by 100 box so every tile can size them the same way.
const DRAWINGS = {
  tank: (k) =>
    k.body("M37 10 L42 10 Q50 30 58 10 L63 10 Q63 28 76 36 L76 88 Q50 93 24 88 L24 36 Q37 28 37 10 Z") +
    k.shade("M70 36.5 Q73.5 35.5 76 36 L76 88 Q73 88.6 70 89 Z") +
    k.stitch("M43.6 11.5 Q50 26.5 56.4 11.5") +
    k.stitch("M38.6 13 Q38.8 27.5 26 34.6") +
    k.stitch("M61.4 13 Q61.2 27.5 74 34.6") +
    k.stitch("M25.5 84.6 Q50 89.3 74.5 84.6"),
  tee: (k) =>
    k.body("M38 14 Q50 24 62 14 L79 21 L93 40 L79 49 L75 43 L75 88 Q50 92.5 25 88 L25 43 L21 49 L7 40 L21 21 Z") +
    k.shade("M70 43 L75 43 L75 88 Q72.5 88.5 70 88.8 Z") +
    k.band("M38 14 Q50 24 62 14 Q50 28.5 38 14 Z") +
    k.stitch("M10.2 37.6 L22.8 46") +
    k.stitch("M89.8 37.6 L77.2 46") +
    k.stitch("M25.6 84.4 Q50 89 74.4 84.4"),
  knit: (k) =>
    k.body("M38 14 Q50 22 62 14 L77 19 Q86 23 88 33 L94 79 L82 81 L76 46 L76 88 Q50 92.5 24 88 L24 46 L18 81 L6 79 L12 33 Q14 23 23 19 Z") +
    k.band("M38 14 Q50 22 62 14 Q50 27 38 14 Z") +
    k.band("M6.7 73 L18.7 75.2 L18 81 L6 79 Z") +
    k.band("M93.3 73 L81.3 75.2 L82 81 L94 79 Z") +
    k.band("M24 82 Q50 86.5 76 82 L76 88 Q50 92.5 24 88 Z") +
    k.rib(24, 76, 82, 4.5, 6) +
    k.line("M45 30 C41 35 49 39 45 44 C41 49 49 53 45 58 C41 63 49 67 45 72", 1.3, 0.65) +
    k.line("M55 30 C59 35 51 39 55 44 C59 49 51 53 55 58 C59 63 51 67 55 72", 1.3, 0.65),
  shorts: (k) =>
    k.body("M27 18 L73 18 L77 66 L54 68 L50 42 L46 68 L23 66 Z") +
    k.band("M27 18 L73 18 L73.6 25 L26.4 25 Z") +
    k.loops("M35 17v9M65 17v9") +
    k.line("M50 25 L50 41") +
    k.stitch("M53.5 25.5 L53.5 35 Q53.5 39 50.5 40") +
    k.line("M29.5 26 Q36 30 34 37.5") +
    k.line("M70.5 26 Q64 30 66 37.5") +
    k.stitch("M24.4 62.2 L46.5 64.2") +
    k.stitch("M53.5 64.2 L75.6 62.2"),
  trousers: (k) =>
    k.body("M30 8 L70 8 L77 94 L56 94 L50 34 L44 94 L23 94 Z") +
    k.band("M30 8 L70 8 L70.6 15 L29.4 15 Z") +
    k.loops("M37 7v9M63 7v9") +
    k.line("M50 15 L50 33") +
    k.stitch("M53.5 15.5 L53.5 27 Q53.5 30.5 50.5 31.5") +
    k.line("M32 16 Q38.5 20 36 27") +
    k.line("M68 16 Q61.5 20 64 27") +
    k.line("M37.5 30 L34 92", 1.1, 0.45) +
    k.line("M62.5 30 L66 92", 1.1, 0.45),
  cargo: (k) =>
    k.body("M30 8 L70 8 L77 94 L56 94 L50 34 L44 94 L23 94 Z") +
    k.band("M30 8 L70 8 L70.6 15 L29.4 15 Z") +
    k.loops("M37 7v9M63 7v9") +
    k.line("M50 15 L50 33") +
    k.line("M32 16 Q38.5 20 36 27") +
    k.line("M68 16 Q61.5 20 64 27") +
    `<path d="M27.6 50 L38.4 50 L38.4 63 L27.6 63 Z M61.6 50 L72.4 50 L72.4 63 L61.6 63 Z" fill="${k.c.fill}" stroke="${k.c.detail}" stroke-width="1.1"/>` +
    k.band("M27.2 47.5 L38.8 47.5 L38.8 52.5 L27.2 52.5 Z") +
    k.band("M61.2 47.5 L72.8 47.5 L72.8 52.5 L61.2 52.5 Z") +
    k.band("M23.5 87.5 L44.6 87.5 L44 94 L23 94 Z") +
    k.band("M55.4 87.5 L76.5 87.5 L77 94 L56 94 Z"),
  sandal: (k) =>
    '<path d="M10 70 Q10 64 17 64 L84 64 Q92 64 92 70 L92 72 Q92 77 86 77 L16 77 Q10 77 10 72 Z" fill="#cfb38d" stroke="#7d6248" stroke-width="1.4"/>' +
    '<path d="M12 70.5 H90" stroke="#a88a64" stroke-width="1"/>' +
    `<path d="M19.5 64 Q19 52.5 31 52 L48 55.5" fill="none" stroke="${k.c.outline}" stroke-width="5.8" stroke-linecap="round"/>` +
    `<path d="M19.5 64 Q19 52.5 31 52 L48 55.5" fill="none" stroke="${k.c.fill}" stroke-width="3.6" stroke-linecap="round"/>` +
    k.body("M41 64 Q44 49 61 48 Q80 49 83 64 Z") +
    k.line("M46.5 57.5 Q61 52.5 78 57.5", 1.2, 0.6) +
    k.stitch("M44 61.5 Q61 57 80.5 61.5") +
    `<rect x="27.5" y="48.8" width="5" height="6.4" rx="1" fill="${k.c.shade}" stroke="${k.c.outline}" stroke-width="1.2"/>`,
  trainer: (k) =>
    '<path d="M12 68 L90 68 Q93 68 93 71.5 L93 73 Q93 78 88 78 L17 78 Q12 78 12 73 Z" fill="#f6f2ec" stroke="#9a8f86" stroke-width="1.4"/>' +
    '<path d="M14 72.8 H91" stroke="#d8cfc4" stroke-width="1"/>' +
    k.body("M14 68 L14 46 Q14 40 20 39 L32 39 Q38 49 52 52 L70 54 Q87 56 89 68 Z") +
    k.band("M72 54.3 Q87 56 89 68 L74 68 Q72 61 72 54.3 Z") +
    k.band("M14 46 Q14 40 20 39 L21.5 39 L21.5 68 L14 68 Z") +
    k.line("M24 68 Q28 57 44 56") +
    k.line("M38.5 45.5 L42 50.5", 1.6) +
    k.line("M44 48.5 L46.8 53", 1.6) +
    k.line("M49.6 50.6 L51.8 54.8", 1.6) +
    k.stitch("M23 41.5 Q25 46 32 47"),
  boot: (k) =>
    '<path d="M18 80 L91 80 L91 87 Q91 89 89 89 L20 89 Q18 89 18 87 Z" fill="#3d332d" stroke="#241d19" stroke-width="1.4"/>' +
    '<path d="M36 80v9M47 85.5h40" stroke="#5c5049" stroke-width="1"/>' +
    k.body("M20 80 L20 18 Q20 12 26 12 L44 12 Q48 12 48 17 L48 47 Q52 54 66 56 Q87 58 89 71 L89 80 Z") +
    k.band("M20 18 Q20 12 26 12 L44 12 Q48 12 48 17 L48 21 L20 21 Z") +
    k.band("M70 56.6 Q87 58 89 71 L89 73 L74 73 Q71 64 70 56.6 Z") +
    k.line("M42.5 26 L47.5 29.5M42.5 29.5 L47.5 26M42.5 34 L47.5 37.5M42.5 37.5 L47.5 34M42.5 42 L47.5 45.5M42.5 45.5 L47.5 42", 1.2) +
    k.stitch("M21.5 76.8 H87.5") +
    `<path d="M20 14 Q14 14 14 19.5 Q14 25 20 25" fill="none" stroke="${k.c.outline}" stroke-width="1.6"/>`,
  bomber: (k) =>
    k.body("M36 14 L64 14 L79 20 Q87 24 89 34 L95 78 L83 80 L77 46 L77 84 L23 84 L23 46 L17 80 L5 78 L11 34 Q13 24 21 20 Z") +
    k.band("M36 14 Q50 21 64 14 L64.5 18.5 Q50 25.5 35.5 18.5 Z") +
    k.band("M23 78 L77 78 L77 84 L23 84 Z") +
    k.rib(23, 77, 78, 0, 6) +
    k.band("M5.7 72.5 L17.7 74.5 L17 80 L5 78 Z") +
    k.band("M94.3 72.5 L82.3 74.5 L83 80 L95 78 Z") +
    `<path d="M50 22 V78" stroke="${k.c.outline}" stroke-width="1.6"/>` +
    `<path d="M50 23 V77" stroke="${k.c.detail}" stroke-width="3" stroke-dasharray="0.9 1.3"/>` +
    `<rect x="48.4" y="25" width="3.2" height="6" rx="1" fill="${k.c.detail}"/>` +
    k.line("M30.5 58 L36 68", 2) +
    k.line("M69.5 58 L64 68", 2) +
    `<path d="M79.5 38.5 L86 37.5 L87 44 L80.5 45 Z" fill="none" stroke="${k.c.detail}" stroke-width="1.1"/>`,
  jacket: (k) =>
    k.body("M36 14 L64 14 L79 20 Q87 24 89 34 L95 78 L83 80 L77 46 L77 86 L23 86 L23 46 L17 80 L5 78 L11 34 Q13 24 21 20 Z") +
    k.band("M36 14 L50 30 L43 34 L31 17 Z") +
    k.band("M64 14 L50 30 L57 34 L69 17 Z") +
    k.line("M50 30 L50 86") +
    k.dot(52.6, 40) +
    k.dot(52.6, 52) +
    k.dot(52.6, 64) +
    k.dot(52.6, 76) +
    `<path d="M28 40 L42 40 L42 53 L28 53 Z M58 40 L72 40 L72 53 L58 53 Z" fill="none" stroke="${k.c.detail}" stroke-width="1.1"/>` +
    k.band("M27.5 38.5 L42.5 38.5 L42.5 43.5 L35 46 L27.5 43.5 Z") +
    k.band("M57.5 38.5 L72.5 38.5 L72.5 43.5 L65 46 L57.5 43.5 Z") +
    k.stitch("M6.3 73.5 L18 75.5") +
    k.stitch("M93.7 73.5 L82 75.5") +
    k.stitch("M24.5 82 H75.5"),
  coat: (k) =>
    k.body("M37 11 L63 11 L79 17 Q87 21 89 31 L95 76 L83 78 L78 44 L81 96 L19 96 L22 44 L17 78 L5 76 L11 31 Q13 21 21 17 Z") +
    k.band("M37 11 L50 42 L44 40.5 L31.5 22 L36 19 Z") +
    k.band("M63 11 L50 42 L56 40.5 L68.5 22 L64 19 Z") +
    k.line("M50 42 L50 96") +
    k.dot(44, 50) +
    k.dot(56, 50) +
    k.dot(44, 59) +
    k.dot(56, 59) +
    k.band("M20.7 66 L79.3 66 L79.6 72 L20.4 72 Z") +
    `<rect x="46" y="64.5" width="8" height="9" rx="1.2" fill="none" stroke="${k.c.detail}" stroke-width="1.6"/>` +
    k.line("M26 80 L37 80", 2) +
    k.line("M63 80 L74 80", 2) +
    k.stitch("M20.2 92.5 H79.8"),
  // the existing dress shape, scaled up to the new box until the backend accepts dresses
  dress: (k) =>
    `<path transform="scale(4.1667)" d="M10 3.5h4l1 6 3.5 10.5h-13L9 9.5z" fill="${k.c.fill}" stroke="${k.c.outline}" stroke-width=".4" stroke-linejoin="round"/>`,
};

// shoes are wide and flat, so they're moved up to sit in the middle of the tile
const DRAWING_LIFT = { sandal: 12, trainer: 12, boot: 2 };

function garmentSvg(item) {
  const style = garmentStyle(item);
  const markup = DRAWINGS[style](drawingKit(garmentColors(item.color)));
  const lift = DRAWING_LIFT[style] || 0;
  return `<span class="garment" aria-hidden="true"><svg viewBox="0 ${lift} 100 100" xmlns="http://www.w3.org/2000/svg">${markup}</svg></span>`;
}

function updateColorPreview() {
  const color = els.colorInput.value;
  els.colorHex.textContent = color.toUpperCase();
  els.colorPreview.style.backgroundColor = color;
  els.colorPreview.style.color = contrastTextColor(color);
  els.colorPreview.textContent =
    document.getElementById("item-name").value.trim() || "Item color preview";
}

async function request(service, path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(`${serviceUrls[service]}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      signal: controller.signal,
    });
    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.json()).detail || "";
      } catch (_error) {
        /* non-JSON */
      }
      const apiError = new Error(detail || `request failed (${response.status})`);
      apiError.status = response.status;
      throw apiError;
    }
    return response.status === 204 ? null : response.json();
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`${service} service timed out. Please try again.`);
    }
    if (error.status) throw new Error(`${service} service: ${error.message}`);
    throw new Error(`${service} service is unavailable. Please try again.`);
  } finally {
    clearTimeout(timeout);
  }
}

async function refreshHealth() {
  const results = await Promise.all(
    ["wardrobe", "outfit"].map(async (service) => {
      try {
        await request(service, "/health");
        return true;
      } catch (_error) {
        return false;
      }
    }),
  );
  const [wardrobeUp, outfitUp] = results;
  if (wardrobeUp && outfitUp) {
    els.syncPill.className = "sync-pill up";
    els.syncLabel.textContent = "Closet synced";
  } else if (wardrobeUp || outfitUp) {
    els.syncPill.className = "sync-pill down";
    els.syncLabel.textContent = wardrobeUp ? "Outfit unavailable" : "Wardrobe unavailable";
  } else {
    els.syncPill.className = "sync-pill down";
    els.syncLabel.textContent = "Services down";
  }
}

function targetWarmth() {
  const temp = state.weather?.temp;
  if (temp == null) return 3;
  if (temp <= 8) return 5;
  if (temp <= 14) return 4;
  if (temp <= 20) return 3;
  if (temp <= 26) return 2;
  return 1;
}

function colorToHsl(color) {
  const rgb = colorToRgb(color);
  if (!rgb) return null;
  const [red, green, blue] = rgb.map((channel) => channel / 255);
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  return { hue, saturation, lightness };
}

function itemColorHsl(item) {
  if (!itemColorCache.has(item)) itemColorCache.set(item, colorToHsl(item.color));
  return itemColorCache.get(item);
}

function hueDistance(first, second) {
  const difference = Math.abs(first - second);
  return Math.min(difference, 360 - difference);
}

function colorHarmonyScore(items) {
  const scores = [];
  for (let first = 0; first < items.length; first += 1) {
    for (let second = first + 1; second < items.length; second += 1) {
      const left = itemColorHsl(items[first]);
      const right = itemColorHsl(items[second]);
      if (!left || !right) {
        scores.push(-0.5);
        continue;
      }
      if (left.saturation < 0.16 || right.saturation < 0.16) {
        scores.push(0.35);
        continue;
      }
      const distance = hueDistance(left.hue, right.hue);
      if (distance <= 35) scores.push(1 - distance / 70);
      else if (distance >= 155) scores.push(1 - Math.abs(180 - distance) / 50);
      else scores.push(-0.5);
    }
  }
  return scores.length
    ? scores.reduce((total, score) => total + score, 0) / scores.length
    : 0;
}

function freshnessBonus(item) {
  const id = Number(item.id);
  if (freshnessCache.has(id)) return freshnessCache.get(id);
  const record = state.unworn.find((row) => Number(row.item_id) === id);
  let bonus = 0;
  if (record && !record.last_worn) bonus = 0.2;
  else if (record) {
    const lastWorn = Date.parse(`${record.last_worn}T00:00:00Z`);
    if (Number.isNaN(lastWorn)) bonus = 0.05;
    else {
      const days = Math.max(60, (Date.now() - lastWorn) / 864e5);
      bonus = 0.05 + Math.min((days - 60) / 365, 1) * 0.15;
    }
  }
  freshnessCache.set(id, bonus);
  return bonus;
}

function candidateScore(items, warmth) {
  const warmthDistance =
    items.reduce((total, item) => total + Math.abs(item.warmth - warmth), 0) / items.length;
  const freshness =
    items.reduce((total, item) => total + freshnessBonus(item), 0) / items.length;
  return -warmthDistance + colorHarmonyScore(items) * 0.25 + freshness;
}

function compatibleCombinations(pools) {
  return pools.reduce(
    (combinations, pool) =>
      combinations.flatMap((combination) =>
        pool
          .filter((item) => combination.every((piece) => Math.abs(piece.warmth - item.warmth) <= 2))
          .map((item) => [...combination, item]),
      ),
    [[]],
  );
}

function poolSubsets(pools, size, start = 0, current = [], result = []) {
  if (current.length === size) {
    result.push(current.slice());
    return result;
  }
  for (let index = start; index < pools.length; index += 1) {
    current.push(pools[index]);
    poolSubsets(pools, size, index + 1, current, result);
    current.pop();
  }
  return result;
}

function categoryPool(category, warmth) {
  return state.items
    .filter((item) => item.category === category)
    .slice()
    .sort(
      (left, right) =>
        Math.abs(left.warmth - warmth) -
          Math.abs(right.warmth - warmth) -
          (freshnessBonus(left) - freshnessBonus(right)) * 0.25 ||
        Number(left.id) - Number(right.id),
    )
    .slice(0, 12);
}

function renderOutfitPalette(pieces) {
  els.outfitPalette.textContent = "";
  if (!pieces.length) return;

  const label = document.createElement("span");
  label.className = "palette-label";
  label.textContent = "Palette";
  const swatches = document.createElement("div");
  swatches.className = "palette-swatches";
  swatches.setAttribute("role", "list");
  const seen = new Set();
  pieces.forEach((item) => {
    const color = colorToRgb(item.color) ? item.color : pastelFor(item);
    const key = color.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const swatch = document.createElement("span");
    swatch.className = "palette-swatch";
    swatch.style.backgroundColor = color;
    swatch.title = `${item.name}: ${item.color}`;
    swatch.setAttribute("role", "listitem");
    swatch.setAttribute("aria-label", `${item.name}, ${item.color}`);
    swatches.append(swatch);
  });
  els.outfitPalette.append(label, swatches);
}

function buildOutfit(seed = 0) {
  const warmth = targetWarmth();
  const categories = ["top", "bottom", "shoes"].filter(
    (category) => state.items.some((item) => item.category === category),
  );
  const pools = categories.map((category) => categoryPool(category, warmth));
  let candidates = [];

  if (!pools.length) {
    const outerwear = categoryPool("outerwear", warmth);
    candidates = outerwear.length ? compatibleCombinations([outerwear]) : [];
  } else {
    for (let size = pools.length; size > 0; size -= 1) {
      candidates = poolSubsets(pools, size).flatMap(compatibleCombinations);
      if (candidates.length) break;
    }
  }

  if (pools.length && candidates.length && warmth >= 4) {
    const outerwear = categoryPool("outerwear", warmth);
    if (outerwear.length) {
      const layered = candidates.flatMap((combination) =>
        outerwear
          .filter((item) => combination.every((piece) => Math.abs(piece.warmth - item.warmth) <= 2))
          .map((item) => [...combination, item]),
      );
      if (layered.length) candidates = layered;
    }
  }

  els.outfitPieces.textContent = "";
  if (!candidates.length) {
    state.outfitIds = [];
    els.outfitPalette.textContent = "";
    els.outfitTitle.textContent = state.items.length
      ? "Still finding a match"
      : "Your closet is waiting";
    els.outfitCopy.textContent = state.items.length
      ? "Add pieces with warmth ratings within two points to build a compatible outfit."
      : "Add a few pieces, then come back for an outfit.";
    const empty = document.createElement("p");
    empty.className = "empty empty-pieces";
    empty.textContent = state.items.length
      ? "No warmth-compatible combination yet."
      : "No items to suggest yet.";
    els.outfitPieces.append(empty);
    return;
  }

  const labels = {
    5: "Bundle up. It’s a cold one",
    4: "Easy layers, cosy and put together",
    3: "Nothing fancy, just feels right",
    2: "Light, easy, barely thinking about it",
    1: "Keep it cool and simple",
  };
  candidates.sort((left, right) => candidateScore(right, warmth) - candidateScore(left, warmth));
  const shortlist = candidates.slice(0, Math.min(5, candidates.length));
  const pieces = shortlist[Math.abs(Math.trunc(seed)) % shortlist.length];
  state.outfitIds = pieces.map((item) => item.id);
  els.outfitTitle.textContent = labels[warmth] || labels[3];
  els.outfitCopy.textContent =
    state.weather?.temp != null
      ? `Picked for about ${Math.round(state.weather.temp)}° near you. The pieces stay within two warmth levels and coordinate by color.`
      : "Weather is unavailable, so this uses a mild-weather default and coordinates compatible colors.";

  const categoryOrder = { outerwear: 0, top: 1, bottom: 2, shoes: 3 };
  const ordered = pieces.slice().sort((left, right) => categoryOrder[left.category] - categoryOrder[right.category]);
  ordered.forEach((item) => {
    const card = document.createElement("div");
    card.className = "piece-card";
    card.title = item.name;
    card.setAttribute("aria-label", item.name);
    card.style.background = tileBackground(item);
    card.innerHTML = garmentSvg(item);
    els.outfitPieces.append(card);
  });
  renderOutfitPalette(ordered);
}

function renderRecent() {
  els.recentRow.textContent = "";
  const recent = state.items.slice().reverse().slice(0, 5);
  recent.forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "recent-card";
    const tile = document.createElement("div");
    tile.className = "recent-tile";
    tile.style.background = tileBackground(item);
    tile.innerHTML = garmentSvg(item);
    const name = document.createElement("strong");
    name.textContent = item.name;
    const meta = document.createElement("span");
    meta.textContent = categoryLabel(item.category);
    button.append(tile, name, meta);
    button.addEventListener("click", () => showView("clothes"));
    els.recentRow.append(button);
  });
  const add = document.createElement("button");
  add.type = "button";
  add.className = "recent-add";
  add.innerHTML = '<span class="plus" aria-hidden="true">+</span><span>Add an item</span>';
  add.addEventListener("click", () => showView("add"));
  els.recentRow.append(add);
}

function renderCare() {
  els.careList.textContent = "";
  if (!state.unworn.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Everything has been worn recently.";
    els.careList.append(empty);
    return;
  }
  state.unworn.slice(0, 3).forEach((row) => {
    const item = state.items.find((candidate) => candidate.id === row.item_id);
    if (!item) return;
    const rowEl = document.createElement("div");
    rowEl.className = "care-row";
    const icon = document.createElement("div");
    icon.className = "care-icon";
    icon.style.background = tileBackground(item);
    icon.innerHTML = garmentSvg(item);
    const text = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = item.name;
    const meta = document.createElement("span");
    meta.textContent = row.last_worn
      ? `Last worn ${timeAgo(row.last_worn)}`
      : "Never worn";
    text.append(name, meta);
    const action = document.createElement("button");
    action.type = "button";
    action.className = "btn-outline";
    action.textContent = "Style it";
    action.addEventListener("click", () => {
      state.outfitIds = [item.id];
      showView("home");
      setMessage(els.outfitMessage, `Ready to wear ${item.name}.`, "success");
    });
    rowEl.append(icon, text, action);
    els.careList.append(rowEl);
  });
}

const ITEM_TYPE = { top: "Top", bottom: "Bottom", dress: "Dress", shoes: "Shoes", outerwear: "Outerwear" };

function renderItems() {
  els.itemsList.textContent = "";
  els.itemsEmpty.hidden = state.items.length > 0;
  els.itemsEmpty.textContent = state.items.length ? "" : "No items yet. Add your first item.";
  state.items.forEach((item) => {
    const row = document.createElement("li");
    row.className = "item";

    // the whole card is the label, so tapping anywhere on it selects the piece
    const pick = document.createElement("label");
    pick.className = "item-pick";
    const tile = document.createElement("span");
    tile.className = "item-tile";
    tile.style.background = tileBackground(item);
    tile.innerHTML = garmentSvg(item);

    const text = document.createElement("span");
    text.className = "item-text";
    const name = document.createElement("strong");
    name.className = "item-name";
    name.textContent = item.name;
    const meta = document.createElement("span");
    meta.className = "item-meta";
    meta.textContent = `${ITEM_TYPE[item.category] || item.category}, €${Number(item.price).toFixed(2)}`;
    text.append(name, meta, warmthScale(item.warmth));

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "item-check";
    checkbox.dataset.itemId = item.id;
    checkbox.setAttribute("aria-label", `Select ${item.name}`);
    pick.append(tile, text, checkbox);

    const actions = document.createElement("div");
    actions.className = "item-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "item-link";
    edit.textContent = "Edit";
    edit.setAttribute("aria-label", `Edit ${item.name}`);
    edit.addEventListener("click", () => startEdit(item));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "item-link danger";
    remove.textContent = "Delete";
    remove.setAttribute("aria-label", `Delete ${item.name}`);
    remove.addEventListener("click", () => deleteItem(item));
    actions.append(edit, remove);

    row.append(pick, actions);
    els.itemsList.append(row);
  });
}

// dots plus the words, so warmth doesn't rely on colour alone
function warmthScale(warmth) {
  const level = Math.min(5, Math.max(1, Number(warmth) || 1));
  const scale = document.createElement("span");
  scale.className = "item-warmth";
  const dots = document.createElement("span");
  dots.className = "warmth-dots";
  dots.setAttribute("aria-hidden", "true");
  for (let step = 1; step <= 5; step += 1) {
    const dot = document.createElement("span");
    dot.className = step <= level ? "warmth-dot on" : "warmth-dot";
    dots.append(dot);
  }
  const words = document.createElement("span");
  words.textContent = `Warmth ${level} of 5`;
  scale.append(dots, words);
  return scale;
}

function itemName(id) {
  const item = state.items.find((candidate) => candidate.id === id);
  return item ? item.name : `Item #${id}`;
}

function renderCostStats(rows) {
  els.costStats.textContent = "";
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No items to report.";
    els.costStats.append(empty);
    return;
  }
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const headingRow = document.createElement("tr");
  ["Item", "Wears", "Cost/wear"].forEach((value) => {
    const th = document.createElement("th");
    th.textContent = value;
    headingRow.append(th);
  });
  head.append(headingRow);
  table.append(head);
  const body = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    [itemName(row.item_id), row.wears, `€${Number(row.cost_per_wear).toFixed(2)}`].forEach(
      (value) => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      },
    );
    body.append(tr);
  });
  table.append(body);
  els.costStats.append(table);
}

function renderUnwornStats(rows) {
  els.unwornStats.textContent = "";
  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Everything has been worn recently.";
    els.unwornStats.append(empty);
    return;
  }
  const list = document.createElement("ul");
  rows.forEach((row) => {
    const item = document.createElement("li");
    item.textContent = `${itemName(row.item_id)} (${row.last_worn || "never worn"})`;
    list.append(item);
  });
  els.unwornStats.append(list);
}

function renderStatsError(message) {
  els.costStats.textContent = "";
  els.unwornStats.textContent = "";
  [els.costStats, els.unwornStats].forEach((target) => {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = message;
    target.append(p);
  });
}

async function loadStats() {
  try {
    const [cost, unworn] = await Promise.all([
      request("outfit", "/stats/cost-per-wear"),
      request("outfit", "/stats/unworn"),
    ]);
    state.unworn = Array.isArray(unworn) ? unworn : [];
    freshnessCache.clear();
    renderCostStats(cost);
    renderUnwornStats(state.unworn);
    renderCare();
    buildOutfit();
  } catch (error) {
    state.unworn = [];
    freshnessCache.clear();
    renderStatsError(error.message);
    els.careList.textContent = "";
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = error.message;
    els.careList.append(p);
    buildOutfit();
  }
}

async function loadItems() {
  try {
    const items = await request("wardrobe", "/items");
    state.items = Array.isArray(items) ? items : [];
    freshnessCache.clear();
    renderItems();
    renderRecent();
    buildOutfit();
    await loadStats();
  } catch (error) {
    state.items = [];
    renderItems();
    renderRecent();
    buildOutfit();
    els.itemsEmpty.textContent = error.message;
    setMessage(els.itemMessage, error.message, "error");
    renderStatsError(error.message);
  }
}

function startEdit(item) {
  els.itemId.value = item.id;
  document.getElementById("item-name").value = item.name;
  document.getElementById("item-category").value = item.category;
  els.colorInput.value = rgbToHex(colorToRgb(item.color) || [201, 123, 132]);
  document.getElementById("item-warmth").value = item.warmth;
  document.getElementById("item-price").value = item.price;
  document.getElementById("form-title").textContent = "Edit item";
  els.saveItem.textContent = "Save changes";
  els.cancelEdit.hidden = false;
  showView("add");
  updateColorPreview();
}

function resetForm() {
  els.itemForm.reset();
  els.itemId.value = "";
  document.getElementById("form-title").textContent = "Add an item";
  els.saveItem.textContent = "Add item";
  els.cancelEdit.hidden = true;
  updateColorPreview();
}

function itemPayload() {
  return {
    name: document.getElementById("item-name").value.trim(),
    category: document.getElementById("item-category").value,
    color: els.colorInput.value,
    warmth: Number(document.getElementById("item-warmth").value),
    price: Number(document.getElementById("item-price").value),
  };
}

els.itemForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = els.itemId.value;
  try {
    await request("wardrobe", id ? `/items/${id}` : "/items", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(itemPayload()),
    });
    setMessage(els.itemMessage, id ? "Item updated." : "Item added.", "success");
    resetForm();
    await loadItems();
    showView("clothes");
  } catch (error) {
    setMessage(els.itemMessage, error.message, "error");
  }
});

els.cancelEdit.addEventListener("click", () => {
  resetForm();
  showView("add");
});
els.colorInput.addEventListener("input", updateColorPreview);
document.getElementById("item-name").addEventListener("input", updateColorPreview);

async function deleteItem(item) {
  if (!window.confirm(`Delete ${item.name}?`)) return;
  try {
    await request("wardrobe", `/items/${item.id}`, { method: "DELETE" });
    setMessage(els.itemMessage, `${item.name} deleted.`, "success");
    await loadItems();
  } catch (error) {
    setMessage(els.itemMessage, error.message, "error");
  }
}

async function logWear(itemIds, wornOn) {
  const payload = { item_ids: itemIds };
  if (wornOn) payload.worn_on = wornOn;
  await request("outfit", "/wears", { method: "POST", body: JSON.stringify(payload) });
  await loadStats();
}

els.wearButton.addEventListener("click", async () => {
  const itemIds = [...els.itemsList.querySelectorAll("input[type=checkbox]:checked")].map(
    (checkbox) => Number(checkbox.dataset.itemId),
  );
  if (!itemIds.length) {
    setMessage(els.wearMessage, "Select at least one item first.", "error");
    return;
  }
  try {
    await logWear(itemIds, els.wornOn.value || undefined);
    setMessage(els.wearMessage, "Wear logged.", "success");
  } catch (error) {
    setMessage(els.wearMessage, error.message, "error");
  }
});

document.getElementById("wear-outfit").addEventListener("click", async () => {
  if (!state.outfitIds.length) {
    setMessage(els.outfitMessage, "Add clothes first.", "error");
    return;
  }
  try {
    await logWear(state.outfitIds);
    setMessage(els.outfitMessage, "Outfit logged as worn today.", "success");
  } catch (error) {
    setMessage(els.outfitMessage, error.message, "error");
  }
});

let shuffleSeed = 1;
document.getElementById("shuffle-outfit").addEventListener("click", () => {
  shuffleSeed += 1;
  buildOutfit(shuffleSeed % Math.max(state.items.length, 1));
  setMessage(els.outfitMessage, "New mix ready.", "success");
});

function renderHours(target, hours) {
  target.textContent = "";
  hours.forEach((hour) => {
    const box = document.createElement("div");
    box.className = "hour";
    const value = document.createElement("strong");
    value.textContent = `${Math.round(hour.temp)}°`;
    const label = document.createElement("span");
    label.textContent = hour.label;
    box.append(value, label);
    target.append(box);
  });
}

function describeSky(code) {
  if (code === 0) return "Clear";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Foggy";
  if (code <= 67) return "Rainy";
  if (code <= 77) return "Snowy";
  return "Stormy";
}

function describeBreeze(wind) {
  if (wind == null) return "";
  if (wind < 10) return "calm";
  if (wind < 25) return "light breeze";
  return "windy";
}

function getBrowserPosition() {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("This browser does not support location access."));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => {
        const messages = {
          1: "Location permission was denied. Allow location access in your browser to see the local forecast.",
          2: "Your location is unavailable. Check device location services and try again.",
          3: "The location request timed out. Try again.",
        };
        reject(new Error(messages[error.code] || "Could not read your browser location."));
      },
      { enableHighAccuracy: false, maximumAge: 600000, timeout: 12000 },
    );
  });
}

async function loadWeather() {
  els.retryWeather.disabled = true;
  els.locationName.textContent = "Requesting location…";
  els.homeWeatherCopy.textContent = "Requesting browser location for forecast…";
  els.weatherCopy.textContent = "Waiting for location and forecast…";
  els.homeHours.textContent = "";
  els.weatherHours.textContent = "";
  setMessage(els.weatherMessage, "");

  try {
    const position = await getBrowserPosition();
    const params = new URLSearchParams({
      latitude: String(position.coords.latitude),
      longitude: String(position.coords.longitude),
      daily: "weathercode,temperature_2m_max,temperature_2m_min",
      hourly: "temperature_2m,weathercode,windspeed_10m",
      forecast_days: "2",
      timezone: "auto",
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    let response;
    try {
      response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(`Open-Meteo request failed (${response.status}).`);
    const data = await response.json();
    const times = data.hourly?.time;
    const temps = data.hourly?.temperature_2m;
    const day = data.daily?.time?.[1];
    if (!day || !Array.isArray(times) || !Array.isArray(temps)) {
      throw new Error("Open-Meteo returned an incomplete forecast.");
    }
    const labeled = [
      { label: "9am", stamp: "09:00" },
      { label: "12pm", stamp: "12:00" },
      { label: "3pm", stamp: "15:00" },
      { label: "6pm", stamp: "18:00" },
    ].map((slot) => {
      const index = times.indexOf(`${day}T${slot.stamp}`);
      const temp = index >= 0 ? temps[index] : null;
      return Number.isFinite(temp) ? { label: slot.label, temp } : null;
    }).filter(Boolean);
    const noonIdx = times.indexOf(`${day}T12:00`);
    const dailyHigh = data.daily.temperature_2m_max?.[1];
    const dailyLow = data.daily.temperature_2m_min?.[1];
    const noon = noonIdx >= 0 && Number.isFinite(temps[noonIdx])
      ? temps[noonIdx]
      : Number.isFinite(dailyHigh) && Number.isFinite(dailyLow)
        ? (dailyHigh + dailyLow) / 2
        : null;
    if (!Number.isFinite(noon)) throw new Error("Open-Meteo returned no temperature for tomorrow.");
    const code = data.daily.weathercode?.[1] ?? null;
    const wind = noonIdx >= 0 ? data.hourly.windspeed_10m?.[noonIdx] : null;
    const sky = code == null ? "" : describeSky(code);
    const breeze = describeBreeze(wind);
    const summary = [sky, breeze].filter(Boolean).join(", ") || "Mild day ahead";
    const forecastDate = new Intl.DateTimeFormat(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${day}T12:00:00Z`));
    state.weather = { temp: noon, date: day, dateLabel: forecastDate, hours: labeled };
    els.locationName.textContent = "Your location";

    els.homeTemp.textContent = `${Math.round(noon)}°`;
    els.homeWeatherCopy.textContent = summary;
    els.weatherTemp.textContent = `${Math.round(noon)}°`;
    const range =
      Number.isFinite(dailyHigh) && Number.isFinite(dailyLow)
        ? ` High ${Math.round(dailyHigh)}°, low ${Math.round(dailyLow)}°.`
        : "";
    els.weatherCopy.textContent = `${forecastDate} near you: ${summary.toLowerCase()}.${range}`;
    renderHours(els.homeHours, labeled);
    renderHours(els.weatherHours, labeled);
    buildOutfit();
  } catch (error) {
    state.weather = null;
    els.locationName.textContent = "Location unavailable";
    els.homeTemp.textContent = "-°";
    els.weatherTemp.textContent = "-°";
    els.homeWeatherCopy.textContent = "Local forecast unavailable. Outfit uses a mild-weather default.";
    const message = error.name === "AbortError"
      ? "The weather request timed out. Try again."
      : error.message === "Failed to fetch"
        ? "Could not reach Open-Meteo. Check your connection and try again."
        : error.message;
    els.weatherCopy.textContent = message;
    setMessage(els.weatherMessage, message, "error");
    buildOutfit();
  } finally {
    els.retryWeather.disabled = false;
  }
}

els.retryWeather.addEventListener("click", loadWeather);

const today = new Date();
const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long" }).format(today);
const dayMonth = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(today);
els.dateLabel.textContent = `${weekday}, ${dayMonth}`.toUpperCase();
els.greeting.textContent = greetingText();
els.greetingSub.textContent = "Here is what to wear tomorrow.";
els.wornOn.value = [
  today.getFullYear(),
  String(today.getMonth() + 1).padStart(2, "0"),
  String(today.getDate()).padStart(2, "0"),
].join("-");

updateColorPreview();
refreshHealth();
loadItems();
loadWeather();