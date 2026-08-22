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
  return `
    <a href="${href}" class="card card-animate" style="animation-delay:${delay}s" aria-label="${escapeAttr(item.title)}">
      <img src="${escapeAttr(item.thumb)}" alt="${escapeAttr(item.title)}" loading="lazy"
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

function filterByTag(list, tag) {
  if (!tag) return list;
  const t = tag.toLowerCase();
  return list.filter((item) =>
    (item.tags || []).some((x) => String(x).toLowerCase() === t)
  );
}

async function render() {
  try {
    await initFirebase();
    const params = new URLSearchParams(window.location.search);
    const tag = (params.get("tag") || "").trim();

    let [photos, videos] = await Promise.all([
      fetchPhotosFromFirebase(),
      fetchVideosFromFirebase()
    ]);

    if (tag) {
      photos = filterByTag(photos, tag);
      videos = filterByTag(videos, tag);
      const banner = document.getElementById("tagBanner");
      if (banner) {
        banner.hidden = false;
        banner.innerHTML = `Đang lọc tag: <strong>#${tag}</strong> · <a href="./">Xóa bộ lọc</a>`;
      }
    }

    const photoList = photos.slice(0, 6);
    const videoList = videos.slice(0, 6);
    photoGrid.innerHTML = photoList.length
      ? photoList.map((item, i) => createCard(item, i)).join("")
      : `<div class="loading-msg">${tag ? "Không có ảnh với tag này." : "Chưa có ảnh. Vào Admin → Seed dữ liệu."}</div>`;
    videoGrid.innerHTML = videoList.length
      ? videoList.map((item, i) => createCard(item, i)).join("")
      : `<div class="loading-msg">${tag ? "Không có video với tag này." : "Chưa có video."}</div>`;
  } catch (err) {
    console.error(err);
    photoGrid.innerHTML = `<div class="loading-msg"><i class="far fa-triangle-exclamation"></i> Lỗi tải dữ liệu Firebase.</div>`;
    videoGrid.innerHTML = "";
  }
}
render();
