const PER_PAGE = 20;
const params = new URLSearchParams(location.search);
const type = (params.get("type") || "photo").toLowerCase();
const q = (params.get("q") || "").trim().toLowerCase();
const tagFilter = (params.get("tag") || "").trim();
let page = Math.max(1, parseInt(params.get("page") || "1", 10));

const TITLES = {
  photo: "ẢNH COSPLAY",
  video: "VIDEO COSPLAYER",
  all: "TẤT CẢ BÀI VIẾT",
  "list-cosplayer": "LIST COSPLAYER"
};

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function postHref(id) {
  return "../post/?id=" + encodeURIComponent(id);
}

function buildPageUrl(p, extraQ) {
  const sp = new URLSearchParams();
  if (type) sp.set("type", type);
  if (extraQ || q) sp.set("q", extraQ || q);
  if (tagFilter) sp.set("tag", tagFilter);
  if (p > 1) sp.set("page", String(p));
  const s = sp.toString();
  return s ? "?" + s : "?type=" + type;
}

function createCard(item, index) {
  if (!item?.thumb) return `<div class="card placeholder"></div>`;
  const delay = Math.min(index || 0, 20) * 0.04;
  return `<a href="${postHref(item.id)}" class="card card-animate" style="animation-delay:${delay}s" aria-label="${escapeHtml(item.title)}">
    <img src="${escapeHtml(item.thumb)}" alt="${escapeHtml(item.title)}" loading="lazy"
      onerror="this.parentElement.classList.add('placeholder');this.remove();" />
    <span class="card-title"><span class="card-title-inner">${escapeHtml(item.title)}</span></span>
  </a>`;
}

function renderPagination(totalPages, el) {
  if (!el || totalPages <= 1) {
    if (el) el.innerHTML = "";
    return;
  }
  const items = [];
  const add = (p, label, active, disabled) => {
    if (disabled) items.push(`<span class="page-btn disabled">${label}</span>`);
    else if (active) items.push(`<span class="page-btn active">${label}</span>`);
    else items.push(`<a class="page-btn" href="${buildPageUrl(p)}">${label}</a>`);
  };
  add(Math.max(1, page - 1), "‹", false, page <= 1);
  const windowSize = 5;
  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  if (start > 1) {
    add(1, "1", page === 1);
    if (start > 2) items.push(`<span class="page-btn dots">…</span>`);
  }
  for (let i = start; i <= end; i++) add(i, String(i), i === page);
  if (end < totalPages) {
    if (end < totalPages - 1) items.push(`<span class="page-btn dots">…</span>`);
    add(totalPages, String(totalPages), page === totalPages);
  }
  add(Math.min(totalPages, page + 1), "›", false, page >= totalPages);
  el.innerHTML = items.join("");
}

