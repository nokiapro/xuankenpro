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
  const items = menus
    .map((m) => {
      const raw = m.url || "./";
      const url = resolveMenuUrl(raw);
      const icon = m.icon ? `<i class="far ${m.icon}"></i> ` : "";
      const blank = m.openInNewTab
        ? ' target="_blank" rel="noopener noreferrer"'
        : "";
      return `<a href="${url}" class="nav-item"${blank}>${icon}${escapeMenu(m.label)}</a>`;
    })
    .join("");
  const t = getTheme();
  const themeBtn =
    `<button type="button" class="nav-item nav-theme-btn" id="themeToggle" aria-label="Đổi giao diện" title="${
      t === "dark" ? "Chế độ sáng" : "Chế độ tối"
    }">` +
    (t === "dark"
      ? '<i class="far fa-sun"></i> SÁNG'
      : '<i class="far fa-moon"></i> TỐI') +
    `</button>`;
  const searchHtml = `<form class="nav-search-form" id="navSearchForm" action="#" role="search">
    <input type="search" id="navSearchInput" class="nav-search-input" placeholder="Tìm kiếm..." autocomplete="off" />
    <button type="submit" class="nav-search-btn" aria-label="Tìm"><i class="far fa-magnifying-glass"></i></button>
  </form>`;
  nav.innerHTML = searchHtml + items + themeBtn;
  const btn = document.getElementById("themeToggle");
  if (btn) btn.addEventListener("click", toggleTheme);
  const form = document.getElementById("navSearchForm");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = (document.getElementById("navSearchInput")?.value || "").trim();
      if (!q) return;
      const path = location.pathname || "";
      const inSub = path.indexOf("/list") !== -1 || path.indexOf("/post") !== -1 || path.indexOf("/cosplayers") !== -1;
      const base = inSub ? "../list/" : "list/";
      location.href = base + "?type=all&q=" + encodeURIComponent(q);
    });
  }
}

function escapeMenu(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function getTheme() {
  try {
    return localStorage.getItem("cp-theme") || "light";
  } catch (e) {
    return "light";
  }
}

function applyTheme(theme) {
  const t = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem("cp-theme", t);
  } catch (e) {}
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.innerHTML =
      t === "dark"
        ? '<i class="far fa-sun"></i> SÁNG'
        : '<i class="far fa-moon"></i> TỐI';
    btn.title = t === "dark" ? "Chế độ sáng" : "Chế độ tối";
  }
}

function toggleTheme() {
  applyTheme(getTheme() === "dark" ? "light" : "dark");
}

function ensureThemeToggle() {
  const old = document.querySelector(".top-header > .theme-toggle, body > .theme-toggle");
  if (old && old.id === "themeToggle" && !old.classList.contains("nav-item")) {
    old.remove();
  }
  applyTheme(getTheme());
}

function ensureMobileNav() {
  if (document.getElementById("navToggle")) return;
  const nav = document.querySelector(".main-nav");
  if (!nav) return;

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.id = "navToggle";
  toggle.className = "nav-toggle";
  toggle.setAttribute("aria-label", "Mở menu");
  toggle.innerHTML = '<i class="far fa-bars"></i>';

  const overlay = document.createElement("div");
  overlay.id = "navOverlay";
  overlay.className = "nav-overlay";

  const header = document.querySelector(".top-header");
  if (header) {
    header.insertBefore(toggle, header.firstChild);
  } else {
    document.body.insertBefore(toggle, document.body.firstChild);
  }
  document.body.appendChild(overlay);

  function closeNav() {
    document.body.classList.remove("nav-open");
    toggle.innerHTML = '<i class="far fa-bars"></i>';
    toggle.setAttribute("aria-label", "Mở menu");
  }
  function openNav() {
    document.body.classList.add("nav-open");
    toggle.innerHTML = '<i class="far fa-xmark"></i>';
    toggle.setAttribute("aria-label", "Đóng menu");
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    if (document.body.classList.contains("nav-open")) closeNav();
    else openNav();
  });
  overlay.addEventListener("click", closeNav);

  nav.addEventListener("click", (e) => {
    if (e.target.closest("a.nav-item")) closeNav();
  });

  window.addEventListener(
    "resize",
    () => {
      if (window.innerWidth > 720 && document.body.classList.contains("nav-open")) {
        closeNav();
      }
    },
    { passive: true }
  );
}

