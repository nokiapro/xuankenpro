let photos = [];
let videos = [];
let tokens = [];
let privateMap = {};

const loginScreen = document.getElementById("loginScreen");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const photoList = document.getElementById("photoList");
const videoList = document.getElementById("videoList");
const tokenList = document.getElementById("tokenList");
const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const modalTitle = document.getElementById("modalTitle");
const userEmailEl = document.getElementById("userEmail");

function toast(msg, type) {
  if (typeof showToast === "function") showToast(String(msg || ""), type || "info");
  else toast(String(msg || ""), "error");
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function confirmDialog(message, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    const modal = document.getElementById("confirmModal");
    const titleEl = document.getElementById("confirmTitle");
    const msgEl = document.getElementById("confirmMessage");
    const okBtn = document.getElementById("confirmOk");
    const cancelBtn = document.getElementById("confirmCancel");
    if (!modal || !okBtn || !cancelBtn) {
      resolve(window.confirm(message));
      return;
    }
    if (titleEl) titleEl.textContent = opts.title || "Xác nhận xóa";
    if (msgEl) msgEl.textContent = message || "Bạn có chắc muốn xóa?";
    okBtn.innerHTML = opts.okHtml || '<i class="far fa-trash"></i> Xóa';
    modal.hidden = false;

    function cleanup(result) {
      modal.hidden = true;
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(result);
    }
    function onOk() { cleanup(true); }
    function onCancel() { cleanup(false); }
    function onBackdrop(e) { if (e.target === modal) cleanup(false); }
    function onKey(e) {
      if (e.key === "Escape") cleanup(false);
      if (e.key === "Enter") cleanup(true);
    }
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    modal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onKey);
    setTimeout(() => okBtn.focus(), 50);
  });
}

function isRealAdmin(user) {
  return !!(user && !user.isAnonymous && user.email);
}

function showAdmin(user) {
  loginScreen.hidden = true;
  adminPanel.hidden = false;
  document.body.classList.add("admin-on");
  document.body.classList.remove("admin-off");
  reloadAll();
}

function showLogin() {
  loginScreen.hidden = false;
  adminPanel.hidden = true;
  document.body.classList.remove("admin-on");
  document.body.classList.add("admin-off");
}

function showLoginError(msg) {
  loginError.hidden = false;
  loginError.innerHTML = `<i class="far fa-circle-exclamation"></i> ${msg}`;
}

(async function boot() {
  try {
    await initFirebase();
    firebaseAuth.onAuthStateChanged((user) => {
      if (isRealAdmin(user)) showAdmin(user);
      else showLogin();
    });
  } catch (err) {
    console.error(err);
    showLoginError("Không khởi tạo Firebase: " + err.message);
  }
})();

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  loginError.hidden = true;
  btnLogin.disabled = true;
  btnLogin.innerHTML = `<i class="far fa-spinner fa-spin"></i> Đang đăng nhập...`;
  try {
    await initFirebase();
    if (firebaseAuth.currentUser) {
      await firebaseAuth.signOut();
    }
    await firebaseAuth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    let msg = err.message;
    if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential")
      msg = "Email hoặc mật khẩu không đúng.";
    else if (err.code === "auth/wrong-password") msg = "Sai mật khẩu.";
    else if (err.code === "auth/invalid-email") msg = "Email không hợp lệ.";
    else if (err.code === "auth/too-many-requests") msg = "Thử quá nhiều lần. Đợi rồi thử lại.";
    showLoginError(msg);
  } finally {
    btnLogin.disabled = false;
    btnLogin.innerHTML = `<i class="far fa-right-to-bracket"></i> Đăng nhập`;
  }
});

btnLogout.addEventListener("click", async () => {
  try {
    await firebaseAuth.signOut();
  } catch (e) {}
  showLogin();
});

document.querySelectorAll(".side-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".side-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".admin-tab").forEach((t) => (t.hidden = true));
    const tab = document.getElementById("tab-" + btn.dataset.tab);
    if (tab) tab.hidden = false;
    if (btn.dataset.tab === "tokens") loadTokens();
    if (btn.dataset.tab === "menus") loadMenusTab();
    if (btn.dataset.tab === "cosplayers") loadCosplayersTab();
    if (btn.dataset.tab === "tags") loadTagsTab();
    if (btn.dataset.tab === "settings") loadSettings();
    if (btn.dataset.tab === "dashboard") renderDashboard();
    if (btn.dataset.tab === "comments") loadCommentsAdmin();
  });
});

async function loadPrivateMap() {
  privateMap = {};
  try {
    const snap = await firebaseDb.ref("privateDownloads").once("value");
    const obj = snap.val() || {};
    Object.keys(obj).forEach((id) => {
      if (obj[id] && obj[id].downloadUrl) privateMap[id] = true;
    });
  } catch (e) {
    console.warn("privateDownloads", e);
  }
}

async function reloadAll() {
  try {
    const [p, v] = await Promise.all([
      fetchPhotosFromFirebase(),
      fetchVideosFromFirebase()
    ]);
    photos = p;
    videos = v;
    await loadPrivateMap();
    document.getElementById("countPhotos").textContent = photos.length;
    document.getElementById("countVideos").textContent = videos.length;
    renderPhotoList(document.getElementById("searchPhotos")?.value?.trim() || "");
    renderVideoList(document.getElementById("searchVideos")?.value?.trim() || "");
    renderDashboard();
    refreshSidebarCounts().catch((e) => console.warn("sidebar counts", e));
  } catch (err) {
    console.error(err);
    photoList.innerHTML = `<p style="color:#c62828">Lỗi: ${escapeHtml(err.message)}</p>`;
  }
}

async function refreshSidebarCounts() {
  await initFirebase();
  const setCount = (id, n) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(n);
  };

  const tasks = [];

  tasks.push(
    (async () => {
      try {
        if (typeof fetchMenus === "function") {
          const menus = await fetchMenus();
          setCount("countMenus", menus.length);
        } else {
          const snap = await firebaseDb.ref("menus").once("value");
          const obj = snap.val() || {};
          setCount("countMenus", Object.keys(obj).length);
        }
      } catch (e) {
        console.warn("countMenus", e);
      }
    })()
  );

  tasks.push(
    (async () => {
      try {
        if (typeof fetchCosplayers === "function") {
          const list = await fetchCosplayers();
          setCount("countCosplayers", list.length);
        } else {
          const snap = await firebaseDb.ref("cosplayers").once("value");
          const obj = snap.val() || {};
          setCount("countCosplayers", Object.keys(obj).length);
        }
      } catch (e) {
        console.warn("countCosplayers", e);
      }
    })()
  );

  tasks.push(
    (async () => {
      try {
        if (typeof fetchAllTags === "function") {
          const tags = await fetchAllTags();
          setCount("countTags", tags.length);
        } else {
          const snap = await firebaseDb.ref("tags").once("value");
          const obj = snap.val() || {};
          setCount("countTags", Object.keys(obj).length);
        }
      } catch (e) {
        console.warn("countTags", e);
      }
    })()
  );

  tasks.push(
    (async () => {
      try {
        const snap = await firebaseDb.ref("comments").once("value");
        const root = snap.val() || {};
        let n = 0;
        Object.keys(root).forEach((postId) => {
          const group = root[postId] || {};
          n += Object.keys(group).length;
        });
        setCount("countComments", n);
      } catch (e) {
        console.warn("countComments", e);
      }
    })()
  );

  await Promise.all(tasks);
}

