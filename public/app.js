// ===================== Nepal TVD - App Logic =====================

// ---------- Navigation ----------
const navButtons = document.querySelectorAll(".nav-btn");
const pages = document.querySelectorAll(".page");

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.page;
    navButtons.forEach((b) => b.classList.remove("active"));
    pages.forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(target).classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
});

// ---------- Toast ----------
let toastTimer = null;
function showToast(msg, duration = 2200) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.remove("hidden");
  requestAnimationFrame(() => toast.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.classList.add("hidden"), 300);
  }, duration);
}

// ---------- Paste button ----------
document.getElementById("paste-btn").addEventListener("click", async () => {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      document.getElementById("url-input").value = text.trim();
      showToast("Link paste vayo!");
    }
  } catch (e) {
    showToast("Paste garna sakinu, manually paste garnu hos");
  }
});

// ---------- Download flow ----------
const urlInput = document.getElementById("url-input");
const downloadBtn = document.getElementById("download-btn");
const loadingBox = document.getElementById("loading-box");
const errorBox = document.getElementById("error-box");
const resultBox = document.getElementById("result-box");
const resultThumb = document.getElementById("result-thumb");
const resultTitle = document.getElementById("result-title");
const resultAuthor = document.getElementById("result-author");
const resultMediaList = document.getElementById("result-media-list");
const newDownloadBtn = document.getElementById("new-download-btn");

function setLoading(isLoading) {
  loadingBox.classList.toggle("hidden", !isLoading);
  downloadBtn.disabled = isLoading;
  downloadBtn.style.opacity = isLoading ? "0.6" : "1";
}

function showError(msg) {
  errorBox.textContent = "⚠️ " + msg;
  errorBox.classList.remove("hidden");
}

function hideError() {
  errorBox.classList.add("hidden");
}

function iconForType(type) {
  if (type === "video") return "🎬";
  if (type === "audio") return "🎵";
  if (type === "image") return "🖼️";
  return "📁";
}

function renderResult(data) {
  resultThumb.src = data.thumbnail || "/icons/icon-192.png";
  resultThumb.onerror = () => { resultThumb.src = "/icons/icon-192.png"; };
  resultTitle.textContent = data.title || "Untitled";
  resultAuthor.textContent = data.author ? "@" + data.author : (
    data.platform === "tiktok" ? "TikTok" :
    data.platform === "instagram" ? "Instagram" : "Pinterest"
  );

  resultMediaList.innerHTML = "";
  data.media.forEach((item) => {
    const div = document.createElement("div");
    div.className = "media-item";

    const proxied = `/api/proxy?url=${encodeURIComponent(item.url)}&name=${encodeURIComponent((data.title || "nepal_tvd").slice(0, 30))}`;

    div.innerHTML = `
      <div class="media-item-info">
        <span class="media-badge">${iconForType(item.type)}</span>
        <span class="media-quality">${item.quality}</span>
      </div>
      <a class="media-download-btn" href="${proxied}" download>⬇ Download</a>
    `;
    resultMediaList.appendChild(div);
  });

  resultBox.classList.remove("hidden");
}

async function startDownload() {
  const url = urlInput.value.trim();
  hideError();
  resultBox.classList.add("hidden");

  if (!url) {
    showError("Kripaya video link paste garnu hos.");
    return;
  }

  setLoading(true);
  try {
    const res = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error || "Video fetch garna sakinu.");
    }

    renderResult(json.data);
  } catch (err) {
    showError(err.message || "Kehi galat vayo, feri try garnu hos.");
  } finally {
    setLoading(false);
  }
}

downloadBtn.addEventListener("click", startDownload);
urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startDownload();
});

newDownloadBtn.addEventListener("click", () => {
  urlInput.value = "";
  resultBox.classList.add("hidden");
  hideError();
  urlInput.focus();
});

// Auto-detect platform chip highlight based on input
const platformChips = document.querySelectorAll(".platform-chip");
urlInput.addEventListener("input", () => {
  const val = urlInput.value.toLowerCase();
  platformChips.forEach((c) => c.classList.remove("active"));
  if (val.includes("tiktok")) {
    document.querySelector('[data-tip="TikTok"]').classList.add("active");
  } else if (val.includes("instagram")) {
    document.querySelector('[data-tip="Instagram"]').classList.add("active");
  } else if (val.includes("pinterest") || val.includes("pin.it")) {
    document.querySelector('[data-tip="Pinterest"]').classList.add("active");
  }
});

