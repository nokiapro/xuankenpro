const firebaseConfig = {
  apiKey: "AIzaSyB3lTJ5pukLsKm5MA8yDQ746f9L6DkJ2n8",
  authDomain: "cosplay-ba10e.firebaseapp.com",
  databaseURL: "https://cosplay-ba10e-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "cosplay-ba10e",
  storageBucket: "cosplay-ba10e.firebasestorage.app",
  messagingSenderId: "124701335907",
  appId: "1:124701335907:web:5dfb0d5b4e8beef5463356",
  measurementId: "G-V6FKB8NEVP"
};

let firebaseApp = null;
let firebaseDb = null;
let firebaseAuth = null;
let firebaseReady = false;

function initFirebase() {
  if (firebaseReady) return Promise.resolve();
  return new Promise((resolve, reject) => {
    try {
      if (typeof firebase === "undefined") {
        reject(new Error("Firebase SDK chưa load"));
        return;
      }
      if (firebase.apps && firebase.apps.length) {
        firebaseApp = firebase.app();
      } else {
        firebaseApp = firebase.initializeApp(firebaseConfig);
      }
      firebaseDb = firebase.database();
      firebaseAuth = firebase.auth();
      try {
        firebase.analytics();
      } catch (e) {}
      firebaseReady = true;
      resolve();
    } catch (err) {
      if (firebase.apps && firebase.apps.length) {
        firebaseApp = firebase.app();
        firebaseDb = firebase.database();
        firebaseAuth = firebase.auth();
        firebaseReady = true;
        resolve();
      } else {
        reject(err);
      }
    }
  });
}

function generateId(prefix) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  const p = String(prefix || "").toLowerCase();
  if (p === "vid" || p === "video" || p === "xkvid") return "XKVID-" + s;
  return "XKIMG-" + s;
}

function generateToken(len) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  const n = len || 28;
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function objToArray(obj) {
  if (!obj) return [];
  return Object.keys(obj).map((key) => {
    const item = obj[key] || {};
    return { ...item, id: item.id || key };
  });
}

function sortNewest(arr) {
  return arr.slice().sort((a, b) => {
    const ta = a.createdAt || 0;
    const tb = b.createdAt || 0;
    if (tb !== ta) return tb - ta;
    return String(b.id).localeCompare(String(a.id));
  });
}

function publicPostFields(item) {
  const {
    id,
    title,
    category,
    tags,
    desc,
    thumb,
    full,
    fileType,
    fileSize,
    views,
    downloads,
    isVideo,
    createdAt,
    cosplayer,
    nameEng,
    imageCount,
    imageDimensions
  } = item;
  const out = {
    id,
    title: title || "",
    category: category || "",
    tags: tags || [],
    desc: desc || "",
    thumb: thumb || "",
    full: full || thumb || "",
    fileType: fileType || "zip",
    fileSize: fileSize || "—",
    views: views || 0,
    downloads: downloads || 0,
    createdAt: createdAt || Date.now(),
    cosplayer: cosplayer || "",
    nameEng: nameEng || "",
    imageCount: imageCount || "",
    imageDimensions: imageDimensions || ""
  };
  if (isVideo) out.isVideo = true;
  return out;
}