function renderDashboard() {
  const totalViews =
    photos.reduce((s, p) => s + (p.views || 0), 0) +
    videos.reduce((s, v) => s + (v.views || 0), 0);
  const totalDl =
    photos.reduce((s, p) => s + (p.downloads || 0), 0) +
    videos.reduce((s, v) => s + (v.downloads || 0), 0);
  const zipOk =
    photos.filter((p) => privateMap[p.id]).length +
    videos.filter((v) => privateMap[v.id]).length;

  document.getElementById("statPhotos").textContent = photos.length;
  document.getElementById("statVideos").textContent = videos.length;
  document.getElementById("statViews").textContent = totalViews.toLocaleString();
  document.getElementById("statDownloads").textContent = totalDl.toLocaleString();

  const zipStat = document.getElementById("statZipOk");
  if (zipStat) zipStat.textContent = zipOk;

  const dp = document.getElementById("dashPhotos");
  const dv = document.getElementById("dashVideos");
  const topP = photos.slice(0, 6);
  const topV = videos.slice(0, 6);

  dp.innerHTML = topP.length
    ? topP
        .map(
          (p) => `
      <div class="dash-item">
        ${p.thumb ? `<img src="${escapeHtml(p.thumb)}" alt="" />` : `<div class="item-thumb placeholder" style="width:36px;height:48px"></div>`}
        <span>${escapeHtml(p.title)} ${privateMap[p.id] ? "✓" : "⚠️"}</span>
      </div>`
        )
        .join("")
    : `<p class="dash-empty">Chưa có ảnh</p>`;

  dv.innerHTML = topV.length
    ? topV
        .map(
          (v) => `
      <div class="dash-item">
        ${v.thumb ? `<img src="${escapeHtml(v.thumb)}" alt="" />` : `<div class="item-thumb placeholder" style="width:36px;height:48px"></div>`}
        <span>${escapeHtml(v.title)} ${privateMap[v.id] ? "✓" : "⚠️"}</span>
      </div>`
        )
        .join("")
    : `<p class="dash-empty">Chưa có video</p>`;
}

function filterList(list, q) {
  if (!q) return list;
  q = q.toLowerCase();
  return list.filter(
    (i) =>
      (i.title || "").toLowerCase().includes(q) ||
      (i.id || "").toLowerCase().includes(q) ||
      (i.tags || []).some((t) => String(t).toLowerCase().includes(q)) ||
      (i.category || "").toLowerCase().includes(q)
  );
}

function zipBadge(id) {
  return privateMap[id]
    ? `<span class="zip-ok"><i class="far fa-lock"></i> có zip</span>`
    : `<span class="zip-miss"><i class="far fa-triangle-exclamation"></i> thiếu zip</span>`;
}

const ADMIN_PHOTO_PER = 6;
const ADMIN_VIDEO_PER = 6;
const ADMIN_CP_PER = 8;
let photoPage = 1;
let videoPage = 1;
let cosplayerPage = 1;
let cosplayerCache = [];

function adminPagerHtml(page, totalPages, dataAttr) {
  if (totalPages <= 1) return "";
  const items = [];
  const add = (p, label, active, disabled) => {
    if (disabled) items.push(`<span class="admin-page-btn disabled">${label}</span>`);
    else if (active) items.push(`<span class="admin-page-btn active">${label}</span>`);
    else items.push(`<button type="button" class="admin-page-btn" ${dataAttr}="${p}">${label}</button>`);
  };
  add(Math.max(1, page - 1), "‹", false, page <= 1);
  const win = 5;
  let start = Math.max(1, page - 2);
  let end = Math.min(totalPages, start + win - 1);
  start = Math.max(1, end - win + 1);
  if (start > 1) {
    add(1, "1", page === 1);
    if (start > 2) items.push(`<span class="admin-page-btn dots">…</span>`);
  }
  for (let i = start; i <= end; i++) add(i, String(i), i === page);
  if (end < totalPages) {
    if (end < totalPages - 1) items.push(`<span class="admin-page-btn dots">…</span>`);
    add(totalPages, String(totalPages), page === totalPages);
  }
  add(Math.min(totalPages, page + 1), "›", false, page >= totalPages);
  return `<div class="admin-pagination">${items.join("")}</div>`;
}

function renderPhotoList(filter, page) {
  const list = filterList(photos, filter);
  if (page != null) photoPage = page;
  if (!list.length) {
    photoList.innerHTML = `<p style="color:#999;padding:16px;margin:0">Không có bài nào.</p>`;
    photoPage = 1;
    return;
  }
  const totalPages = Math.max(1, Math.ceil(list.length / ADMIN_PHOTO_PER));
  if (photoPage > totalPages) photoPage = totalPages;
  if (photoPage < 1) photoPage = 1;
  const start = (photoPage - 1) * ADMIN_PHOTO_PER;
  const slice = list.slice(start, start + ADMIN_PHOTO_PER);
  photoList.innerHTML =
    slice
      .map(
        (item, idx) => `
    <div class="item-card">
      <span class="item-order">#${start + idx + 1}</span>
      ${
        item.thumb
          ? `<img class="item-thumb" src="${escapeHtml(item.thumb)}" alt="" onerror="this.classList.add('placeholder');this.removeAttribute('src')" loading="lazy" />`
          : `<div class="item-thumb placeholder"><i class="far fa-image"></i></div>`
      }
      <div class="item-info">
        <h4>${escapeHtml(item.title)}</h4>
        <p><code>${escapeHtml(item.id)}</code> · ${escapeHtml(item.fileSize || "—")} · ${zipBadge(item.id)}</p>
      </div>
      <div class="item-actions">
        <button type="button" class="btn-sm" title="Copy ID" data-copy="${escapeHtml(item.id)}"><i class="far fa-copy"></i></button>
        <a class="btn-sm" href="post/?id=${encodeURIComponent(item.id)}" target="_blank" title="Xem"><i class="far fa-eye"></i></a>
        <button type="button" class="btn-sm" data-dup-photo="${escapeHtml(item.id)}" title="Nhân bản"><i class="far fa-clone"></i></button>
        <button type="button" class="btn-sm" data-edit-photo="${escapeHtml(item.id)}"><i class="far fa-pen"></i></button>
        <button type="button" class="btn-sm btn-del" data-del-photo="${escapeHtml(item.id)}"><i class="far fa-trash"></i></button>
      </div>
    </div>`
      )
      .join("") + adminPagerHtml(photoPage, totalPages, "data-photo-page");
  bindListActions(photoList, "photo");
  photoList.querySelectorAll("[data-photo-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      photoPage = parseInt(btn.getAttribute("data-photo-page"), 10) || 1;
      renderPhotoList(document.getElementById("searchPhotos")?.value?.trim() || "");
    });
  });
}

