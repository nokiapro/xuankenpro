// Firebase configuration & helpers
// Link zip lưu ở privateDownloads (chỉ auth đọc) — không nằm trong photos/videos public

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

/**
 * Ảnh: XKIMG-XXXXXXXX (chữ+số viết hoa)
 * Video: XKVID-XXXXXXXX
 */
function generateId(prefix) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[Math.floor(Math.random() * chars.length)];
  const p = String(prefix || "").toLowerCase();
  if (p === "vid" || p === "video" || p === "xkvid") return "XKVID-" + s;
  // mặc định ảnh
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

/** Bỏ downloadUrl khỏi object public (không đẩy lên photos/videos) */
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

/** Firebase key an toàn (không chứa . # $ / [ ]) */
function safeFirebaseKey(str) {
  return String(str || "")
    .trim()
    .replace(/[.#$/\[\]]/g, "_")
    .replace(/\s+/g, "_")
    || "_empty";
}

/** Lưu / đồng bộ tag toàn cục (đếm số bài) */
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
      // giữ tên gốc đẹp nhất (ưu tiên có dấu chấm nếu trùng key)
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

/**
 * Đảm bảo có auth (anonymous nếu chưa login) để đọc privateDownloads — gói free vẫn dùng được.
 * Bật Anonymous trong Firebase Console → Authentication → Sign-in method.
 */
async function ensureAuthForDownload() {
  await initFirebase();
  if (firebaseAuth.currentUser) return firebaseAuth.currentUser;
  const cred = await firebaseAuth.signInAnonymously();
  return cred.user;
}

/**
 * Tạo token download:
 * 1) Auth (anonymous nếu cần)
 * 2) Đọc zip từ privateDownloads
 * 3) Ghi downloadTokens/{token} (public đọc được từng token)
 */
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

/** @deprecated dùng createDownloadTokenForPost */
async function createDownloadToken(downloadUrl, postId, title) {
  await initFirebase();
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
  const snap = await firebaseDb.ref("downloadTokens/" + token).once("value");
  if (!snap.exists()) return null;
  return snap.val();
}

async function markTokenUsed(token) {
  await initFirebase();
  await firebaseDb.ref("downloadTokens/" + token).update({ used: true, usedAt: Date.now() });
}

// ===== Seed: public posts + private zip links =====
const SEED_PHOTOS = [
  {
    id: "XKIMG-MAID001A",
    title: "Maid Cosplay Purple Hair",
    category: "anime",
    tags: ["maid", "anime"],
    desc: "Cosplay hầu gái tóc tím. Pack ảnh full HD.",
    thumb: "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=300&h=400&fit=crop",
    full: "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=1200",
    downloadUrl: "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=1200&dl=1",
    fileType: "zip",
    fileSize: "15.2 MB",
    views: 2100,
    downloads: 480,
    createdAt: Date.now() - 60000
  },
  {
    id: "XKIMG-BUNNY02B",
    title: "Bunny Girl Black",
    category: "anime",
    tags: ["bunny", "black"],
    desc: "Cosplay bunny girl phong cách tối.",
    thumb: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&h=400&fit=crop",
    full: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200",
    downloadUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&dl=1",
    fileType: "zip",
    fileSize: "18.7 MB",
    views: 3200,
    downloads: 720,
    createdAt: Date.now() - 50000
  },
  {
    id: "XKIMG-CYBER03C",
    title: "Cyberpunk Neon",
    category: "game",
    tags: ["cyberpunk", "neon"],
    desc: "Cosplay cyberpunk neon.",
    thumb: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=300&h=400&fit=crop",
    full: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200",
    downloadUrl: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&dl=1",
    fileType: "zip",
    fileSize: "22.1 MB",
    views: 1500,
    downloads: 310,
    createdAt: Date.now() - 40000
  },
  {
    id: "XKIMG-ELF004D",
    title: "Elf Fantasy",
    category: "fantasy",
    tags: ["elf", "fantasy"],
    desc: "Nữ hoàng elf fantasy.",
    thumb: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&h=400&fit=crop",
    full: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200",
    downloadUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&dl=1",
    fileType: "zip",
    fileSize: "12.4 MB",
    views: 980,
    downloads: 205,
    createdAt: Date.now() - 30000
  },
  {
    id: "XKIMG-GENSH05E",
    title: "Genshin Inspired",
    category: "game",
    tags: ["genshin", "game"],
    desc: "Lấy cảm hứng Genshin Impact.",
    thumb: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&h=400&fit=crop",
    full: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200",
    downloadUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&dl=1",
    fileType: "zip",
    fileSize: "30.5 MB",
    views: 4500,
    downloads: 1100,
    createdAt: Date.now() - 20000
  },
  {
    id: "XKIMG-SAMUR06F",
    title: "Samurai Girl",
    category: "anime",
    tags: ["samurai", "japan"],
    desc: "Cosplay samurai nữ.",
    thumb: "https://images.unsplash.com/photo-1545569341-9ba0c8d8f6d8?w=300&h=400&fit=crop",
    full: "https://images.unsplash.com/photo-1545569341-9ba0c8d8f6d8?w=1200",
    downloadUrl: "https://images.unsplash.com/photo-1545569341-9ba0c8d8f6d8?w=1200&dl=1",
    fileType: "zip",
    fileSize: "14.8 MB",
    views: 1700,
    downloads: 390,
    createdAt: Date.now() - 10000
  }
];

const SEED_VIDEOS = [
  {
    id: "XKVID-SHEER01A",
    title: "Sheer Black Cosplay",
    category: "video",
    tags: ["black", "sheer"],
    desc: "Video cosplay trang phục đen.",
    thumb: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=300&h=400&fit=crop",
    full: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=1200",
    downloadUrl: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=1200&dl=1",
    fileType: "zip",
    fileSize: "85 MB",
    views: 5600,
    downloads: 890,
    isVideo: true,
    createdAt: Date.now() - 55000
  },
  {
    id: "XKVID-HARNE02B",
    title: "Harness Style",
    category: "video",
    tags: ["harness"],
    desc: "Video cosplay phong cách harness.",
    thumb: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=300&h=400&fit=crop",
    full: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200",
    downloadUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=1200&dl=1",
    fileType: "zip",
    fileSize: "120 MB",
    views: 4100,
    downloads: 650,
    isVideo: true,
    createdAt: Date.now() - 45000
  },
  {
    id: "XKVID-BUNNY03C",
    title: "Bunny Red Dress",
    category: "video",
    tags: ["bunny", "red"],
    desc: "Video bunny girl váy đỏ.",
    thumb: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&h=400&fit=crop",
    full: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200",
    downloadUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&dl=1",
    fileType: "zip",
    fileSize: "95 MB",
    views: 7800,
    downloads: 1400,
    isVideo: true,
    createdAt: Date.now() - 35000
  },
  {
    id: "XKVID-PINK04DA",
    title: "Pink Magical Girl",
    category: "video",
    tags: ["magical", "pink"],
    desc: "Video magical girl hồng.",
    thumb: "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=300&h=400&fit=crop",
    full: "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=1200",
    downloadUrl: "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=1200&dl=1",
    fileType: "zip",
    fileSize: "110 MB",
    views: 3200,
    downloads: 520,
    isVideo: true,
    createdAt: Date.now() - 25000
  },
  {
    id: "XKVID-BEDR05EB",
    title: "Bedroom Pose",
    category: "video",
    tags: ["pose"],
    desc: "Video cosplay pose trong phòng.",
    thumb: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&h=400&fit=crop",
    full: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200",
    downloadUrl: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200&dl=1",
    fileType: "zip",
    fileSize: "140 MB",
    views: 9100,
    downloads: 1800,
    isVideo: true,
    createdAt: Date.now() - 15000
  },
  {
    id: "XKVID-ELEG06FC",
    title: "Elegant Style",
    category: "video",
    tags: ["elegant"],
    desc: "Video cosplay phong cách thanh lịch.",
    thumb: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=300&h=400&fit=crop",
    full: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200",
    downloadUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=1200&dl=1",
    fileType: "zip",
    fileSize: "75 MB",
    views: 2400,
    downloads: 410,
    isVideo: true,
    createdAt: Date.now() - 5000
  }
];

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

/** Seed đầy đủ (admin) — ghi public + privateDownloads */
async function seedAllForce() {
  await initFirebase();
  for (const p of SEED_PHOTOS) {
    await savePhotoToFirebase(p);
  }
  for (const v of SEED_VIDEOS) {
    await saveVideoToFirebase(v);
  }
}
