const detailContent = document.getElementById("detailContent");

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Ưu tiên ?id= — tránh bắt nhầm "index.html" từ path /post/index.html
 */
function getPostIdFromLocation() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    const q = (params.get("id") || "").trim();
    if (q && q !== "index.html" && !q.endsWith(".html")) return q;
  } catch (e) {}

  const path = location.pathname || "";
  const m = path.match(/\/post\/([^/]+)\/?$/i);
  if (m && m[1]) {
    const seg = decodeURIComponent(m[1]).trim();
    if (seg && seg !== "index.html" && !/\.html?$/i.test(seg)) return seg;
  }
  return "";
}

function rootPrefix() {
  return /\/post(\/|$)/i.test(location.pathname) ? "../" : "";
}

function infoRow(label, value) {
  const v = value || "—";
  // label may contain safe FA icons HTML
  return `
    <div class="info-row">
      <span class="info-label">${label}</span>
      <span class="info-value">${escapeHtml(String(v))}</span>
    </div>`;
}

function scrollCollapseFully(box) {
  if (!box) return;
  try {
    // Cuộn để đáy phần collapse nằm trong viewport (chạy hết nội dung vừa mở)
    const rect = box.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const absBottom = window.pageYOffset + rect.bottom;
    const target = Math.max(0, absBottom - vh + 24);
    window.scrollTo({ top: target, behavior: "smooth" });
  } catch (e) {
    try {
      box.scrollIntoView({ behavior: "smooth", block: "end" });
    } catch (e2) {}
  }
}

function toggleCollapse(btn) {
  const box = btn.closest(".collapse-box");
  if (!box) return;
  const body = box.querySelector(".collapse-body");
  const open = box.classList.toggle("is-open");
  btn.setAttribute("aria-expanded", open ? "true" : "false");
  if (body) {
    if (open) {
      body.hidden = false;
      void body.offsetHeight;
      // Luôn cuộn theo phần vừa mở — chạy hết scrollbar tới đáy collapse
      requestAnimationFrame(() => {
        setTimeout(() => scrollCollapseFully(box), 50);
        setTimeout(() => scrollCollapseFully(box), 200);
        setTimeout(() => scrollCollapseFully(box), 380);
      });
    } else {
      setTimeout(() => {
        if (!box.classList.contains("is-open")) body.hidden = true;
      }, 360);
    }
  }
}