function renderVideoList(filter, page) {
  const list = filterList(videos, filter);
  if (page != null) videoPage = page;
  if (!list.length) {
    videoList.innerHTML = `<p style="color:#999;padding:16px;margin:0">Không có bài nào.</p>`;
    videoPage = 1;
    return;
  }
  const totalPages = Math.max(1, Math.ceil(list.length / ADMIN_VIDEO_PER));
  if (videoPage > totalPages) videoPage = totalPages;
  if (videoPage < 1) videoPage = 1;
  const start = (videoPage - 1) * ADMIN_VIDEO_PER;
  const slice = list.slice(start, start + ADMIN_VIDEO_PER);
  videoList.innerHTML =
    slice
      .map(
        (item, idx) => `
    <div class="item-card">
      <span class="item-order">#${start + idx + 1}</span>
      ${
        item.thumb
          ? `<img class="item-thumb" src="${escapeHtml(item.thumb)}" alt="" onerror="this.classList.add('placeholder');this.removeAttribute('src')" loading="lazy" />`
          : `<div class="item-thumb placeholder"><i class="far fa-video"></i></div>`
      }
      <div class="item-info">
        <h4>${escapeHtml(item.title)}</h4>
        <p><code>${escapeHtml(item.id)}</code> · ${escapeHtml(item.fileSize || "—")} · ${zipBadge(item.id)}</p>
      </div>
      <div class="item-actions">
        <button type="button" class="btn-sm" title="Copy ID" data-copy="${escapeHtml(item.id)}"><i class="far fa-copy"></i></button>
        <a class="btn-sm" href="post/?id=${encodeURIComponent(item.id)}" target="_blank" title="Xem"><i class="far fa-eye"></i></a>
        <button type="button" class="btn-sm" data-dup-video="${escapeHtml(item.id)}" title="Nhân bản"><i class="far fa-clone"></i></button>
        <button type="button" class="btn-sm" data-edit-video="${escapeHtml(item.id)}"><i class="far fa-pen"></i></button>
        <button type="button" class="btn-sm btn-del" data-del-video="${escapeHtml(item.id)}"><i class="far fa-trash"></i></button>
      </div>
    </div>`
      )
      .join("") + adminPagerHtml(videoPage, totalPages, "data-video-page");
  bindListActions(videoList, "video");
  videoList.querySelectorAll("[data-video-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      videoPage = parseInt(btn.getAttribute("data-video-page"), 10) || 1;
      renderVideoList(document.getElementById("searchVideos")?.value?.trim() || "");
    });
  });
}

function bindListActions(container, type) {
  container.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(btn.getAttribute("data-copy"));
        btn.innerHTML = `<i class="far fa-check"></i>`;
        setTimeout(() => (btn.innerHTML = `<i class="far fa-copy"></i>`), 1200);
      } catch (e) {
        toast("ID: " + btn.getAttribute("data-copy"), "error");
      }
    });
  });
  container.querySelectorAll(`[data-edit-${type}]`).forEach((btn) => {
    btn.addEventListener("click", () => editItem(type, btn.getAttribute(`data-edit-${type}`)));
  });
  container.querySelectorAll(`[data-del-${type}]`).forEach((btn) => {
    btn.addEventListener("click", () => deleteItem(type, btn.getAttribute(`data-del-${type}`)));
  });
  container.querySelectorAll(`[data-dup-${type}]`).forEach((btn) => {
    btn.addEventListener("click", () => duplicateItem(type, btn.getAttribute(`data-dup-${type}`)));
  });
}

document.getElementById("searchPhotos").addEventListener("input", (e) => {
  photoPage = 1;
  renderPhotoList(e.target.value.trim());
});
document.getElementById("searchVideos").addEventListener("input", (e) => {
  videoPage = 1;
  renderVideoList(e.target.value.trim());
});

document.getElementById("btnAddPhoto").addEventListener("click", () => openModal("photo", null));
document.getElementById("btnAddVideo").addEventListener("click", () => openModal("video", null));

function openModal(type, item) {
  document.getElementById("editType").value = type;
  document.getElementById("editId").value = item ? item.id : "";
  document.getElementById("fIdDisplay").value = item ? item.id : "(tự sinh khi lưu)";
  modalTitle.textContent = item
    ? "Sửa " + (type === "photo" ? "ảnh" : "video")
    : "Thêm " + (type === "photo" ? "ảnh" : "video");

  document.getElementById("fTitle").value = item?.title || "";
  document.getElementById("fCosplayer").value = item?.cosplayer || "";
  document.getElementById("fNameEng").value = item?.nameEng || "";
  document.getElementById("fImageCount").value = item?.imageCount || "";
  document.getElementById("fImageDimensions").value = item?.imageDimensions || "";
  document.getElementById("fCategory").value = item?.category || (type === "video" ? "video" : "anime");
  document.getElementById("fTags").value = (item?.tags || []).join(", ");
  document.getElementById("fDesc").value = item?.desc || "";
  document.getElementById("fThumb").value = item?.thumb || "";
  document.getElementById("fFull").value = item?.full || "";
  document.getElementById("fDownload").value = item?.downloadUrl || "";
  document.getElementById("fSize").value = item?.fileSize || "";
  document.getElementById("fFileType").value = item?.fileType || "zip";
  document.getElementById("fViews").value = item?.views || 0;
  document.getElementById("fDownloads").value = item?.downloads || 0;
  updateThumbPreview(item?.thumb || "");
  editModal.hidden = false;
}

function updateThumbPreview(url) {
  const img = document.getElementById("thumbPreview");
  if (url) {
    img.src = url;
    img.hidden = false;
  } else {
    img.hidden = true;
  }
}

document.getElementById("fThumb").addEventListener("input", (e) => {
  updateThumbPreview(e.target.value.trim());
});

function closeModal() {
  editModal.hidden = true;
}

document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("modalCancel").addEventListener("click", closeModal);
editModal.addEventListener("click", (e) => {
  if (e.target === editModal) closeModal();
});

async function editItem(type, id) {
  const list = type === "photo" ? photos : videos;
  const item = list.find((i) => i.id === id);
  if (!item) return;
  let downloadUrl = "";
  try {
    downloadUrl = (await getPrivateDownloadUrl(id)) || "";
  } catch (e) {
    console.warn(e);
  }
  openModal(type, { ...item, downloadUrl });
}

async function duplicateItem(type, id) {
  const list = type === "photo" ? photos : videos;
  const item = list.find((i) => i.id === id);
  if (!item) return;
  let downloadUrl = "";
  try {
    downloadUrl = (await getPrivateDownloadUrl(id)) || "";
  } catch (e) {}
  const copy = {
    ...item,
    id: generateId(type === "photo" ? "ph" : "vid"),
    title: (item.title || "") + " (copy)",
    createdAt: Date.now(),
    downloadUrl
  };
  try {
    if (type === "photo") await savePhotoToFirebase(copy);
    else await saveVideoToFirebase(copy);
    await reloadAll();
  } catch (err) {
    toast("Lỗi nhân bản: " + err.message, "error");
  }
}

