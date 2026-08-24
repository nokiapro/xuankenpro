const PER_PAGE = 8;
const params = new URLSearchParams(location.search);
const type = (params.get("type") || "photo").toLowerCase();
const q = (params.get("q") || "").trim().toLowerCase();
const tagFilter = (params.get("tag") || "").trim();
let page = Math.max(1, parseInt(params.get("page") || "1", 10));
const beforeCursor = params.get("before") || "";

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

function buildPageUrl(p, extraQ, before) {
  const sp = new URLSearchParams();
  if (type) sp.set("type", type);
  if (extraQ || q) sp.set("q", extraQ || q);
  if (tagFilter) sp.set("tag", tagFilter);
  if (p > 1) sp.set("page", String(p));
  if (before != null && before !== "" && p > 1) sp.set("before", String(before));
  const s = sp.toString();
  return s ? "?" + s : "?type=" + type;
}

function cursorStoreKey() {
  return "cp_list_cursors_" + type + "_" + (tagFilter || "") + "_" + (q || "");
}
function saveCursorForPage(pageNum, beforeVal) {
  try {
    const key = cursorStoreKey();
    const map = JSON.parse(sessionStorage.getItem(key) || "{}");
    if (beforeVal == null || beforeVal === "") delete map[String(pageNum)];
    else map[String(pageNum)] = String(beforeVal);
    sessionStorage.setItem(key, JSON.stringify(map));
  } catch (e) {}
}
function getCursorForPage(pageNum) {
  try {
    const map = JSON.parse(sessionStorage.getItem(cursorStoreKey()) || "{}");
    return map[String(pageNum)] || "";
  } catch (e) {
    return "";
  }
}

function createCard(item, index) {
  if (!item?.thumb) return `<div class="card placeholder"></div>`;
  const delay = Math.min(index || 0, 20) * 0.04;
  const eager = (index || 0) < 4;
  const loadAttr = eager
    ? 'loading="eager" decoding="async" fetchpriority="high"'
    : 'loading="lazy" decoding="async" fetchpriority="low"';
  return `<a href="${postHref(item.id)}" class="card card-animate" style="animation-delay:${delay}s" aria-label="${escapeHtml(item.title)}">
    <img src="${escapeHtml(item.thumb)}" alt="${escapeHtml(item.title)}" ${loadAttr}
      onerror="this.parentElement.classList.add('placeholder');this.remove();" />
    <span class="card-title"><span class="card-title-inner">${escapeHtml(item.title)}</span></span>
  </a>`;
}

