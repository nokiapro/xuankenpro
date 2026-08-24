const photoGrid = document.getElementById("photoGrid");
const videoGrid = document.getElementById("videoGrid");

function createCard(item, index) {
  if (!item || !item.thumb) {
    return `<div class="card placeholder" title="${item?.title || "Coming Soon"}"></div>`;
  }
  const href =
    typeof postUrl === "function"
      ? postUrl(item.id)
      : "post/?id=" + encodeURIComponent(item.id);
  const delay = Math.min(index || 0, 12) * 0.06;
  const eager = index < 2;
  const loadAttr = eager
    ? 'loading="eager" fetchpriority="high" decoding="async"'
    : 'loading="lazy" decoding="async" fetchpriority="low"';
  return `
    <a href="${href}" class="card card-animate" style="animation-delay:${delay}s" aria-label="${escapeAttr(item.title)}">
      <img src="${escapeAttr(item.thumb)}" alt="${escapeAttr(item.title)}" ${loadAttr}
           onerror="this.parentElement.classList.add('placeholder'); this.remove();" />
      <span class="card-title"><span class="card-title-inner">${escapeAttr(item.title)}</span></span>
    </a>
  `;
}

function escapeAttr(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

async function render() {
  try {
    await initFirebase();
    const [photos, videos] = await Promise.all([
      typeof fetchLatestPhotos === "function"
        ? fetchLatestPhotos(6)
        : fetchPhotosFromFirebase().then((a) => a.slice(0, 6)),
      typeof fetchLatestVideos === "function"
        ? fetchLatestVideos(6)
        : fetchVideosFromFirebase().then((a) => a.slice(0, 6))
    ]);

    photoGrid.innerHTML = photos.length
      ? photos.map((item, i) => createCard(item, i)).join("")
      : `<div class="loading-msg">Chưa có ảnh. Vào Admin → Seed dữ liệu.</div>`;
    videoGrid.innerHTML = videos.length
      ? videos.map((item, i) => createCard(item, i)).join("")
      : `<div class="loading-msg">Chưa có video.</div>`;
  } catch (err) {
    console.error(err);
    photoGrid.innerHTML = `<div class="loading-msg"><i class="far fa-triangle-exclamation"></i> Lỗi tải dữ liệu Firebase.</div>`;
    videoGrid.innerHTML = "";
  }
}
render();