/** Danh sách tên cosplayer (link tag) — không hiện lưới ảnh/video */
async function renderCosplayerNameList() {
  const titleEl = document.querySelector("#listTitle span");
  if (titleEl) titleEl.textContent = "LIST COSPLAYER";
  document.title = "List Cosplayer - COSPLAYER";

  const pag = document.getElementById("paginationBottom");
  if (pag) pag.innerHTML = "";

  const layout = document.querySelector(".list-layout");
  if (layout) layout.classList.add("list-cosplayer-mode");

  const oldGrid = document.getElementById("listGrid");
  if (oldGrid) {
    oldGrid.outerHTML = `<div class="cp-panel" id="cpPanel">
      <div class="cp-panel-head">
        <span><i class="fa-solid fa-users" style="color:#e91e63;margin-right:6px"></i> Danh sách cosplayer</span>
        <span class="cp-count" id="cpCount">—</span>
      </div>
      <div class="cp-list" id="listGrid"><p class="cp-empty">Đang tải...</p></div>
    </div>`;
  }
  const grid = document.getElementById("listGrid");
  try {
    await initFirebase();
    const snap = await firebaseDb.ref("cosplayers").once("value");
    const obj = snap.val() || {};
    let list = Object.keys(obj)
      .map((k) => ({ id: k, ...(obj[k] || {}) }))
      .sort((a, b) => {
        const ca = a.createdAt || 0;
        const cb = b.createdAt || 0;
        if (ca && cb && ca !== cb) return ca - cb;
        if (ca && !cb) return -1;
        if (!ca && cb) return 1;
        return String(a.id || "").localeCompare(String(b.id || ""));
      });

    const searchInput = document.getElementById("searchInput");
    if (searchInput && q) searchInput.value = q;

    function paint(rows) {
      const countEl = document.getElementById("cpCount");
      if (countEl) countEl.textContent = rows.length + " cosplayer";
      if (!rows.length) {
        grid.innerHTML = `<p class="cp-empty">Chưa có cosplayer. Vào Admin → List Cosplayer để thêm.</p>`;
        return;
      }
      grid.innerHTML = rows
        .map((c) => {
          const tag = (c.tag || c.name || "").trim();
          const name = c.name || tag;
          const eng = (c.nameEng || "").trim();
          const label = eng ? `${name} (${eng})` : name;
          const href = tag
            ? "?type=all&tag=" + encodeURIComponent(tag)
            : "?type=all";
          return `<div class="cp-row">
            <a class="cp-link" href="${href}" target="_blank" rel="noopener"><b>${escapeHtml(label)}</b></a>
          </div>`;
        })
        .join("");
    }

    function applyFilter() {
      const qq = (searchInput?.value || q || "").trim().toLowerCase();
      if (!qq) return paint(list);
      paint(
        list.filter(
          (c) =>
            (c.name || "").toLowerCase().includes(qq) ||
            (c.nameEng || "").toLowerCase().includes(qq) ||
            (c.tag || "").toLowerCase().includes(qq)
        )
      );
    }

    document.getElementById("searchForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      applyFilter();
    });
    searchInput?.addEventListener("input", applyFilter);

    // Random sidebar: bài viết ngẫu nhiên (ảnh + video), màu khác nhau
    const rl = document.getElementById("randomList");
    if (rl) {
      try {
        const [allP, allV] = await Promise.all([
          fetchPhotosFromFirebase(),
          fetchVideosFromFirebase()
        ]);
        const pool = [...allP.map(x => ({...x, isVideo: false})), ...allV.map(x => ({...x, isVideo: true}))];
        const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 10);
        rl.innerHTML =
          shuffled
            .map((it) => {
              const isVid = !!(it.isVideo || it.fileType === "video" || String(it.id || "").startsWith("XKVID"));
              const cls = isVid ? "rand-video" : "rand-photo";
              const badge = isVid
                ? `<span class="rand-badge video">VIDEO</span>`
                : `<span class="rand-badge photo">ẢNH</span>`;
              return `<li><a class="${cls}" href="${postHref(it.id)}"><i class="fa-solid fa-angle-right"></i>${badge}<span class="rand-text">${escapeHtml(it.title || it.id)}</span></a></li>`;
            })
            .join("") || `<li style="color:#999">Chưa có bài</li>`;
      } catch (e) {
        rl.innerHTML = `<li style="color:#999">Chưa có bài</li>`;
      }
    }

    applyFilter();
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p class="cp-empty" style="color:#c62828">${escapeHtml(err.message)}</p>`;
  }
}

(async function init() {
  // type=list-cosplayer → chỉ hiện list tên + link tag
  if (type === "list-cosplayer" || type === "cosplayer" || type === "cosplayers") {
    await renderCosplayerNameList();
    return;
  }

  const titleEl = document.querySelector("#listTitle span");
  if (titleEl) {
    titleEl.textContent = tagFilter
      ? "TAG: " + tagFilter
      : TITLES[type] || TITLES.photo;
  }
  document.title = (titleEl?.textContent || "Danh sách") + " - COSPLAYER";

  const searchInput = document.getElementById("searchInput");
  if (searchInput && q) searchInput.value = q;

  document.getElementById("searchForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = searchInput.value.trim();
    const sp = new URLSearchParams();
    sp.set("type", type);
    if (v) sp.set("q", v);
    if (tagFilter) sp.set("tag", tagFilter);
    location.href = "?" + sp.toString();
  });

  try {
    await initFirebase();
    let items = [];
    if (type === "video") items = await fetchVideosFromFirebase();
    else if (type === "all") {
      const [p, v] = await Promise.all([
        fetchPhotosFromFirebase(),
        fetchVideosFromFirebase()
      ]);
      items = [...p, ...v].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    } else items = await fetchPhotosFromFirebase();

    if (tagFilter) {
      const tf = tagFilter.toLowerCase();
      items = items.filter(
        (it) =>
          (it.tags || []).some((t) => String(t).toLowerCase() === tf) ||
          (it.cosplayer || "").toLowerCase() === tf ||
          (it.nameEng || "").toLowerCase() === tf
      );
    }
    if (q) {
      items = items.filter(
        (it) =>
          (it.title || "").toLowerCase().includes(q) ||
          (it.cosplayer || "").toLowerCase().includes(q) ||
          (it.nameEng || "").toLowerCase().includes(q) ||
          (it.tags || []).some((t) => String(t).toLowerCase().includes(q))
      );
    }

    const totalPages = Math.max(1, Math.ceil(items.length / PER_PAGE));
    if (page > totalPages) page = totalPages;
    const slice = items.slice((page - 1) * PER_PAGE, page * PER_PAGE);

    const grid = document.getElementById("listGrid");
    grid.innerHTML = slice.length
      ? slice.map((item, i) => createCard(item, i)).join("")
      : `<div class="loading-msg">Không có bài viết.</div>`;

    renderPagination(totalPages, document.getElementById("paginationBottom"));

    // Random: luôn lấy cả ảnh + video, màu khác nhau
    let randPool = items.slice();
    try {
      const [allP, allV] = await Promise.all([
        fetchPhotosFromFirebase(),
        fetchVideosFromFirebase()
      ]);
      randPool = [...allP.map(x => ({...x, isVideo: false})), ...allV.map(x => ({...x, isVideo: true}))];
    } catch (e) {}
    const shuffled = randPool.slice().sort(() => Math.random() - 0.5).slice(0, 10);
    const rl = document.getElementById("randomList");
    rl.innerHTML =
      shuffled
        .map((it) => {
          const isVid = !!(it.isVideo || it.fileType === "video" || String(it.id || "").startsWith("XKVID"));
          const cls = isVid ? "rand-video" : "rand-photo";
          const badge = isVid
            ? `<span class="rand-badge video">VIDEO</span>`
            : `<span class="rand-badge photo">ẢNH</span>`;
          return `<li><a class="${cls}" href="${postHref(it.id)}"><i class="fa-solid fa-angle-right"></i>${badge}<span class="rand-text">${escapeHtml(it.title || it.id)}</span></a></li>`;
        })
        .join("") || `<li style="color:#999">Chưa có bài</li>`;
  } catch (err) {
    console.error(err);
    document.getElementById("listGrid").innerHTML =
      `<div class="loading-msg">Lỗi tải dữ liệu.</div>`;
  }
})();