function renderPagination(el, opts) {
  opts = opts || {};
  const hasMore = !!opts.hasMore;
  const nextBefore = opts.nextBefore;
  const prevBefore = page <= 2 ? "" : getCursorForPage(page - 1);
  if (!el) return;
  if (page <= 1 && !hasMore) {
    el.innerHTML = "";
    return;
  }
  const items = [];
  const addLink = (href, label, active, disabled, extraClass) => {
    const cls = "page-btn" + (extraClass ? " " + extraClass : "");
    if (disabled) items.push(`<span class="${cls} disabled" aria-disabled="true">${label}</span>`);
    else if (active) items.push(`<span class="${cls} active" aria-current="page">${label}</span>`);
    else items.push(`<a class="${cls}" href="${href}">${label}</a>`);
  };

  // ‹
  if (page <= 1) addLink("#", "‹", false, true, "page-nav");
  else if (page === 2) addLink(buildPageUrl(1), "‹", false, false, "page-nav");
  else addLink(buildPageUrl(page - 1, null, prevBefore), "‹", false, false, "page-nav");

  addLink(buildPageUrl(1), "1", page === 1, false);

  if (page === 1 && hasMore && nextBefore != null) {
    addLink(buildPageUrl(2, null, nextBefore), "2", false, false);
  } else if (page === 2) {
    addLink(buildPageUrl(2, null, beforeCursor || getCursorForPage(2)), "2", true, false);
    if (hasMore && nextBefore != null) {
      addLink(buildPageUrl(3, null, nextBefore), "3", false, false);
    }
  } else if (page > 2) {
    if (page > 3) items.push(`<span class="page-btn dots">…</span>`);
    const prevP = page - 1;
    const prevC = getCursorForPage(prevP);
    if (prevP > 1) addLink(buildPageUrl(prevP, null, prevC), String(prevP), false, false);
    addLink(buildPageUrl(page, null, beforeCursor || getCursorForPage(page)), String(page), true, false);
    if (hasMore && nextBefore != null) {
      addLink(buildPageUrl(page + 1, null, nextBefore), String(page + 1), false, false);
    }
  }

  if (hasMore && nextBefore != null) {
    addLink(buildPageUrl(page + 1, null, nextBefore), "›", false, false, "page-nav");
  } else {
    addLink("#", "›", false, true, "page-nav");
  }

  el.innerHTML = items.join("");
  el.classList.remove("page-anim");
  void el.offsetWidth;
  el.classList.add("page-anim");
}

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
        <span><i class="far fa-users" style="color:#e91e63;margin-right:6px"></i> Danh sách cosplayer</span>
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
                : `<span class="rand-badge photo">IMAGE</span>`;
              return `<li><a class="${cls}" href="${postHref(it.id)}"><i class="far fa-angle-right"></i>${badge}<span class="rand-text">${escapeHtml(it.title || it.id)}</span></a></li>`;
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
    const grid = document.getElementById("listGrid");
    const needClientFilter = !!(tagFilter || q);

    let items = [];
    let hasMore = false;
    let nextBefore = null;

    let effectiveBefore = beforeCursor;
    if (page > 1 && !effectiveBefore) {
      effectiveBefore = getCursorForPage(page) || "";
    }
    if (page <= 1) effectiveBefore = "";

    if (needClientFilter) {
      let pool = [];
      if (type === "video") pool = await fetchVideosFromFirebase();
      else if (type === "all") {
        const [p, v] = await Promise.all([
          fetchPhotosFromFirebase(),
          fetchVideosFromFirebase()
        ]);
        pool = [...p, ...v.map((x) => ({ ...x, isVideo: true }))].sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
        );
      } else pool = await fetchPhotosFromFirebase();

      if (tagFilter) {
        const tf = tagFilter.toLowerCase();
        pool = pool.filter(
          (it) =>
            (it.tags || []).some((t) => String(t).toLowerCase() === tf) ||
            (it.cosplayer || "").toLowerCase() === tf ||
            (it.nameEng || "").toLowerCase() === tf
        );
      }
      if (q) {
        const tokens = q.split(/\s+/).filter(Boolean);
        pool = pool.filter((it) => {
          const hay = [
            it.title,
            it.cosplayer,
            it.nameEng,
            it.desc,
            it.category,
            it.id,
            ...(it.tags || [])
          ]
            .map((x) => String(x || "").toLowerCase())
            .join(" ");
          return tokens.every((tk) => hay.includes(tk));
        });
      }
      const totalPages = Math.max(1, Math.ceil(pool.length / PER_PAGE));
      if (page > totalPages) page = totalPages;
      items = pool.slice((page - 1) * PER_PAGE, page * PER_PAGE);
      hasMore = page < totalPages;
      nextBefore = items.length ? items[items.length - 1].createdAt : null;
    } else {
      const beforeTs = effectiveBefore ? Number(effectiveBefore) : null;
      let result;
      if (type === "video") {
        result = await fetchPostsPage("videos", { limit: PER_PAGE, beforeTs: beforeTs });
      } else if (type === "all") {
        result = await fetchAllPostsPage({ limit: PER_PAGE, beforeTs: beforeTs });
      } else {
        result = await fetchPostsPage("photos", { limit: PER_PAGE, beforeTs: beforeTs });
      }
      items = result.items || [];
      hasMore = !!result.hasMore;
      nextBefore = result.nextBefore;
    }

    if (nextBefore != null) saveCursorForPage(page + 1, nextBefore);
    if (page === 1) saveCursorForPage(1, "");

    if (grid) {
      grid.innerHTML = items.length
        ? items.map((item, i) => createCard(item, i)).join("")
        : `<div class="loading-msg">Không có bài viết.</div>`;
    }

    renderPagination(document.getElementById("paginationBottom"), {
      hasMore: hasMore,
      nextBefore: nextBefore
    });

    const rl = document.getElementById("randomList");
    if (rl) {
      try {
        const [rp, rv] = await Promise.all([
          typeof fetchLatestPhotos === "function" ? fetchLatestPhotos(6) : Promise.resolve([]),
          typeof fetchLatestVideos === "function" ? fetchLatestVideos(6) : Promise.resolve([])
        ]);
        const pool = [
          ...rp.map((x) => ({ ...x, isVideo: false })),
          ...rv.map((x) => ({ ...x, isVideo: true }))
        ];
        const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 10);
        rl.innerHTML =
          shuffled
            .map((it) => {
              const isVid = !!(it.isVideo || String(it.id || "").startsWith("XKVID"));
              const cls = isVid ? "rand-video" : "rand-photo";
              const badge = isVid
                ? `<span class="rand-badge video">VIDEO</span>`
                : `<span class="rand-badge photo">IMAGE</span>`;
              return `<li><a class="${cls}" href="${postHref(it.id)}"><i class="far fa-angle-right"></i>${badge}<span class="rand-text">${escapeHtml(it.title || it.id)}</span></a></li>`;
            })
            .join("") || `<li style="color:#999">Chưa có bài</li>`;
      } catch (e) {
        rl.innerHTML = `<li style="color:#999">Chưa có bài</li>`;
      }
    }
  } catch (err) {
    console.error(err);
    const g = document.getElementById("listGrid");
    if (g) g.innerHTML = `<div class="loading-msg">Lỗi tải dữ liệu.</div>`;
  }
})();