function renderDetail(item) {
  if (!detailContent) return;
  if (!item) {
    detailContent.innerHTML = `
      <div class="empty-state">
        <p style="font-size:2rem;margin-bottom:8px"><i class="far fa-face-frown"></i></p>
        <p>Không tìm thấy nội dung này.</p>
        <p style="margin-top:12px;font-size:0.9rem;color:var(--text-muted)">Kiểm tra ID trên URL (?id=...)</p>
        <p style="margin-top:12px"><a href="${rootPrefix()}" style="color:var(--accent)">← Về trang chủ</a></p>
      </div>`;
    return;
  }

  const isVideo = !!(item.isVideo || item.fileType === "video" || String(item.id || "").startsWith("XKVID"));
  const typeLabel = isVideo ? "VIDEO" : "ẢNH";
  const countLabel = isVideo ? "Số lượng video:" : "Số lượng ảnh:";
  const dlLabel = isVideo ? "Tải Video Cosplay" : "Tải Ảnh Cosplay";
  const prefix = rootPrefix();
  const tagsHtml = (item.tags || [])
    .map(
      (t) =>
        `<a class="tag" href="${prefix}?tag=${encodeURIComponent(t)}">#${escapeHtml(t)}</a>`
    )
    .join("");

  detailContent.innerHTML = `
    <div class="detail-with-sidebar">
      <div class="detail-main-col">
        <div class="detail-layout">
          <div class="detail-image">
            <img src="${escapeHtml(item.full || item.thumb)}" alt="${escapeHtml(item.title)}" id="mainImage" loading="lazy" />
            <div class="detail-badge ${isVideo ? "badge-video" : "badge-photo"}">${typeLabel}</div>
          </div>
          <div class="detail-info">
            <h1>${escapeHtml(item.title)}</h1>
            ${item.desc ? `<p class="detail-desc">${escapeHtml(item.desc)}</p>` : ""}

            <div class="info-box">
              <div class="info-box-title"><i class="far fa-circle-info"></i> Thông Tin</div>
              ${infoRow('<i class="far fa-user"></i> Cosplayer:', item.cosplayer)}
              ${infoRow('<i class="far fa-language"></i> Name eng:', item.nameEng)}
              ${infoRow(isVideo ? '<i class="far fa-film"></i> Số lượng video:' : '<i class="far fa-images"></i> Số lượng ảnh:', item.imageCount)}
              ${infoRow('<i class="far fa-hard-drive"></i> Dung lượng:', item.fileSize)}
              ${infoRow(isVideo ? '<i class="far fa-expand"></i> Kích cỡ video:' : '<i class="far fa-expand"></i> Kích cỡ ảnh:', item.imageDimensions)}
            </div>

            <div class="detail-actions">
              <button class="btn-download-lg" id="btnDownload"
                data-id="${escapeHtml(item.id)}"
                data-title="${escapeHtml(item.title)}">
                <i class="far fa-download"></i> ${dlLabel} — ${escapeHtml(item.fileSize || "")}
              </button>
            </div>

            ${
              tagsHtml
                ? `<div class="collapse-box" data-collapse="tags">
              <button type="button" class="collapse-head" aria-expanded="false">
                <span><i class="far fa-tags"></i> Tags</span>
                <i class="far fa-chevron-down collapse-icon"></i>
              </button>
              <div class="collapse-body" hidden>
                <div class="detail-tags">${tagsHtml}</div>
              </div>
            </div>`
                : ""
            }

            <div class="collapse-box note-box" data-collapse="note">
              <button type="button" class="collapse-head note-box-title" aria-expanded="false">
                <span><i class="far fa-circle-exclamation"></i> Lưu ý</span>
                <i class="far fa-chevron-down collapse-icon"></i>
              </button>
              <div class="collapse-body" hidden>
                <div class="site-notes">
                  <p>1、Hãy mua bản gốc để ủng hộ các Cosplayer nhé.</p>
                  <p>2、Mọi thứ trên website đều do mình sưu tầm ở mọi nơi, mình không lưu trữ hình ảnh trên server.</p>
                  <p>3、Có vấn đề gì xin hãy liên hệ với mình, và xin chúc các bạn có 1 ngày thật vui nhé.</p>
                </div>
              </div>
            </div>

            <div class="collapse-box comment-box" data-collapse="comments">
              <button type="button" class="collapse-head" aria-expanded="false">
                <span><i class="far fa-comments"></i> Bình luận</span>
                <i class="far fa-chevron-down collapse-icon"></i>
              </button>
              <div class="collapse-body" hidden>
                <div class="comment-form">
                  <input type="text" id="cmtName" placeholder="Tên của bạn" maxlength="40" />
                  <textarea id="cmtText" placeholder="Viết bình luận..." rows="3" maxlength="500"></textarea>
                  <button type="button" class="btn-comment" id="btnSendComment">
                    <i class="far fa-paper-plane"></i> Gửi bình luận
                  </button>
                </div>
                <div class="comment-list" id="commentList">
                  <p class="cmt-loading"><i class="far fa-spinner fa-spin"></i> Đang tải...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <aside class="list-sidebar detail-sidebar" id="detailSidebar">
        <div class="side-block">
          <h3 class="side-title"><i class="far fa-magnifying-glass"></i> TÌM KIẾM</h3>
          <form id="detailSearchForm" class="side-search">
            <input type="search" id="detailSearchInput" placeholder="Tìm kiếm..." />
            <button type="submit"><i class="far fa-magnifying-glass"></i></button>
          </form>
        </div>
        <div class="side-block">
          <h3 class="side-title"><i class="far fa-shuffle"></i> BÀI VIẾT NGẪU NHIÊN</h3>
          <ul class="random-list" id="detailRandomList"></ul>
        </div>
      </aside>
    </div>
  `;

  detailContent.querySelectorAll(".collapse-head").forEach((btn) => {
    btn.addEventListener("click", () => toggleCollapse(btn));
  });

  const btn = document.getElementById("btnDownload");
  if (btn) btn.addEventListener("click", handleDownload);
  const mainImg = document.getElementById("mainImage");
  if (mainImg) mainImg.addEventListener("contextmenu", (e) => e.preventDefault());

  const searchForm = document.getElementById("detailSearchForm");
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = (document.getElementById("detailSearchInput")?.value || "").trim();
      if (q) location.href = prefix + "list/?type=all&q=" + encodeURIComponent(q);
    });
  }

  loadRandomSidebar(item.id);
  loadComments(item.id);

  const btnSend = document.getElementById("btnSendComment");
  if (btnSend) {
    btnSend.addEventListener("click", () => submitComment(item.id));
  }
}

