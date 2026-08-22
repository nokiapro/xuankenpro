function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

/** Link → list all, lọc theo tag (nếu có) */
function tagHref(tag) {
  const t = (tag || "").trim();
  if (t) return "../list/?type=all&tag=" + encodeURIComponent(t);
  return "../list/?type=all";
}

async function fetchCosplayers() {
  await initFirebase();
  const snap = await firebaseDb.ref("cosplayers").once("value");
  const obj = snap.val() || {};
  return Object.keys(obj)
    .map((k) => ({ id: k, ...(obj[k] || {}) }))
    .sort((a, b) => {
      // Thứ tự thêm vào: createdAt tăng dần; fallback key
      const ca = a.createdAt || 0;
      const cb = b.createdAt || 0;
      if (ca && cb && ca !== cb) return ca - cb;
      if (ca && !cb) return -1;
      if (!ca && cb) return 1;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
}

function displayName(c) {
  const name = c.name || c.tag || "";
  const eng = (c.nameEng || "").trim();
  if (eng) return `${name} (${eng})`;
  return name;
}

function renderList(list) {
  const el = document.getElementById("cosplayerList");
  if (!el) return;
  const countEl = document.getElementById("cpCount");
  if (countEl) countEl.textContent = list.length + " cosplayer";
  if (!list.length) {
    el.innerHTML = `<p class="cp-empty">Chưa có cosplayer. Vào Admin → List Cosplayer để thêm.</p>`;
    return;
  }
  el.innerHTML = list
    .map((c) => {
      const tag = c.tag || c.name || "";
      const label = displayName(c);
      return `<div class="cp-row">
        <a class="cp-link" href="${tagHref(tag)}" target="_blank" rel="noopener">
          <b>${escapeHtml(label)}</b>
        </a>
      </div>`;
    })
    .join("");
}

(async function init() {
  try {
    await initFirebase();
    let list = await fetchCosplayers();
    renderList(list);

    const search = document.getElementById("cpSearch");
    if (search) {
      search.addEventListener("input", () => {
        const q = search.value.trim().toLowerCase();
        const filtered = !q
          ? list
          : list.filter(
              (c) =>
                (c.name || "").toLowerCase().includes(q) ||
                (c.nameEng || "").toLowerCase().includes(q) ||
                (c.tag || "").toLowerCase().includes(q)
            );
        renderList(filtered);
      });
    }
  } catch (err) {
    console.error(err);
    const el = document.getElementById("cosplayerList");
    if (el) el.innerHTML = `<p class="cp-empty" style="color:#c62828">${escapeHtml(err.message)}</p>`;
  }
})();

async function saveCosplayer(item) {
  await initFirebase();
  if (!item.id) item.id = "cp_" + Date.now().toString(36);
  const payload = {
    name: item.name || "",
    nameEng: item.nameEng || "",
    tag: item.tag || item.name || "",
    order: parseInt(item.order, 10) || 0
  };
  // Giữ createdAt cũ khi sửa; bài mới = thời điểm thêm
  if (item.createdAt) payload.createdAt = item.createdAt;
  else if (!item.id || String(item.id).startsWith("cp_")) {
    // will set below after knowing if exists
  }
  const ref = firebaseDb.ref("cosplayers/" + item.id);
  const prev = await ref.once("value");
  if (prev.exists() && prev.val().createdAt) {
    payload.createdAt = prev.val().createdAt;
  } else {
    payload.createdAt = item.createdAt || Date.now();
  }
  await ref.set(payload);
  return item.id;
}

async function deleteCosplayer(id) {
  await initFirebase();
  await firebaseDb.ref("cosplayers/" + id).remove();
}