async function applySiteFooter() {
  const footers = document.querySelectorAll("footer.footer, .footer");
  if (!footers.length) return;
  try {
    await initFirebase();
    const snap = await firebaseDb.ref("settings/site").once("value");
    const s = snap.val() || {};
    if (s.footer) {
      footers.forEach((f) => {
        f.innerHTML = "<p>" + escapeMenu(s.footer) + "</p>";
      });
    }
  } catch (e) {}
}

async function initSiteHeader() {
  try {
    ensureMobileNav();
    ensureScrollButtons();
    const menus = await fetchMenus();
    renderNav(menus);
    ensureThemeToggle();
    applySiteFooter();
  } catch (e) {
    console.warn("menu", e);
    ensureMobileNav();
    ensureScrollButtons();
    renderNav(DEFAULT_MENUS);
    ensureThemeToggle();
  }
}

async function saveMenuItem(item) {
  await initFirebase();
  if (!item.id) item.id = "m_" + Date.now().toString(36);
  await firebaseDb.ref("menus/" + item.id).set({
    label: item.label || "",
    url: item.url || "./",
    icon: item.icon || "fa-link",
    order: parseInt(item.order, 10) || 0,
    openInNewTab: !!item.openInNewTab
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
    updates[m.id] = { label: m.label, url: m.url, icon: m.icon, order: m.order, openInNewTab: !!m.openInNewTab };
  });
  await firebaseDb.ref("menus").set(updates);
}

function ensureScrollButtons() {
  if (document.getElementById("scrollFloat")) return;
  const wrap = document.createElement("div");
  wrap.id = "scrollFloat";
  wrap.className = "scroll-float";
  wrap.innerHTML = `
    <button type="button" class="scroll-float-btn" id="scrollTopBtn" title="Lên đầu trang" aria-label="Lên đầu trang">
      <i class="far fa-chevron-up"></i>
    </button>
    <button type="button" class="scroll-float-btn" id="scrollBottomBtn" title="Xuống cuối trang" aria-label="Xuống cuối trang">
      <i class="far fa-chevron-down"></i>
    </button>
  `;
  document.body.appendChild(wrap);
  document.getElementById("scrollTopBtn").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  document.getElementById("scrollBottomBtn").addEventListener("click", () => {
    const h = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    window.scrollTo({ top: h, behavior: "smooth" });
  });
  function updateVisibility() {
    const y = window.pageYOffset || document.documentElement.scrollTop;
    const max = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    ) - window.innerHeight;
    wrap.classList.toggle("show-top", y > 120);
    wrap.classList.toggle("show-bottom", max > 80 && y < max - 80);
    wrap.classList.toggle("is-visible", y > 80 || max > 200);
  }
  window.addEventListener("scroll", updateVisibility, { passive: true });
  window.addEventListener("resize", updateVisibility, { passive: true });
  updateVisibility();
}


(function earlyTheme() {
  try {
    const t = localStorage.getItem("cp-theme") || "light";
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
})();

function showToast(message, type, duration) {
  type = type || "info";
  duration = duration == null ? 3200 : duration;
  let host = document.getElementById("toastHost");
  if (!host) {
    host = document.createElement("div");
    host.id = "toastHost";
    host.className = "toast-host";
    host.setAttribute("aria-live", "polite");
    document.body.appendChild(host);
  }
  const el = document.createElement("div");
  el.className = "toast toast-" + type;
  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    warn: "fa-triangle-exclamation",
    info: "fa-circle-info"
  };
  const icon = icons[type] || icons.info;
  el.innerHTML =
    '<i class="far ' +
    icon +
    '"></i><span class="toast-msg"></span><button type="button" class="toast-close" aria-label="Đóng">&times;</button>';
  el.querySelector(".toast-msg").textContent = String(message || "");
  const remove = () => {
    el.classList.add("toast-out");
    setTimeout(() => el.remove(), 280);
  };
  el.querySelector(".toast-close").addEventListener("click", remove);
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast-in"));
  if (duration > 0) setTimeout(remove, duration);
  return el;
}
window.showToast = showToast;