async function deleteItem(type, id) {
  if (!(await confirmDialog("Xóa bài này khỏi Firebase?", { title: "Xóa bài viết" }))) return;
  try {
    if (type === "photo") await deletePhotoFromFirebase(id);
    else await deleteVideoFromFirebase(id);
    await reloadAll();
  } catch (err) {
    toast("Lỗi xóa: " + err.message, "error");
  }
}

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!isRealAdmin(firebaseAuth.currentUser)) {
    toast("Phiên đăng nhập hết hạn hoặc không phải admin.", "warn");
    return;
  }
  const type = document.getElementById("editType").value;
  const editId = document.getElementById("editId").value;
  const tagsStr = document.getElementById("fTags").value;

  const data = {
    id: editId || generateId(type === "photo" ? "ph" : "vid"),
    title: document.getElementById("fTitle").value.trim(),
    cosplayer: document.getElementById("fCosplayer").value.trim(),
    nameEng: document.getElementById("fNameEng").value.trim(),
    imageCount: document.getElementById("fImageCount").value.trim(),
    imageDimensions: document.getElementById("fImageDimensions").value.trim(),
    category: document.getElementById("fCategory").value.trim() || "anime",
    tags: tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
    desc: document.getElementById("fDesc").value.trim(),
    thumb: document.getElementById("fThumb").value.trim(),
    full: document.getElementById("fFull").value.trim() || document.getElementById("fThumb").value.trim(),
    downloadUrl: document.getElementById("fDownload").value.trim(),
    fileType: document.getElementById("fFileType").value,
    fileSize: document.getElementById("fSize").value.trim() || "—",
    views: parseInt(document.getElementById("fViews").value, 10) || 0,
    downloads: parseInt(document.getElementById("fDownloads").value, 10) || 0,
    isVideo: type === "video",
    createdAt: editId
      ? (type === "photo" ? photos : videos).find((i) => i.id === editId)?.createdAt || Date.now()
      : Date.now()
  };

  const submitBtn = editForm.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="far fa-spinner fa-spin"></i> Đang lưu...`;

  try {
    if (type === "photo") await savePhotoToFirebase(data);
    else await saveVideoToFirebase(data);
    try { await syncTagsFromPosts(); } catch (e) { console.warn(e); }
    closeModal();
    await reloadAll();
  } catch (err) {
    toast("Lỗi lưu: " + err.message, "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="far fa-floppy-disk"></i> Lưu Firebase`;
  }
});

async function loadTokens() {
  tokenList.innerHTML = `<div class="loading-msg"><i class="far fa-spinner fa-spin"></i> Đang tải...</div>`;
  try {
    await initFirebase();
    const snap = await firebaseDb.ref("downloadTokens").once("value");
    const obj = snap.val() || {};
    tokens = Object.keys(obj).map((k) => ({ token: k, ...obj[k] }));
    tokens.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    renderTokens();
  } catch (err) {
    tokenList.innerHTML = `<p style="color:#c62828">${escapeHtml(err.message)}</p>`;
  }
}

function renderTokens() {
  if (!tokens.length) {
    tokenList.innerHTML = `<p style="color:#999;padding:16px;margin:0">Chưa có token nào.</p>`;
    return;
  }
  const now = Date.now();
  tokenList.innerHTML = tokens
    .slice(0, 80)
    .map((t) => {
      let status = "ok";
      let label = "Còn hạn";
      if (t.used) {
        status = "used";
        label = "Đã dùng";
      } else if (t.expiresAt && now > t.expiresAt) {
        status = "exp";
        label = "Hết hạn";
      }
      const created = t.createdAt ? new Date(t.createdAt).toLocaleString("vi-VN") : "—";
      return `
      <div class="item-card">
        <div class="item-info" style="flex:1">
          <h4><code>${escapeHtml(String(t.token).slice(0, 16))}…</code> <span class="token-badge ${status}">${label}</span></h4>
          <p>${escapeHtml(t.title || t.postId || "—")} · ${created}</p>
        </div>
        <div class="item-actions">
          <button type="button" class="btn-sm btn-del" data-del-token="${escapeHtml(t.token)}"><i class="far fa-trash"></i></button>
        </div>
      </div>`;
    })
    .join("");

  tokenList.querySelectorAll("[data-del-token]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!(await confirmDialog("Xóa token này?", { title: "Xóa token" }))) return;
      try {
        await firebaseDb.ref("downloadTokens/" + btn.getAttribute("data-del-token")).remove();
        loadTokens();
      } catch (err) {
        toast(err.message, "error");
      }
    });
  });
}

document.getElementById("btnClearTokens").addEventListener("click", async () => {
  if (!(await confirmDialog("Xóa tất cả token đã dùng hoặc hết hạn?", { title: "Xóa token" }))) return;
  try {
    await initFirebase();
    const now = Date.now();
    const updates = {};
    tokens.forEach((t) => {
      if (t.used || (t.expiresAt && now > t.expiresAt)) updates[t.token] = null;
    });
    if (Object.keys(updates).length) await firebaseDb.ref("downloadTokens").update(updates);
    loadTokens();
  } catch (err) {
    toast(err.message, "error");
  }
});

async function loadSettings() {
  try {
    await initFirebase();
    const snap = await firebaseDb.ref("settings/site").once("value");
    const s = snap.val() || {};
    document.getElementById("setSiteName").value = s.siteName || "COSPLAYER";
    document.getElementById("setSlogan").value = s.slogan || "Ảnh Video Cosplay";
    document.getElementById("setFooter").value = s.footer || "© Copyright by Cosplayer ~ 01.09.22";
    document.getElementById("setHomePhotos").value = s.homePhotos || 6;
    document.getElementById("setHomeVideos").value = s.homeVideos || 6;
    document.getElementById("setTokenTTL").value = s.tokenTTL || 120;
    const adminEmailsEl = document.getElementById("setAdminEmails");
    if (adminEmailsEl) adminEmailsEl.value = s.adminEmails || "";
  } catch (err) {
    console.error(err);
  }
}

document.getElementById("settingsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("settingsMsg");
  try {
    await initFirebase();
    const data = {
      siteName: document.getElementById("setSiteName").value.trim(),
      slogan: document.getElementById("setSlogan").value.trim(),
      footer: document.getElementById("setFooter").value.trim(),
      homePhotos: parseInt(document.getElementById("setHomePhotos").value, 10) || 6,
      homeVideos: parseInt(document.getElementById("setHomeVideos").value, 10) || 6,
      tokenTTL: parseInt(document.getElementById("setTokenTTL").value, 10) || 120,
      adminEmails: (document.getElementById("setAdminEmails")?.value || "").trim(),
      updatedAt: Date.now()
    };
    await firebaseDb.ref("settings/site").set(data);
    msg.hidden = false;
    msg.style.color = "#2e7d32";
    msg.textContent = "Đã lưu cài đặt.";
  } catch (err) {
    msg.hidden = false;
    msg.style.color = "#c62828";
    msg.textContent = err.message;
  }
});

