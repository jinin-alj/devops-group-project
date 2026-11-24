const serviceUrls = {
  wardrobe: window.APP_CONFIG.wardrobeUrl,
  outfit: window.APP_CONFIG.outfitUrl,
};

const MADRID = { lat: 40.4168, lon: -3.7038 };
const requestTimeoutMs = 20000;

const state = {
  items: [],
  unworn: [],
  outfitIds: [],
  weather: null,
};

const els = {
  dateLabel: document.getElementById("date-label"),
  greeting: document.getElementById("greeting"),
  greetingSub: document.getElementById("greeting-sub"),
  syncPill: document.getElementById("sync-pill"),
  syncLabel: document.getElementById("sync-label"),
  outfitTitle: document.getElementById("outfit-title"),
  outfitCopy: document.getElementById("outfit-copy"),
  outfitPieces: document.getElementById("outfit-pieces"),
  outfitMessage: document.getElementById("outfit-message"),
  homeTemp: document.getElementById("home-temp"),
  homeWeatherCopy: document.getElementById("home-weather-copy"),
  homeHours: document.getElementById("home-hours"),
  weatherTemp: document.getElementById("weather-temp"),
  weatherCopy: document.getElementById("weather-copy"),
  weatherHours: document.getElementById("weather-hours"),
  weatherMessage: document.getElementById("weather-message"),
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
    weather: ["A quick look at Madrid before you choose layers.", "Weather"],
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

function pickByCategory(category, warmth) {
  const pool = state.items.filter((item) => item.category === category);
  if (!pool.length) return null;
  return pool
    .slice()
    .sort(
      (a, b) =>
        Math.abs(a.warmth - warmth) - Math.abs(b.warmth - warmth) || a.id - b.id,
    )[0];
}

function buildOutfit(seed = 0) {
  const warmth = targetWarmth();
  const rotated = state.items.slice(seed).concat(state.items.slice(0, seed));
  const previous = state.items;
  state.items = rotated;
  const top = pickByCategory("top", warmth);
  const bottom = pickByCategory("bottom", warmth);
  const shoes = pickByCategory("shoes", warmth);
  const outerwear = warmth >= 4 ? pickByCategory("outerwear", warmth) : null;
  state.items = previous;

  const pieces = [top, bottom, shoes, outerwear].filter(Boolean);
  state.outfitIds = pieces.map((item) => item.id);

  els.outfitPieces.textContent = "";
  if (!pieces.length) {
    els.outfitTitle.textContent = "Your closet is waiting";
    els.outfitCopy.textContent = "Add a few pieces, then come back for an outfit.";
    const empty = document.createElement("p");
    empty.className = "empty empty-pieces";
    empty.textContent = "No items to suggest yet.";
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
  els.outfitTitle.textContent = labels[warmth] || labels[3];
  els.outfitCopy.textContent =
    state.weather?.temp != null
      ? `Soft on top, easy underneath. Made for about ${Math.round(state.weather.temp)}° in Madrid.`
      : "Something soft on top, easy on the bottom, comfy enough for the walk over.";

  // Outerwear (or the top) becomes the tall hero card on the left.
  const ordered = [...new Set([outerwear, top, bottom, shoes].filter(Boolean))];
  ordered.slice(0, 3).forEach((item) => {
    const card = document.createElement("div");
    card.className = "piece-card";
    card.title = item.name;
    card.innerHTML = garmentSvg(item.category, item.color);
    els.outfitPieces.append(card);
  });
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
    renderCostStats(cost);
    renderUnwornStats(state.unworn);
    renderCare();
  } catch (error) {
    state.unworn = [];
    renderStatsError(error.message);
    els.careList.textContent = "";
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = error.message;
    els.careList.append(p);
  }
}

async function loadItems() {
  try {
    const items = await request("wardrobe", "/items");
    state.items = Array.isArray(items) ? items : [];
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

async function loadWeather() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${MADRID.lat}&longitude=${MADRID.lon}` +
    "&hourly=temperature_2m,weathercode,windspeed_10m&forecast_days=2&timezone=Europe%2FMadrid";
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`weather failed (${response.status})`);
    const data = await response.json();
    const times = data.hourly.time;
    const temps = data.hourly.temperature_2m;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const day = tomorrow.toISOString().slice(0, 10);
    const labeled = [
      { label: "9am", stamp: "09:00" },
      { label: "12pm", stamp: "12:00" },
      { label: "3pm", stamp: "15:00" },
      { label: "6pm", stamp: "18:00" },
    ].map((slot) => {
      const index = times.indexOf(`${day}T${slot.stamp}`);
      const temp = index >= 0 ? temps[index] : null;
      return { label: slot.label, temp: Number.isFinite(temp) ? temp : 0 };
    });
    const noon = labeled[1].temp;
    state.weather = { temp: noon, hours: labeled };

    const noonIdx = times.indexOf(`${day}T12:00`);
    const code = noonIdx >= 0 ? data.hourly.weathercode[noonIdx] : null;
    const wind = noonIdx >= 0 ? data.hourly.windspeed_10m[noonIdx] : null;
    const sky = code == null ? "" : describeSky(code);
    const breeze = describeBreeze(wind);
    const summary = [sky, breeze].filter(Boolean).join(", ") || "Mild day ahead";

    els.homeTemp.textContent = `${Math.round(noon)}°`;
    els.homeWeatherCopy.textContent = summary;
    els.weatherTemp.textContent = `${Math.round(noon)}°`;
    els.weatherCopy.textContent = `Tomorrow in Madrid: ${summary.toLowerCase()}`;
    renderHours(els.homeHours, labeled);
    renderHours(els.weatherHours, labeled);
    buildOutfit();
  } catch (error) {
    els.homeTemp.textContent = "-°";
    els.homeWeatherCopy.textContent = "Weather unavailable. Outfit uses a mild default.";
    els.weatherCopy.textContent = error.message;
    setMessage(els.weatherMessage, "Could not load Open-Meteo. Home still works.", "error");
  }
}

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