async function loadRandomSidebar(excludeId) {
  const rl = document.getElementById("detailRandomList");
  if (!rl) return;
  try {
    const [allP, allV] = await Promise.all([
      fetchPhotosFromFirebase(),
      fetchVideosFromFirebase()
    ]);
    const pool = [
      ...allP.map((x) => ({ ...x, isVideo: false })),
      ...allV.map((x) => ({ ...x, isVideo: true }))
    ].filter((x) => x.id !== excludeId);
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, 10);
    const prefix = rootPrefix();
    rl.innerHTML =
      shuffled
        .map((it) => {
          const isVid = !!(it.isVideo || it.fileType === "video" || String(it.id || "").startsWith("XKVID"));
          const cls = isVid ? "rand-video" : "rand-photo";
          const badge = isVid
            ? `<span class="rand-badge video">VIDEO</span>`
            : `<span class="rand-badge photo">ẢNH</span>`;
          const href = prefix + "post/?id=" + encodeURIComponent(it.id);
          return `<li><a class="${cls}" href="${href}"><i class="far fa-angle-right"></i>${badge}<span class="rand-text">${escapeHtml(it.title || it.id)}</span></a></li>`;
        })
        .join("") || `<li style="color:var(--text-muted)">Chưa có bài</li>`;
  } catch (e) {
    rl.innerHTML = `<li style="color:var(--text-muted)">Chưa có bài</li>`;
  }
}

async function loadComments(postId) {
  const list = document.getElementById("commentList");
  if (!list) return;
  try {
    await initFirebase();
    try {
      if (firebaseAuth && !firebaseAuth.currentUser && typeof ensureAuth === "function") {
        await ensureAuth();
      }
    } catch (e) {}
    const snap = await firebaseDb.ref("comments/" + postId).once("value");
    const obj = snap.val() || {};
    const arr = Object.keys(obj)
      .map((k) => ({ id: k, ...(obj[k] || {}) }))
      .filter((c) => c.approved !== false)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (!arr.length) {
      list.innerHTML = `<p class="cmt-empty">Chưa có bình luận. Hãy là người đầu tiên!</p>`;
      return;
    }
    list.innerHTML = arr
      .map(
        (c) => `
      <div class="cmt-item">
        <div class="cmt-head">
          <strong>${escapeHtml(c.name || "Ẩn danh")}</strong>
          <span class="cmt-time">${formatCmtTime(c.createdAt)}</span>
        </div>
        <p class="cmt-body">${escapeHtml(c.text)}</p>
      </div>`
      )
      .join("");
  } catch (err) {
    list.innerHTML = `<p class="cmt-empty" style="color:#c62828">Lỗi tải bình luận</p>`;
  }
}

function formatCmtTime(ts) {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("vi-VN") + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return "";
  }
}

