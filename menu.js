/** Menu dùng chung – load từ Firebase `menus` — chỉnh hết trong Admin */
const DEFAULT_MENUS = [
  { id: "m_home", label: "TRANG CHỦ", url: "./", icon: "fa-house", order: 1 },
  { id: "m_photo", label: "ẢNH COSPLAY", url: "list/?type=photo", icon: "fa-image", order: 2 },
  { id: "m_ai", label: "AI", url: "list/?type=all&q=ai", icon: "fa-gear", order: 3 },
  { id: "m_video", label: "VIDEO COSPLAYER", url: "list/?type=video", icon: "fa-video", order: 4 },
  { id: "m_list", label: "LIST COSPLAYER", url: "list/?type=list-cosplayer", icon: "fa-list", order: 5 },
  { id: "m_gum", label: "LIST GUMROAD", url: "list/?type=all&q=gumroad", icon: "fa-box", order: 6 },
  { id: "m_of", label: "LIST ONLYFANS & PATREON", url: "list/?type=all&q=onlyfans", icon: "fa-list", order: 7 },
  { id: "m_forum", label: "FORUM", url: "list/?type=all", icon: "fa-heart", order: 8 }
];

function menusToArray(obj) {
  if (!obj) return [];
  return Object.keys(obj)
    .map((k) => ({ id: k, ...(obj[k] || {}) }))
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

async function fetchMenus() {
  await initFirebase();
  const snap = await firebaseDb.ref("menus").once("value");
  const arr = menusToArray(snap.val());
  if (arr.length) return arr;
  return DEFAULT_MENUS.slice();
}

function postUrl(id) {
  // Từ root: post/?id=  | từ list/ hoặc post/: cần relative
  const path = location.pathname || "";
  if (path.indexOf("/list") !== -1 || path.indexOf("/post") !== -1) {
    return "../post/?id=" + encodeURIComponent(id);
  }
  return "post/?id=" + encodeURIComponent(id);
}

function resolveMenuUrl(url) {
  if (!url) return "./";
  if (/^https?:\/\//i.test(url) || url.startsWith("#") || url.startsWith("?")) return url;
  const path = location.pathname || "";
  const inSub = path.indexOf("/list") !== -1 || path.indexOf("/post") !== -1;
  if (!inSub) return url;
  // đang ở /list/ hoặc /post/ → chỉnh path tương đối
  if (url === "./" || url === "/" || url === "index.html") return "../";
  if (url.startsWith("list/")) return "../" + url;
  if (url.startsWith("cosplayers/")) return "../" + url;
  if (url.startsWith("post/")) return "../" + url;
  if (url.startsWith("./")) return "../" + url.slice(2);
  return "../" + url;
}

function renderNav(menus) {
  const nav = document.getElementById("mainNav");
  if (!nav) return;
  nav.innerHTML = menus
    .map((m) => {
      const raw = m.url || "./";
      const url = resolveMenuUrl(raw);
      const icon = m.icon ? `<i class="fa-solid ${m.icon}"></i> ` : "";
      return `<a href="${url}" class="nav-item">${icon}${escapeMenu(m.label)}</a>`;
    })
    .join("");
}

function escapeMenu(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

async function initSiteHeader() {
  try {
    const menus = await fetchMenus();
    renderNav(menus);
  } catch (e) {
    console.warn("menu", e);
    renderNav(DEFAULT_MENUS);
  }
}

async function saveMenuItem(item) {
  await initFirebase();
  if (!item.id) item.id = "m_" + Date.now().toString(36);
  await firebaseDb.ref("menus/" + item.id).set({
    label: item.label || "",
    url: item.url || "./",
    icon: item.icon || "fa-link",
    order: parseInt(item.order, 10) || 0
  });
  return item.id;
}

async function deleteMenuItem(id) {
  await initFirebase();
  await firebaseDb.ref("menus/" + id).remove();
}

async function seedDefaultMenus() {
  await initFirebase();
  const updates = {};
  DEFAULT_MENUS.forEach((m) => {
    updates[m.id] = { label: m.label, url: m.url, icon: m.icon, order: m.order };
  });
  await firebaseDb.ref("menus").set(updates);
}