function safeFirebaseKey(str) {
  return String(str || "")
    .trim()
    .replace(/[.#$/\[\]]/g, "_")
    .replace(/\s+/g, "_")
    || "_empty";
}

async function syncTagsFromPosts() {
  await initFirebase();
  const [photos, videos] = await Promise.all([
    fetchPhotosFromFirebase(),
    fetchVideosFromFirebase()
  ]);
  const counts = {};
  [...photos, ...videos].forEach((p) => {
    (p.tags || []).forEach((tag) => {
      const t = String(tag).trim();
      if (!t) return;
      const key = safeFirebaseKey(t);
      if (!counts[key]) counts[key] = { name: t, count: 0 };
      if (t.length >= (counts[key].name || "").length) counts[key].name = t;
      counts[key].count += 1;
    });
  });
  await firebaseDb.ref("tags").set(counts);
  return counts;
}

async function fetchAllTags() {
  await initFirebase();
  const snap = await firebaseDb.ref("tags").once("value");
  const obj = snap.val() || {};
  return Object.keys(obj)
    .map((k) => {
      const v = obj[k];
      if (v && typeof v === "object") {
        return { name: v.name || k, count: v.count || 0, key: k };
      }
      return { name: k, count: typeof v === "number" ? v : 0, key: k };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

async function fetchPhotosFromFirebase() {
  await initFirebase();
  const snap = await firebaseDb.ref("photos").once("value");
  return sortNewest(objToArray(snap.val()));
}

async function fetchVideosFromFirebase() {
  await initFirebase();
  const snap = await firebaseDb.ref("videos").once("value");
  return sortNewest(objToArray(snap.val()));
}

async function fetchLatestFromFirebase(collection, limit) {
  await initFirebase();
  const n = Math.max(1, parseInt(limit, 10) || 6);
  const col = collection === "videos" ? "videos" : "photos";
  const snap = await firebaseDb
    .ref(col)
    .orderByChild("createdAt")
    .limitToLast(n)
    .once("value");
  return sortNewest(objToArray(snap.val())).slice(0, n);
}

async function fetchLatestPhotos(limit) {
  return fetchLatestFromFirebase("photos", limit == null ? 6 : limit);
}

async function fetchLatestVideos(limit) {
  return fetchLatestFromFirebase("videos", limit == null ? 6 : limit);
}

async function fetchPostsPage(collection, opts) {
  opts = opts || {};
  await initFirebase();
  const col = collection === "videos" ? "videos" : "photos";
  const limit = Math.max(1, parseInt(opts.limit, 10) || 8);
  const beforeTs =
    opts.beforeTs != null && opts.beforeTs !== ""
      ? Number(opts.beforeTs)
      : null;

  let query = firebaseDb.ref(col).orderByChild("createdAt");
  const fetchN = limit + 1;
  if (beforeTs != null && !isNaN(beforeTs)) {
    query = query.endAt(beforeTs - 1).limitToLast(fetchN);
  } else {
    query = query.limitToLast(fetchN);
  }

  const snap = await query.once("value");
  let items = sortNewest(objToArray(snap.val()));

  const hasMore = items.length > limit;
  if (hasMore) items = items.slice(0, limit);

  const nextBefore =
    items.length > 0 ? items[items.length - 1].createdAt || null : null;

  return { items: items, hasMore: hasMore, nextBefore: nextBefore };
}

async function fetchAllPostsPage(opts) {
  opts = opts || {};
  const limit = Math.max(1, parseInt(opts.limit, 10) || 8);
  const beforeTs =
    opts.beforeTs != null && opts.beforeTs !== ""
      ? Number(opts.beforeTs)
      : null;

  const [p, v] = await Promise.all([
    fetchPostsPage("photos", { limit: limit, beforeTs: beforeTs }),
    fetchPostsPage("videos", { limit: limit, beforeTs: beforeTs })
  ]);

  let merged = sortNewest(
    []
      .concat(p.items || [])
      .concat(
        (v.items || []).map(function (x) {
          return Object.assign({}, x, { isVideo: true });
        })
      )
  );

  const hasMore = merged.length > limit || p.hasMore || v.hasMore;
  if (merged.length > limit) merged = merged.slice(0, limit);

  const nextBefore =
    merged.length > 0 ? merged[merged.length - 1].createdAt || null : null;

  return { items: merged, hasMore: hasMore, nextBefore: nextBefore };
}

async function savePrivateDownload(id, downloadUrl) {
  await initFirebase();
  if (!id) throw new Error("Thiếu id");
  if (!downloadUrl) {
    await firebaseDb.ref("privateDownloads/" + id).remove();
    return;
  }
  await firebaseDb.ref("privateDownloads/" + id).set({
    downloadUrl: downloadUrl,
    updatedAt: Date.now()
  });
}

async function getPrivateDownloadUrl(id) {
  await initFirebase();
  const snap = await firebaseDb.ref("privateDownloads/" + id).once("value");
  if (!snap.exists()) return null;
  return snap.val().downloadUrl || null;
}

async function savePhotoToFirebase(item) {
  await initFirebase();
  if (!item.id) item.id = generateId("ph");
  if (!item.createdAt) item.createdAt = Date.now();
  const pub = publicPostFields(item);
  await firebaseDb.ref("photos/" + pub.id).set(pub);
  if (item.downloadUrl !== undefined) {
    await savePrivateDownload(pub.id, item.downloadUrl);
  }
  return pub;
}

async function saveVideoToFirebase(item) {
  await initFirebase();
  if (!item.id) item.id = generateId("vid");
  if (!item.createdAt) item.createdAt = Date.now();
  item.isVideo = true;
  const pub = publicPostFields(item);
  await firebaseDb.ref("videos/" + pub.id).set(pub);
  if (item.downloadUrl !== undefined) {
    await savePrivateDownload(pub.id, item.downloadUrl);
  }
  return pub;
}

async function deletePhotoFromFirebase(id) {
  await initFirebase();
  await firebaseDb.ref("photos/" + id).remove();
  await firebaseDb.ref("privateDownloads/" + id).remove();
}

async function deleteVideoFromFirebase(id) {
  await initFirebase();
  await firebaseDb.ref("videos/" + id).remove();
  await firebaseDb.ref("privateDownloads/" + id).remove();
}

async function fetchItemById(id) {
  await initFirebase();
  if (!id) return null;
  let snap = await firebaseDb.ref("photos/" + id).once("value");
  if (snap.exists()) {
    const v = snap.val() || {};
    return { ...v, id: v.id || id };
  }
  snap = await firebaseDb.ref("videos/" + id).once("value");
  if (snap.exists()) {
    const v = snap.val() || {};
    return { ...v, id: v.id || id, isVideo: true };
  }
  return null;
}

async function ensureAuthForDownload() {
  await initFirebase();
  if (firebaseAuth.currentUser) return firebaseAuth.currentUser;
  const cred = await firebaseAuth.signInAnonymously();
  return cred.user;
}

async function createDownloadTokenForPost(postId, title) {
  await initFirebase();
  await ensureAuthForDownload();
  const downloadUrl = await getPrivateDownloadUrl(postId);
  if (!downloadUrl) {
    throw new Error("Không tìm thấy link tải (privateDownloads). Admin cần nhập lại link zip.");
  }
  const token = generateToken(28);
  const data = {
    url: downloadUrl,
    postId: postId || "",
    title: title || "",
    createdAt: Date.now(),
    expiresAt: Date.now() + 2 * 60 * 1000,
    used: false
  };
  await firebaseDb.ref("downloadTokens/" + token).set(data);
  return token;
}

async function createDownloadToken(downloadUrl, postId, title) {
  await initFirebase();
  try {
    await ensureAuthForDownload();
  } catch (e) {
    console.warn("createDownloadToken auth", e);
  }
  const token = generateToken(28);
  const data = {
    url: downloadUrl,
    postId: postId || "",
    title: title || "",
    createdAt: Date.now(),
    expiresAt: Date.now() + 2 * 60 * 1000,
    used: false
  };
  await firebaseDb.ref("downloadTokens/" + token).set(data);
  return token;
}

async function getDownloadToken(token) {
  await initFirebase();
  try {
    await ensureAuthForDownload();
  } catch (e) {
    console.warn("getDownloadToken auth", e);
  }
  const snap = await firebaseDb.ref("downloadTokens/" + token).once("value");
  if (!snap.exists()) return null;
  return snap.val();
}

async function markTokenUsed(token) {
  await initFirebase();
  try {
    await ensureAuthForDownload();
  } catch (e) {}
  await firebaseDb.ref("downloadTokens/" + token).update({ used: true, usedAt: Date.now() });
}

async function resolvePostCollection(postId) {
  await initFirebase();
  const id = String(postId || "").trim();
  if (!id) return null;
  if (id.startsWith("XKVID")) return "videos";
  if (id.startsWith("XKIMG")) return "photos";
  const p = await firebaseDb.ref("photos/" + id).once("value");
  if (p.exists()) return "photos";
  const v = await firebaseDb.ref("videos/" + id).once("value");
  if (v.exists()) return "videos";
  return null;
}

async function incrementPostStat(postId, field) {
  const col = await resolvePostCollection(postId);
  if (!col) return null;
  if (field !== "views" && field !== "downloads") return null;
  try {
    if (typeof ensureAuthForDownload === "function") {
      await ensureAuthForDownload();
    } else if (firebaseAuth && !firebaseAuth.currentUser) {
      await firebaseAuth.signInAnonymously();
    }
  } catch (e) {
    console.warn("increment auth", e);
  }
  const ref = firebaseDb.ref(col + "/" + postId + "/" + field);
  const result = await ref.transaction((current) => {
    const n = typeof current === "number" ? current : parseInt(current, 10) || 0;
    return n + 1;
  });
  return result && result.snapshot ? result.snapshot.val() : null;
}

async function incrementPostViews(postId) {
  return incrementPostStat(postId, "views");
}

async function incrementPostDownloads(postId) {
  return incrementPostStat(postId, "downloads");
}

async function seedIfEmpty() {
  await initFirebase();
  const photoSnap = await firebaseDb.ref("photos").once("value");
  const videoSnap = await firebaseDb.ref("videos").once("value");
  if (!photoSnap.exists()) {
    for (const p of SEED_PHOTOS) {
      await savePhotoToFirebase(p);
    }
  }
  if (!videoSnap.exists()) {
    for (const v of SEED_VIDEOS) {
      await saveVideoToFirebase(v);
    }
  }
}

async function seedAllForce() {
  await initFirebase();
  for (const p of SEED_PHOTOS) {
    await savePhotoToFirebase(p);
  }
  for (const v of SEED_VIDEOS) {
    await saveVideoToFirebase(v);
  }
}