document.getElementById("btnSeed").addEventListener("click", async () => {
  const msg = document.getElementById("seedMsg");
  if (!isRealAdmin(firebaseAuth.currentUser)) {
    msg.style.color = "#c62828";
    msg.textContent = "Cần đăng nhập admin.";
    return;
  }
  msg.textContent = "Đang seed (public + privateDownloads)...";
  try {
    await seedAllForce();
    msg.style.color = "#2e7d32";
    msg.innerHTML = `<i class="far fa-check"></i> Seed thành công!`;
    await reloadAll();
  } catch (err) {
    msg.style.color = "#c62828";
    msg.textContent = err.message;
  }
});

document.getElementById("btnReload").addEventListener("click", () => reloadAll());

const btnExport = document.getElementById("btnExport");
if (btnExport) {
  btnExport.addEventListener("click", async () => {
    try {
      await loadPrivateMap();
      const privSnap = await firebaseDb.ref("privateDownloads").once("value");
      const data = {
        exportedAt: new Date().toISOString(),
        photos,
        videos,
        privateDownloads: privSnap.val() || {}
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "cosplayer-backup-" + Date.now() + ".json";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      toast(err.message, "error");
    }
  });
}

const importFile = document.getElementById("importFile");
if (importFile) {
  importFile.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(await confirmDialog("Import sẽ ghi đè / thêm dữ liệu theo file JSON. Tiếp tục?", { title: "Nhập dữ liệu", okHtml: '<i class="far fa-upload"></i> Tiếp tục' }))) {
      e.target.value = "";
      return;
    }
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (Array.isArray(data.photos)) {
        for (const p of data.photos) {
          const url =
            (data.privateDownloads && data.privateDownloads[p.id]?.downloadUrl) ||
            p.downloadUrl ||
            "";
          await savePhotoToFirebase({ ...p, downloadUrl: url });
        }
      }
      if (Array.isArray(data.videos)) {
        for (const v of data.videos) {
          const url =
            (data.privateDownloads && data.privateDownloads[v.id]?.downloadUrl) ||
            v.downloadUrl ||
            "";
          await saveVideoToFirebase({ ...v, downloadUrl: url });
        }
      }
      toast("Import xong!", "success");
      await reloadAll();
    } catch (err) {
      toast("Import lỗi: " + err.message, "error");
    }
    e.target.value = "";
  });
}

async function loadMenusTab() {
  const menuList = document.getElementById("menuList");
  const presetsEl = document.getElementById("quickMenuPresets");

  if (presetsEl && typeof DEFAULT_MENUS !== "undefined") {
    presetsEl.innerHTML = DEFAULT_MENUS.map(
      (m) =>
        `<button type="button" class="btn-outline" data-quick-menu="${escapeHtml(m.id)}" style="font-size:0.78rem">
          <i class="far ${escapeHtml(m.icon || "fa-link")}"></i> ${escapeHtml(m.label)}
        </button>`
    ).join("");
    presetsEl.querySelectorAll("[data-quick-menu]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-quick-menu");
        const m = DEFAULT_MENUS.find((x) => x.id === id);
        if (!m) return;
        try {
          await saveMenuItem({ ...m });
          await loadMenusTab();
        } catch (e) {
          toast(e.message, "error");
        }
      });
    });
  }

  if (!menuList) return;
  menuList.innerHTML = `<div class="loading-msg"><i class="far fa-spinner fa-spin"></i> Đang tải...</div>`;
  try {
    const menus = await fetchMenus();
    const ce = document.getElementById("countMenus");
    if (ce) ce.textContent = menus.length;
    if (!menus.length) {
      menuList.innerHTML = `<p style="color:#999;padding:16px;margin:0">Chưa có menu. Bấm nhanh bên trên hoặc "Menu mặc định".</p>`;
      return;
    }
    menuList.innerHTML = menus
      .map(
        (m, idx) => `
      <div class="item-card">
        <span class="item-order">${m.order ?? idx + 1}</span>
        <div class="item-info">
          <h4><i class="far ${escapeHtml(m.icon || "fa-link")}"></i> ${escapeHtml(m.label)}</h4>
          <p><code>${escapeHtml(m.url)}</code></p>
        </div>
        <div class="item-actions">
          <button type="button" class="btn-sm" data-edit-menu="${escapeHtml(m.id)}"><i class="far fa-pen"></i></button>
          <button type="button" class="btn-sm btn-del" data-del-menu="${escapeHtml(m.id)}"><i class="far fa-trash"></i></button>
        </div>
      </div>`
      )
      .join("");
    menuList.querySelectorAll("[data-edit-menu]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit-menu");
        const m = menus.find((x) => x.id === id);
        if (m) openMenuModal(m);
      });
    });
    menuList.querySelectorAll("[data-del-menu]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!(await confirmDialog("Xóa mục menu này?", { title: "Xóa menu" }))) return;
        try {
          await deleteMenuItem(btn.getAttribute("data-del-menu"));
          loadMenusTab();
        } catch (e) {
          toast(e.message, "error");
        }
      });
    });
  } catch (err) {
    menuList.innerHTML = `<p style="color:#c62828">${escapeHtml(err.message)}</p>`;
  }
}

function openMenuModal(item) {
  const modal = document.getElementById("menuModal");
  if (!modal) return;
  document.getElementById("menuEditId").value = item?.id || "";
  document.getElementById("menuModalTitle").textContent = item ? "Sửa menu" : "Thêm menu";
  document.getElementById("menuLabel").value = item?.label || "";
  document.getElementById("menuUrl").value = item?.url || "index.html";
  document.getElementById("menuIcon").value = item?.icon || "fa-link";
  document.getElementById("menuOrder").value = item?.order ?? 1;
  const nt = document.getElementById("menuOpenNewTab");
  if (nt) nt.checked = !!(item?.openInNewTab);
  modal.hidden = false;
}

function closeMenuModal() {
  const modal = document.getElementById("menuModal");
  if (modal) modal.hidden = true;
}

document.getElementById("btnAddMenu")?.addEventListener("click", () => openMenuModal(null));
document.getElementById("menuModalClose")?.addEventListener("click", closeMenuModal);
document.getElementById("menuModalCancel")?.addEventListener("click", closeMenuModal);
document.getElementById("menuModal")?.addEventListener("click", (e) => {
  if (e.target.id === "menuModal") closeMenuModal();
});

document.getElementById("menuForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await saveMenuItem({
      id: document.getElementById("menuEditId").value || undefined,
      label: document.getElementById("menuLabel").value.trim(),
      url: document.getElementById("menuUrl").value.trim(),
      icon: document.getElementById("menuIcon").value.trim() || "fa-link",
      order: document.getElementById("menuOrder").value,
      openInNewTab: !!(document.getElementById("menuOpenNewTab")?.checked)
    });
    closeMenuModal();
    loadMenusTab();
  } catch (err) {
    toast(err.message, "error");
  }
});

document.getElementById("btnSeedMenus")?.addEventListener("click", async () => {
  if (!(await confirmDialog("Ghi đè menu bằng bộ mặc định (giống menu trang chủ)?", { title: "Seed menu", okHtml: '<i class="far fa-check"></i> Đồng ý' }))) return;
  try {
    await seedDefaultMenus();
    loadMenusTab();
  } catch (err) {
    toast(err.message, "error");
  }
});

document.querySelectorAll(".side-btn").forEach((btn) => {
});