async function submitComment(postId) {
  const nameEl = document.getElementById("cmtName");
  const textEl = document.getElementById("cmtText");
  const btn = document.getElementById("btnSendComment");
  const name = (nameEl?.value || "").trim() || "Ẩn danh";
  const text = (textEl?.value || "").trim();
  if (!text) {
    alert("Vui lòng nhập nội dung bình luận.");
    return;
  }
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="far fa-spinner fa-spin"></i> Đang gửi...`;
  }
  try {
    await initFirebase();
    try {
      if (firebaseAuth && !firebaseAuth.currentUser) {
        if (typeof ensureAuth === "function") await ensureAuth();
        else await firebaseAuth.signInAnonymously();
      }
    } catch (e) {
      console.warn("comment auth", e);
    }
    const ref = firebaseDb.ref("comments/" + postId).push();
    await ref.set({
      name: name.slice(0, 40),
      text: text.slice(0, 500),
      createdAt: Date.now(),
      approved: true
    });
    if (textEl) textEl.value = "";
    await loadComments(postId);
  } catch (err) {
    alert("Không gửi được bình luận: " + (err.message || err));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="far fa-paper-plane"></i> Gửi bình luận`;
    }
  }
}

async function handleDownload(e) {
  const btn = e.currentTarget;
  const postId = btn.dataset.id;
  const title = btn.dataset.title;

  btn.disabled = true;
  btn.innerHTML = `<i class="far fa-spinner fa-spin"></i> Đang tạo link an toàn...`;

  try {
    const token = await createDownloadTokenForPost(postId, title);
    const dl = rootPrefix() + "dl.html?t=" + encodeURIComponent(token);
    const w = window.open(dl, "_blank");
    if (!w) window.location.href = dl;
    btn.disabled = false;
    btn.innerHTML = `<i class="far fa-download"></i> Tải lại`;
  } catch (err) {
    console.error(err);
    let msg = err.message || String(err);
    if (String(msg).includes("anonymous") || err.code === "auth/operation-not-allowed") {
      msg = "Cần bật Anonymous trong Firebase Authentication → Sign-in method.";
    }
    if (String(msg).includes("PERMISSION_DENIED")) {
      msg = "Firebase Rules chặn. Kiểm tra privateDownloads + Anonymous Auth.";
    }
    alert("Không tạo được link tải.\\n" + msg);
    btn.disabled = false;
    btn.innerHTML = `<i class="far fa-download"></i> Tải Pack`;
  }
}

(async function init() {
  if (!detailContent) return;
  detailContent.innerHTML = `<div class="detail-loading"><i class="far fa-spinner fa-spin"></i> Đang tải...</div>`;

  try {
    if (typeof initFirebase !== "function") {
      throw new Error("Chưa load firebase-config.js (kiểm tra đường dẫn script).");
    }
    await initFirebase();

    const id = getPostIdFromLocation();
    console.log("[detail] id =", id, "path =", location.pathname, "search =", location.search);

    if (!id) {
      renderDetail(null);
      return;
    }

    let item = await fetchItemById(id);

    if (!item) {
      const [photos, videos] = await Promise.all([
        fetchPhotosFromFirebase(),
        fetchVideosFromFirebase()
      ]);
      item =
        photos.find((p) => p.id === id) ||
        videos.find((v) => v.id === id) ||
        null;
    }

    renderDetail(item);
    document.title = item ? item.title + " - COSPLAYER" : "Không tìm thấy - COSPLAYER";
  } catch (err) {
    console.error(err);
    detailContent.innerHTML = `
      <div class="empty-state">
        <p><i class="far fa-triangle-exclamation"></i> Lỗi tải bài viết</p>
        <p style="margin-top:8px;color:var(--text-muted);font-size:0.9rem">${escapeHtml(err.message || String(err))}</p>
        <p style="margin-top:12px"><a href="${rootPrefix()}" style="color:var(--accent)">← Về trang chủ</a></p>
      </div>`;
  }
})();