// ---------- Galleries ----------
const gallery3DImages = [
  { src: "/assets/3d/3d_1.jpg", title: "3D Abstract Sphere" },
  { src: "/assets/3d/3d_2.jpg", title: "3D Rainbow Water Drop" },
  { src: "/assets/3d/3d_3.jpg", title: "3D Space Balls" },
  { src: "/assets/3d/3d_4.jpg", title: "3D Sharp Geometry" },
  { src: "/assets/3d/3d_5.jpg", title: "3D Color Waves" },
  { src: "/assets/3d/3d_6.jpg", title: "3D Colorful Render" },
  { src: "/assets/3d/3d_7.jpg", title: "3D Abstract Eyes" },
];

const galleryPhotos = [
  { src: "/assets/photos/1.jpg", title: "Everest Base Camp" },
  { src: "/assets/photos/2.jpg", title: "Sagarmatha National Park" },
  { src: "/assets/photos/3.jpg", title: "Nepal Mountains" },
  { src: "/assets/photos/4.jpg", title: "Kathmandu Heritage" },
  { src: "/assets/photos/5.jpg", title: "Kathmandu Temples" },
  { src: "/assets/photos/6.jpg", title: "Pashupatinath Temple" },
  { src: "/assets/photos/7.jpg", title: "Nepal Trekking" },
];

function renderGallery(containerId, items) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "gallery-item";
    div.innerHTML = `
      <img src="${item.src}" alt="${item.title}" loading="lazy" />
      <div class="gallery-overlay">${item.title}</div>
    `;
    div.addEventListener("click", () => openImageModal(item));
    container.appendChild(div);
  });
}

renderGallery("gallery-3d", gallery3DImages);
renderGallery("gallery-photos", galleryPhotos);

// ---------- Image Modal ----------
const imgModal = document.getElementById("img-modal");
const imgModalImg = document.getElementById("img-modal-img");
const imgModalDownload = document.getElementById("img-modal-download");
const imgModalClose = document.getElementById("img-modal-close");

function openImageModal(item) {
  imgModalImg.src = item.src;
  imgModalDownload.href = item.src;
  imgModalDownload.setAttribute("download", item.title.replace(/\s+/g, "_") + ".jpg");
  imgModal.classList.remove("hidden");
}

imgModalClose.addEventListener("click", () => imgModal.classList.add("hidden"));
imgModal.addEventListener("click", (e) => {
  if (e.target === imgModal) imgModal.classList.add("hidden");
});

// ---------- PWA launch params (share_target / shortcuts / protocol) ----------
(function handleLaunchParams() {
  try {
    const params = new URLSearchParams(window.location.search);

    // Share Target: TikTok/Instagram/Pinterest app bata "Share" garda link aauchha
    const sharedUrl = params.get("url") || params.get("text") || "";
    const linkMatch = sharedUrl.match(/https?:\/\/\S+/);
    if (linkMatch) {
      urlInput.value = linkMatch[0];
      showToast("Link ready! Download thichnu hos");
      urlInput.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    // Protocol handler: web+nepaltvd://<link>
    const proto = params.get("protocol");
    if (proto) {
      const decoded = decodeURIComponent(proto).replace(/^web\+nepaltvd:\/?\/?/, "");
      const pm = decoded.match(/https?:\/\/\S+/);
      if (pm) {
        urlInput.value = pm[0];
        showToast("Link ready! Download thichnu hos");
      }
    }

    // Shortcut: About/How-To page kholne
    if (params.get("shortcut") === "howto") {
      const aboutBtn = document.querySelector('.nav-btn[data-page="page-about"]');
      if (aboutBtn) aboutBtn.click();
    }

    // URL safaa garne (params nahataye refresh ma feri trigger hunchha)
    if (params.toString()) {
      history.replaceState(null, "", window.location.pathname);
    }
  } catch (e) {
    /* ignore */
  }
})();

// ---------- Service Worker (PWA) ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