(function () {
  document.querySelectorAll('.side-btn[data-tab="cosplayers"]').forEach((btn) => {
    btn.addEventListener("click", () => loadCosplayersTab());
  });
})();

function renderCosplayerAdminPage() {
  const el = document.getElementById("cosplayerAdminList");
  if (!el) return;
  const list = cosplayerCache || [];
  if (!list.length) {
    el.innerHTML = `<p style="color:#999;padding:16px;margin:0">Chưa có cosplayer. Bấm Thêm cosplayer.</p>`;
    return;
  }
  const totalPages = Math.max(1, Math.ceil(list.length / ADMIN_CP_PER));
  if (cosplayerPage > totalPages) cosplayerPage = totalPages;
  if (cosplayerPage < 1) cosplayerPage = 1;
  const start = (cosplayerPage - 1) * ADMIN_CP_PER;
  const slice = list.slice(start, start + ADMIN_CP_PER);
  el.innerHTML =
    slice
      .map(
        (c) => `
      <div class="item-card">
        <div class="item-info" style="flex:1">
          <h4>${escapeHtml(c.name)}${c.nameEng ? " <small style='color:#888'>(" + escapeHtml(c.nameEng) + ")</small>" : ""}</h4>
          <p>Tag: <code>${escapeHtml(c.tag)}</code> · Link: cosplayers/ → list/?tag=...</p>
        </div>
        <div class="item-actions">
          <a class="btn-sm" href="list/?type=all&tag=${encodeURIComponent(c.tag)}" target="_blank"><i class="far fa-filter"></i></a>
          <button type="button" class="btn-sm" data-edit-cp="${escapeHtml(c.id)}"><i class="far fa-pen"></i></button>
          <button type="button" class="btn-sm btn-del" data-del-cp="${escapeHtml(c.id)}"><i class="far fa-trash"></i></button>
        </div>
      </div>`
      )
      .join("") + adminPagerHtml(cosplayerPage, totalPages, "data-cp-page");
  el.querySelectorAll("[data-edit-cp]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-edit-cp");
      const c = list.find((x) => x.id === id);
      if (c) openCpModal(c);
    });
  });
  el.querySelectorAll("[data-del-cp]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!(await confirmDialog("Xóa cosplayer này?", { title: "Xóa cosplayer" }))) return;
      try {
        await deleteCosplayer(btn.getAttribute("data-del-cp"));
        loadCosplayersTab();
      } catch (e) {
        toast(e.message, "error");
      }
    });
  });
  el.querySelectorAll("[data-cp-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      cosplayerPage = parseInt(btn.getAttribute("data-cp-page"), 10) || 1;
      renderCosplayerAdminPage();
    });
  });
}

async function loadCosplayersTab() {
  const el = document.getElementById("cosplayerAdminList");
  if (!el) return;
  el.innerHTML = `<div class="loading-msg"><i class="far fa-spinner fa-spin"></i> Đang tải...</div>`;
  try {
    const list = await fetchCosplayers();
    cosplayerCache = list;
    const ce = document.getElementById("countCosplayers");
    if (ce) ce.textContent = list.length;
    if (!list.length) {
      el.innerHTML = `<p style="color:#999;padding:16px;margin:0">Chưa có cosplayer. Bấm Thêm cosplayer.</p>`;
      return;
    }
    renderCosplayerAdminPage();
  } catch (err) {
    el.innerHTML = `<p style="color:#c62828">${escapeHtml(err.message)}</p>`;
  }
}

function openCpModal(item) {
  document.getElementById("cpEditId").value = item?.id || "";
  document.getElementById("cpModalTitle").textContent = item ? "Sửa cosplayer" : "Thêm cosplayer";
  document.getElementById("cpName").value = item?.name || "";
  document.getElementById("cpNameEng").value = item?.nameEng || "";
  document.getElementById("cpTag").value = item?.tag || item?.name || "";
  document.getElementById("cpModal").hidden = false;
}
function closeCpModal() {
  document.getElementById("cpModal").hidden = true;
}
document.getElementById("btnAddCosplayer")?.addEventListener("click", () => openCpModal(null));
document.getElementById("cpModalClose")?.addEventListener("click", closeCpModal);
document.getElementById("cpModalCancel")?.addEventListener("click", closeCpModal);
document.getElementById("cpModal")?.addEventListener("click", (e) => {
  if (e.target.id === "cpModal") closeCpModal();
});
document.getElementById("cpForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await saveCosplayer({
      id: document.getElementById("cpEditId").value || undefined,
      name: document.getElementById("cpName").value.trim(),
      nameEng: document.getElementById("cpNameEng").value.trim(),
      tag: document.getElementById("cpTag").value.trim()
    });
    closeCpModal();
    loadCosplayersTab();
  } catch (err) {
    toast(err.message, "error");
  }
});

async function loadTagsTab() {
  const el = document.getElementById("tagList");
  const countEl = document.getElementById("countTags");
  if (!el) return;
  el.innerHTML = `<div class="loading-msg"><i class="far fa-spinner fa-spin"></i> Đang tải...</div>`;
  try {
    await initFirebase();
    let tags = [];
    if (typeof fetchAllTags === "function") {
      tags = await fetchAllTags();
    } else {
      const snap = await firebaseDb.ref("tags").once("value");
      const obj = snap.val() || {};
      tags = Object.keys(obj)
        .map((name) => ({ name, count: obj[name] || 0 }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    }
    if (countEl) countEl.textContent = String(tags.length);
    if (!tags.length) {
      el.innerHTML = `<div class="tag-empty"><i class="far fa-tags" style="font-size:1.6rem;display:block;margin-bottom:8px;opacity:.5"></i>Chưa có tag.<br>Bấm <strong>Đồng bộ từ bài viết</strong> để quét tags từ ảnh/video.</div>`;
      return;
    }
    const totalPosts = tags.reduce((s, t) => s + (t.count || 0), 0);
    el.innerHTML = `
      <div class="tag-stats-bar">
        <span class="tag-stat"><i class="far fa-tags"></i> ${tags.length} tag</span>
        <span class="tag-stat"><i class="far fa-file"></i> ${totalPosts} lượt gắn</span>
      </div>
      <div class="tag-cloud">
        ${tags.map((t) => `
          <div class="tag-chip" title="${escapeHtml(t.name)}">
            <span class="tag-chip-name">#${escapeHtml(t.name)}</span>
            <span class="tag-chip-count">${t.count}</span>
            <span class="tag-chip-actions">
              <a href="list/?type=all&tag=${encodeURIComponent(t.name)}" target="_blank" title="Lọc list"><i class="far fa-filter"></i></a>
              <a href="index.html?tag=${encodeURIComponent(t.name)}" target="_blank" title="Trang chủ"><i class="far fa-house"></i></a>
            </span>
          </div>`).join("")}
      </div>`;
  } catch (err) {
    el.innerHTML = `<p style="color:#c62828">${escapeHtml(err.message || String(err))}</p>`;
  }
}

document.getElementById("btnSyncTags")?.addEventListener("click", async () => {
  const btn = document.getElementById("btnSyncTags");
  const el = document.getElementById("tagList");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="far fa-spinner fa-spin"></i> Đang đồng bộ...`;
  }
  try {
    if (typeof syncTagsFromPosts === "function") {
      await syncTagsFromPosts();
    } else {
      throw new Error("Thiếu syncTagsFromPosts trong firebase-config.js");
    }
    await loadTagsTab();
  } catch (err) {
    if (el) el.innerHTML = `<p style="color:#c62828">${escapeHtml(err.message || String(err))}</p>`;
    toast("Lỗi đồng bộ tag: " + (err.message || err), "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="far fa-rotate"></i> Đồng bộ từ bài viết`;
    }
  }
});

