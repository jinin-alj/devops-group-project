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

function contrastTextColor(color) {
  const channels = colorToRgb(color);
  if (!channels) return "#2a2420";
  const linear = channels.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  return luminance > 0.179 ? "#2a2420" : "#fffaf6";
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

function garmentSvg(category, fill) {
  const color = fill || "#8f3d3d";
  const key = String(category || "top").toLowerCase();
  const shapes = {
    top: `<path d="M8 6.5 12 4.5l4 2 2.5-1.2L21 8.5l-2.2 1.7V19.5H5.2V10.2L3 8.5l2.5-3.2z" fill="${color}"/>
      <path d="M9.2 8.2h5.6v2.1H9.2z" fill="#fff" opacity=".28"/>`,
    bottom: `<path d="M8 4.5h8l-.7 15H12.7L12 11.5l-.7 8H8.7z" fill="${color}"/>
      <path d="M9.2 6.2h5.6" stroke="#fff" stroke-width="1.2" opacity=".35"/>`,
    dress: `<path d="M10 3.5h4l1 6 3.5 10.5h-13L9 9.5z" fill="${color}"/>`,
    shoes: `<path d="M3.5 11.2c2-1.4 3.8-3.2 6.8-3.2h6.2c2 0 3.5 1.5 3.5 3.4v2.2H3.5z" fill="${color}"/>
      <path d="M5.2 13.6h13.2" stroke="#fff" stroke-width="1.1" opacity=".35"/>
      <path d="M4.2 13.6v2.8c0 .7.6 1.2 1.2 1.2h1.4c.6 0 1.1-.5 1.1-1.2v-.6h8.4v.6c0 .7.5 1.2 1.1 1.2h1.4c.7 0 1.2-.5 1.2-1.2v-2.8" fill="none" stroke="${color}" stroke-width="1.4"/>`,
    outerwear: `<path d="M7.5 6.2 12 4l4.5 2.2 2.8-1L22 8.2l-2.4 1.5V20H4.4V9.7L2 8.2l2.7-3z" fill="${color}"/>
      <path d="M12 7.2V20" stroke="#fff" stroke-width="1.3" opacity=".35"/>`,
  };
  const body = shapes[key] || shapes.top;
  return `<span class="garment" aria-hidden="true"><svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${body}</svg></span>`;
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
    card.innerHTML = garmentSvg(item.category, item.color);
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
    tile.style.background = pastelFor(item);
    tile.innerHTML = garmentSvg(item.category, item.color);
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
    icon.style.background = pastelFor(item);
    icon.innerHTML = garmentSvg(item.category, item.color);
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

function renderItems() {
  els.itemsList.textContent = "";
  els.itemsEmpty.hidden = state.items.length > 0;
  els.itemsEmpty.textContent = state.items.length ? "" : "No items yet. Add your first item.";
  state.items.forEach((item) => {
    const row = document.createElement("li");
    row.className = "item";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.itemId = item.id;
    checkbox.setAttribute("aria-label", `Select ${item.name}`);
    const body = document.createElement("div");
    body.className = "item-body";
    body.style.backgroundColor = colorToRgb(item.color) ? item.color : pastelFor(item);
    body.style.color = contrastTextColor(item.color);
    const name = document.createElement("strong");
    name.textContent = item.name;
    const details = document.createElement("span");
    details.textContent = `${item.category}, warmth ${item.warmth}, €${Number(item.price).toFixed(2)}`;
    body.append(name, details);
    const actions = document.createElement("div");
    actions.className = "item-actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn-ghost";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => startEdit(item));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn-danger";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteItem(item));
    actions.append(edit, remove);
    row.append(checkbox, body, actions);
    els.itemsList.append(row);
  });
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