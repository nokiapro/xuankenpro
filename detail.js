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
  // /post/XKIMG-XXXX hoặc /xxx/post/XKIMG-XXXX
  const m = path.match(/\/post\/([^/]+)\/?$/i);
  if (m && m[1]) {
    const seg = decodeURIComponent(m[1]).trim();
    if (seg && seg !== "index.html" && !/\.html?$/i.test(seg)) return seg;
  }
  return "";
}

function rootPrefix() {
  // Đang ở thư mục /post/ → assets & link về thư mục cha
  return /\/post(\/|$)/i.test(location.pathname) ? "../" : "";
}

function infoRow(label, value) {
  const v = value || "—";
  return `
    <div class="info-row">
      <span class="info-label">${escapeHtml(label)}</span>
      <span class="info-value">${escapeHtml(String(v))}</span>
    </div>`;
}

function renderDetail(item) {
  if (!detailContent) return;
  if (!item) {
    detailContent.innerHTML = `
      <div class="empty-state">
        <p style="font-size:2rem;margin-bottom:8px"><i class="fa-solid fa-face-frown"></i></p>
        <p>Không tìm thấy nội dung này.</p>
        <p style="margin-top:12px;font-size:0.9rem;color:#888">Kiểm tra ID trên URL (?id=...)</p>
        <p style="margin-top:12px"><a href="${rootPrefix()}" style="color:#1e88e5">← Về trang chủ</a></p>
      </div>`;
    return;
  }

  const typeLabel = item.isVideo ? "VIDEO" : "ẢNH";
  const prefix = rootPrefix();
  const tagsHtml = (item.tags || [])
    .map(
      (t) =>
        `<a class="tag" href="${prefix}?tag=${encodeURIComponent(t)}">#${escapeHtml(t)}</a>`
    )
    .join("");

  detailContent.innerHTML = `
    <div class="detail-layout">
      <div class="detail-image">
        <img src="${escapeHtml(item.full || item.thumb)}" alt="${escapeHtml(item.title)}" id="mainImage" />
        <div class="detail-badge">${typeLabel}</div>
      </div>
      <div class="detail-info">
        <h1>${escapeHtml(item.title)}</h1>
        ${item.desc ? `<p class="detail-desc">${escapeHtml(item.desc)}</p>` : ""}

        <div class="info-box">
          <div class="info-box-title"><i class="fa-solid fa-circle-info"></i> Thông Tin</div>
          ${infoRow("Cosplayer:", item.cosplayer)}
          ${infoRow("Name eng:", item.nameEng)}
          ${infoRow("Số lượng ảnh:", item.imageCount)}
          ${infoRow("Dung lượng:", item.fileSize)}
          ${infoRow("Kích cỡ ảnh:", item.imageDimensions)}
        </div>

        ${tagsHtml ? `<div class="detail-tags">${tagsHtml}</div>` : ""}

        <div class="detail-actions">
          <button class="btn-download-lg" id="btnDownload"
            data-id="${escapeHtml(item.id)}"
            data-title="${escapeHtml(item.title)}">
            <i class="fa-solid fa-download"></i> Tải Pack (.zip) — ${escapeHtml(item.fileSize || "")}
          </button>
        </div>

        <div class="note-box">
          <div class="note-box-title"><i class="fa-solid fa-circle-exclamation"></i> Lưu ý</div>
          <div class="site-notes">
            <p>1、Hãy mua bản gốc để ủng hộ các Cosplayer nhé.</p>
            <p>2、Mọi thứ trên website đều do mình sưu tầm ở mọi nơi, mình không lưu trữ hình ảnh trên server.</p>
            <p>3、Có vấn đề gì xin hãy liên hệ với mình, và xin chúc các bạn có 1 ngày thật vui nhé.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  const btn = document.getElementById("btnDownload");
  if (btn) btn.addEventListener("click", handleDownload);
  const mainImg = document.getElementById("mainImage");
  if (mainImg) mainImg.addEventListener("contextmenu", (e) => e.preventDefault());
}

async function handleDownload(e) {
  const btn = e.currentTarget;
  const postId = btn.dataset.id;
  const title = btn.dataset.title;

  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tạo link an toàn...`;

  try {
    const token = await createDownloadTokenForPost(postId, title);
    const dl = rootPrefix() + "dl.html?t=" + encodeURIComponent(token);
    const w = window.open(dl, "_blank");
    if (!w) window.location.href = dl;
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-download"></i> Tải Pack (.zip)`;
  } catch (err) {
    console.error(err);
    let msg = err.message || String(err);
    if (String(msg).includes("anonymous") || err.code === "auth/operation-not-allowed") {
      msg = "Cần bật Anonymous trong Firebase Authentication → Sign-in method.";
    }
    if (String(msg).includes("PERMISSION_DENIED")) {
      msg = "Firebase Rules chặn. Kiểm tra privateDownloads + Anonymous Auth.";
    }
    alert("Không tạo được link tải.\n" + msg);
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-download"></i> Tải Pack (.zip)`;
  }
}

(async function init() {
  if (!detailContent) return;
  detailContent.innerHTML = `<div class="detail-loading"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>`;

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

    // Fallback: quét photos/videos nếu key không khớp (ID cũ)
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
        <p><i class="fa-solid fa-triangle-exclamation"></i> Lỗi tải bài viết</p>
        <p style="margin-top:8px;color:#888;font-size:0.9rem">${escapeHtml(err.message || String(err))}</p>
        <p style="margin-top:12px"><a href="${rootPrefix()}" style="color:#1e88e5">← Về trang chủ</a></p>
      </div>`;
  }
})();