let allCommentsFlat = [];

async function loadCommentsAdmin() {
  const el = document.getElementById("commentAdminList");
  const countEl = document.getElementById("countComments");
  if (!el) return;
  el.innerHTML = `<div class="loading-msg"><i class="far fa-spinner fa-spin"></i> Đang tải...</div>`;
  try {
    await initFirebase();
    const snap = await firebaseDb.ref("comments").once("value");
    const root = snap.val() || {};
    allCommentsFlat = [];
    Object.keys(root).forEach((postId) => {
      const group = root[postId] || {};
      Object.keys(group).forEach((cid) => {
        allCommentsFlat.push({
          postId,
          id: cid,
          ...(group[cid] || {})
        });
      });
    });
    allCommentsFlat.sort((a, b) => {
      const ar = a.reported ? 1 : 0;
      const br = b.reported ? 1 : 0;
      if (br !== ar) return br - ar;
      const ap = a.approved === true ? 1 : 0;
      const bp = b.approved === true ? 1 : 0;
      if (ap !== bp) return ap - bp; // chờ duyệt lên trước
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    if (countEl) countEl.textContent = String(allCommentsFlat.length);
    renderCommentsAdmin("");
  } catch (err) {
    const msg = String(err.message || err);
    let help = "";
    if (/PERMISSION_DENIED|permission/i.test(msg)) {
      help = `<p class="tab-hint" style="margin-top:8px">Cần cập nhật <strong>Firebase Realtime Database Rules</strong> để cho phép đọc/ghi <code>comments</code>. Xem file <code>database.rules.json</code> trong project rồi paste vào Firebase Console → Realtime Database → Rules.</p>`;
    }
    el.innerHTML = `<p style="color:#c62828">${escapeHtml(msg)}</p>${help}`;
  }
}

function renderCommentsAdmin(filter) {
  const el = document.getElementById("commentAdminList");
  if (!el) return;
  const q = (filter || "").toLowerCase().trim();
  let rows = allCommentsFlat;
  if (q === "reported" || q === "bao" || q === "flag") {
    rows = rows.filter((c) => !!c.reported);
  } else if (q === "pending" || q === "cho" || q === "duyet") {
    rows = rows.filter((c) => c.approved !== true);
  } else if (q) {
    rows = rows.filter(
      (c) =>
        (c.postId || "").toLowerCase().includes(q) ||
        (c.name || "").toLowerCase().includes(q) ||
        (c.text || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q)
    );
  }
  if (!rows.length) {
    el.innerHTML = `<p class="tab-hint">Không có bình luận.</p>`;
    return;
  }
  el.innerHTML = rows
    .map((c) => {
      const time = c.createdAt
        ? new Date(c.createdAt).toLocaleString("vi-VN")
        : "—";
      const approved = c.approved === true;
      const reported = !!c.reported;
      const flag = reported
        ? ` · <span class="flag-reported"><i class="far fa-flag"></i> Báo xấu${c.reportCount ? " ×" + c.reportCount : ""}</span>`
        : "";
      return `<div class="item-row" data-cmt-post="${escapeHtml(c.postId)}" data-cmt-id="${escapeHtml(c.id)}" style="${reported ? "border-left:3px solid #c62828" : ""}">
        <div class="item-info" style="flex:1;min-width:0">
          <div class="item-title">${escapeHtml(c.name || "Ẩn danh")} <span style="font-weight:400;color:#888;font-size:0.8rem">· ${escapeHtml(time)}</span></div>
          <div class="item-meta" style="margin-top:2px">${c.email ? '<i class="far fa-envelope"></i> ' + escapeHtml(c.email) : ''}</div>
          <div class="item-meta" style="margin-top:4px">${escapeHtml(c.text || "")}</div>
          <div class="item-meta" style="margin-top:4px">Post: <code>${escapeHtml(c.postId)}</code> · ${approved ? '<span style="color:#2e7d32">Đã duyệt</span>' : '<span style="color:#ef6c00">Chờ duyệt</span>'}${flag}</div>
        </div>
        <div class="item-actions">
          <a class="btn-sm" href="post/?id=${encodeURIComponent(c.postId)}" target="_blank" title="Xem post"><i class="far fa-eye"></i></a>
          <button type="button" class="btn-sm" data-toggle-cmt title="${approved ? "Ẩn" : "Duyệt"}"><i class="far fa-${approved ? "eye-slash" : "check"}"></i></button>
          ${reported ? '<button type="button" class="btn-sm" data-clear-report title="Bỏ cờ báo xấu"><i class="far fa-flag"></i></button>' : ""}
          <button type="button" class="btn-sm btn-del" data-del-cmt title="Xóa"><i class="far fa-trash"></i></button>
        </div>
      </div>`;
    })
    .join("");

  el.querySelectorAll("[data-del-cmt]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest(".item-row");
      const postId = row.getAttribute("data-cmt-post");
      const id = row.getAttribute("data-cmt-id");
      if (!(await confirmDialog("Xóa bình luận này?", { title: "Xóa bình luận" }))) return;
      try {
        await firebaseDb.ref("comments/" + postId + "/" + id).remove();
        await loadCommentsAdmin();
      } catch (e) {
        toast(e.message, "error");
      }
    });
  });
  el.querySelectorAll("[data-toggle-cmt]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest(".item-row");
      const postId = row.getAttribute("data-cmt-post");
      const id = row.getAttribute("data-cmt-id");
      const item = allCommentsFlat.find((x) => x.postId === postId && x.id === id);
      if (!item) return;
      const next = item.approved !== true;
      try {
        await firebaseDb.ref("comments/" + postId + "/" + id + "/approved").set(next);
        toast(next ? "Đã duyệt bình luận." : "Đã ẩn bình luận.", "success");
        await loadCommentsAdmin();
      } catch (e) {
        toast(e.message, "error");
      }
    });
  });
  el.querySelectorAll("[data-clear-report]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const row = btn.closest(".item-row");
      const postId = row.getAttribute("data-cmt-post");
      const id = row.getAttribute("data-cmt-id");
      try {
        await firebaseDb.ref("comments/" + postId + "/" + id).update({
          reported: false,
          reportCount: 0,
          reportedAt: null
        });
        toast("Đã bỏ cờ báo xấu.", "success");
        await loadCommentsAdmin();
      } catch (e) {
        toast(e.message, "error");
      }
    });
  });
}

document.getElementById("searchComments")?.addEventListener("input", (e) => {
  renderCommentsAdmin(e.target.value);
});

document.getElementById("btnReloadComments")?.addEventListener("click", () => loadCommentsAdmin());

document.getElementById("btnExportSitemap")?.addEventListener("click", async () => {
  try {
    await initFirebase();
    const [photos, videos] = await Promise.all([
      fetchPhotosFromFirebase(),
      fetchVideosFromFirebase()
    ]);
    const origin = location.origin || "https://example.com";
    const base = origin.replace(/\/$/, "");
    const now = new Date().toISOString();
    const urls = [
      { loc: base + "/", priority: "1.0", changefreq: "daily" },
      { loc: base + "/list/?type=photo", priority: "0.8", changefreq: "daily" },
      { loc: base + "/list/?type=video", priority: "0.8", changefreq: "daily" },
      { loc: base + "/cosplayers/", priority: "0.6", changefreq: "weekly" }
    ];
    [...photos, ...videos].forEach((p) => {
      if (!p || !p.id) return;
      urls.push({
        loc: base + "/post/?id=" + encodeURIComponent(p.id),
        priority: "0.7",
        changefreq: "weekly",
        lastmod: p.createdAt ? new Date(p.createdAt).toISOString() : now
      });
    });
    const body = urls
      .map((u) => {
        let x = "  <url>\n    <loc>" + u.loc + "</loc>\n";
        if (u.lastmod) x += "    <lastmod>" + u.lastmod + "</lastmod>\n";
        x += "    <changefreq>" + (u.changefreq || "weekly") + "</changefreq>\n";
        x += "    <priority>" + (u.priority || "0.5") + "</priority>\n  </url>";
        return x;
      })
      .join("\n");
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      body +
      "\n</urlset>\n";
    const blob = new Blob([xml], { type: "application/xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sitemap.xml";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Đã tải sitemap.xml (" + urls.length + " URL).", "success");
  } catch (err) {
    toast("Lỗi xuất sitemap: " + (err.message || err), "error");
  }
});

(function adminThemeInit() {
  function getTheme() {
    try { return localStorage.getItem("cp-theme") || "light"; } catch (e) { return "light"; }
  }
  function syncThemeUi(t) {
    const isDark = t === "dark";
    const icon = isDark ? '<i class="far fa-sun"></i>' : '<i class="far fa-moon"></i>';
    const label = isDark ? "Chế độ sáng" : "Chế độ tối";
    const headerBtn = document.getElementById("adminThemeToggleHeader");
    if (headerBtn) {
      headerBtn.innerHTML = icon;
      headerBtn.title = label;
    }
    const sideBtn = document.getElementById("adminThemeToggleSide");
    if (sideBtn) {
      sideBtn.innerHTML = icon + ' <span id="adminThemeSideLabel">' + label + "</span>";
      sideBtn.title = label;
    }
    const old = document.getElementById("adminThemeToggle");
    if (old) {
      old.innerHTML = icon;
      old.title = label;
    }
  }
  function apply(t) {
    t = t === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
    document.body.classList.toggle("admin-dark", t === "dark");
    try { localStorage.setItem("cp-theme", t); } catch (e) {}
    syncThemeUi(t);
  }
  function toggle() {
    apply(getTheme() === "dark" ? "light" : "dark");
  }
  function bind() {
    const headerBtn = document.getElementById("adminThemeToggleHeader");
    if (headerBtn && !headerBtn.dataset.bound) {
      headerBtn.dataset.bound = "1";
      headerBtn.addEventListener("click", toggle);
    }
    const sideBtn = document.getElementById("adminThemeToggleSide");
    if (sideBtn && !sideBtn.dataset.bound) {
      sideBtn.dataset.bound = "1";
      sideBtn.addEventListener("click", toggle);
    }
  }
  apply(getTheme());
  const run = () => { bind(); apply(getTheme()); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  const panel = document.getElementById("adminPanel");
  if (panel) {
    const obs = new MutationObserver(() => {
      if (!panel.hidden) run();
    });
    obs.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  }
})();

(function adminSideLogout() {
  function bind() {
    const side = document.getElementById("btnLogoutSide");
    const main = document.getElementById("btnLogout");
    if (side && !side.dataset.bound) {
      side.dataset.bound = "1";
      side.addEventListener("click", () => {
        if (main) main.click();
        else {
          try { firebaseAuth && firebaseAuth.signOut(); } catch (e) {}
          if (typeof showLogin === "function") showLogin();
        }
      });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
  else bind();
  const panel = document.getElementById("adminPanel");
  if (panel) {
    new MutationObserver(() => { if (!panel.hidden) bind(); }).observe(panel, {
      attributes: true,
      attributeFilter: ["hidden"]
    });
  }
})();

(function adminMobileNav() {
  function ensure() {
    if (document.getElementById("adminNavToggle")) return;
    const header = document.querySelector(".admin-header");
    const sidebar = document.querySelector(".admin-sidebar");
    if (!header || !sidebar) return;

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.id = "adminNavToggle";
    toggle.className = "admin-nav-toggle";
    toggle.setAttribute("aria-label", "Mở menu");
    toggle.innerHTML = '<i class="far fa-bars"></i>';

    const overlay = document.createElement("div");
    overlay.id = "adminNavOverlay";
    overlay.className = "admin-nav-overlay";

    const left = header.querySelector(".admin-header-left");
    if (left) left.insertBefore(toggle, left.firstChild);
    else header.insertBefore(toggle, header.firstChild);
    document.body.appendChild(overlay);

    function close() {
      document.body.classList.remove("admin-nav-open");
      toggle.innerHTML = '<i class="far fa-bars"></i>';
      toggle.setAttribute("aria-label", "Mở menu");
    }
    function open() {
      document.body.classList.add("admin-nav-open");
      toggle.innerHTML = '<i class="far fa-xmark"></i>';
      toggle.setAttribute("aria-label", "Đóng menu");
    }

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      if (document.body.classList.contains("admin-nav-open")) close();
      else open();
    });
    overlay.addEventListener("click", close);
    sidebar.addEventListener("click", (e) => {
      if (e.target.closest(".side-btn")) close();
    });
    window.addEventListener(
      "resize",
      () => {
        if (window.innerWidth > 768) close();
      },
      { passive: true }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensure);
  } else {
    ensure();
  }
  const panel = document.getElementById("adminPanel");
  if (panel) {
    const obs = new MutationObserver(() => {
      if (!panel.hidden) ensure();
    });
    obs.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
  }
})();

(function adminScrollBtns() {
  function ensure() {
    if (document.getElementById("scrollFloat")) return;
    const wrap = document.createElement("div");
    wrap.id = "scrollFloat";
    wrap.className = "scroll-float is-visible show-top show-bottom";
    wrap.innerHTML = `
      <button type="button" class="scroll-float-btn" id="scrollTopBtn" title="Lên đầu"><i class="far fa-chevron-up"></i></button>
      <button type="button" class="scroll-float-btn" id="scrollBottomBtn" title="Xuống cuối"><i class="far fa-chevron-down"></i></button>`;
    document.body.appendChild(wrap);
    document.getElementById("scrollTopBtn").onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
    document.getElementById("scrollBottomBtn").onclick = () =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensure);
  else ensure();
})();