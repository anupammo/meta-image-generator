/**
 * popup.js
 *
 * Handles:
 *  1. Reading meta/OG tags from the active tab via content.js
 *  2. Displaying meta image status and a preview of any existing image
 *  3. Generating a professional 1200×630 social-preview image on an HTML Canvas
 *  4. Offering downloadable links in PNG, JPEG and WebP formats
 */

/* ─── Helpers ────────────────────────────────────────────────────── */

/** Show element (removes "hidden" class). */
function show(el) { el.classList.remove("hidden"); }

/** Hide element (adds "hidden" class). */
function hide(el) { el.classList.add("hidden"); }

/** Return element by id. */
function $(id) { return document.getElementById(id); }

/** Truncate a string to maxLen characters, appending "…" if needed. */
function truncate(str, maxLen) {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen - 1) + "…" : str;
}

/* ─── Canvas drawing helpers ─────────────────────────────────────── */

/**
 * Wrap text onto multiple lines in a canvas context.
 * @returns {string[]} Array of lines.
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Draw a rounded rectangle path.
 */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ─── Template definitions ───────────────────────────────────────── */

/**
 * Returns a drawing function for the chosen template.
 * The drawing function receives (ctx, canvasW, canvasH, data) and paints the
 * full image.
 */
const TEMPLATES = {
  "gradient-blue": {
    bg: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#1a73e8");
      g.addColorStop(1, "#0d47a1");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    textColor: "#ffffff",
    accentColor: "rgba(255,255,255,0.25)",
    domainColor: "rgba(255,255,255,0.7)",
  },
  "gradient-purple": {
    bg: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#7c3aed");
      g.addColorStop(1, "#3b0764");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    textColor: "#ffffff",
    accentColor: "rgba(255,255,255,0.25)",
    domainColor: "rgba(255,255,255,0.7)",
  },
  "gradient-green": {
    bg: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#059669");
      g.addColorStop(1, "#064e3b");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    textColor: "#ffffff",
    accentColor: "rgba(255,255,255,0.25)",
    domainColor: "rgba(255,255,255,0.7)",
  },
  "gradient-orange": {
    bg: (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#f97316");
      g.addColorStop(1, "#7c2d12");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    textColor: "#ffffff",
    accentColor: "rgba(255,255,255,0.25)",
    domainColor: "rgba(255,255,255,0.7)",
  },
  "dark": {
    bg: (ctx, w, h) => {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, w, h);
      // subtle grid – batch all lines into two paths for efficiency
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
      ctx.stroke();
      ctx.beginPath();
      for (let y = 0; y < h; y += 60) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
      ctx.stroke();
    },
    textColor: "#f4f4f5",
    accentColor: "#3f3f46",
    domainColor: "#a1a1aa",
  },
  "light": {
    bg: (ctx, w, h) => {
      ctx.fillStyle = "#f9fafb";
      ctx.fillRect(0, 0, w, h);
      // top colour bar
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, "#1a73e8");
      g.addColorStop(1, "#7c3aed");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, 8);
    },
    textColor: "#1f2937",
    accentColor: "#e5e7eb",
    domainColor: "#6b7280",
  },
  "branded": {
    bg: (ctx, w, h, customBg) => {
      ctx.fillStyle = customBg || "#1a73e8";
      ctx.fillRect(0, 0, w, h);
    },
    textColor: "#ffffff",
    accentColor: "rgba(255,255,255,0.2)",
    domainColor: "rgba(255,255,255,0.75)",
  },
};

/**
 * Paint the full social-preview image onto the canvas.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} opts - { templateKey, title, description, domain, customBg }
 */
function paintImage(canvas, opts) {
  const { templateKey, title, description, domain, customBg } = opts;
  const tpl = TEMPLATES[templateKey] || TEMPLATES["gradient-blue"];
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const PAD = Math.round(W * 0.07); // ~84px for 1200w

  // 1. Background
  tpl.bg(ctx, W, H, customBg);

  // 2. Decorative shapes
  ctx.fillStyle = tpl.accentColor;
  // Bottom-right circle
  ctx.beginPath();
  ctx.arc(W + Math.round(W * 0.08), H + Math.round(H * 0.08), Math.round(H * 0.6), 0, Math.PI * 2);
  ctx.fill();
  // Top-left smaller circle
  ctx.beginPath();
  ctx.arc(-Math.round(W * 0.04), -Math.round(H * 0.04), Math.round(H * 0.3), 0, Math.PI * 2);
  ctx.fill();

  // 3. Title
  const titleFontSize = Math.round(H * 0.1);  // ~63px for 630h
  ctx.fillStyle = tpl.textColor;
  ctx.font = `700 ${titleFontSize}px "Google Sans", "Segoe UI", Roboto, Arial, sans-serif`;
  ctx.textBaseline = "top";
  const maxTextWidth = W - PAD * 2;
  const titleLines = wrapText(ctx, title || "Untitled", maxTextWidth);
  // Limit to 2 lines
  const displayTitleLines = titleLines.slice(0, 2);
  const titleLineH = titleFontSize * 1.25;
  const titleBlockH = displayTitleLines.length * titleLineH;

  // 4. Description
  const descFontSize = Math.round(H * 0.052); // ~33px
  ctx.font = `400 ${descFontSize}px "Google Sans", "Segoe UI", Roboto, Arial, sans-serif`;
  const descLines = description ? wrapText(ctx, description, maxTextWidth) : [];
  const displayDescLines = descLines.slice(0, 3);
  const descLineH = descFontSize * 1.5;
  const descBlockH = displayDescLines.length * descLineH;

  // 5. Domain pill at bottom
  const domainFontSize = Math.round(H * 0.044);
  const domainPillH = domainFontSize + 20;
  const domainPillY = H - PAD - domainPillH;

  // Calculate vertical start for the title (center the text block in the canvas)
  const gap = Math.round(H * 0.04);
  const totalTextH = titleBlockH + (displayDescLines.length > 0 ? gap + descBlockH : 0);
  let y = Math.round((H - totalTextH) / 2) - Math.round(domainPillH / 2);
  if (y < PAD) y = PAD;

  // Draw title lines
  ctx.fillStyle = tpl.textColor;
  ctx.font = `700 ${titleFontSize}px "Google Sans", "Segoe UI", Roboto, Arial, sans-serif`;
  ctx.textBaseline = "top";
  for (const line of displayTitleLines) {
    ctx.fillText(line, PAD, y);
    y += titleLineH;
  }

  // Draw description lines
  if (displayDescLines.length > 0) {
    y += gap;
    ctx.fillStyle = templateKey === "light" ? "rgba(31,41,55,0.75)" : "rgba(255,255,255,0.82)";
    ctx.font = `400 ${descFontSize}px "Google Sans", "Segoe UI", Roboto, Arial, sans-serif`;
    for (const line of displayDescLines) {
      ctx.fillText(line, PAD, y);
      y += descLineH;
    }
  }

  // 6. Domain pill
  if (domain) {
    ctx.font = `500 ${domainFontSize}px "Google Sans", "Segoe UI", Roboto, Arial, sans-serif`;
    const textW = ctx.measureText(domain).width;
    const pillW = textW + 32;
    const pillX = PAD;
    const pillY2 = domainPillY;

    // Pill background
    ctx.fillStyle = tpl.accentColor;
    roundRect(ctx, pillX, pillY2, pillW, domainPillH, domainPillH / 2);
    ctx.fill();

    // Domain text
    ctx.fillStyle = tpl.domainColor;
    ctx.textBaseline = "middle";
    ctx.fillText(domain, pillX + 16, pillY2 + domainPillH / 2);
  }
}

/* ─── Download helper ────────────────────────────────────────────── */

/**
 * Create a downloadable anchor element for the current canvas state.
 * @param {HTMLCanvasElement} canvas
 * @param {string} format - "png" | "jpeg" | "webp"
 * @param {string} filename - base filename without extension
 * @returns {HTMLAnchorElement}
 */
function makeDownloadLink(canvas, format, filename) {
  const mimeMap = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
  const extMap  = { png: "png",       jpeg: "jpg",        webp: "webp" };
  const mime    = mimeMap[format] || "image/png";
  const ext     = extMap[format]  || "png";
  const quality = format === "jpeg" ? 0.92 : undefined;
  const dataUrl = canvas.toDataURL(mime, quality);

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${filename}.${ext}`;
  a.className = "download-btn";
  a.textContent = `↓ ${ext.toUpperCase()}`;
  return a;
}

/* ─── Resolution helper ──────────────────────────────────────────── */

function parseResolution(value) {
  const [w, h] = value.split("x").map(Number);
  return { w: w || 1200, h: h || 630 };
}

/* ─── Main init ──────────────────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
  const loadingEl     = $("loading");
  const errorEl       = $("error-state");
  const mainEl        = $("main-content");
  const errorMsgEl    = $("error-message");
  const statusBadge   = $("status-badge");
  const statusIcon    = $("status-icon");
  const statusText    = $("status-text");
  const existingPreview = $("existing-preview");
  const existingImg   = $("existing-img");
  const metaSource    = $("meta-source");
  const metaDimensions = $("meta-dimensions");

  const pgTitle   = $("pg-title");
  const pgDesc    = $("pg-desc");
  const pgDomain  = $("pg-domain");
  const pgType    = $("pg-type");
  const pgTwitter = $("pg-twitter");

  const templateSelect  = $("template-select");
  const colorGroup      = $("color-group");
  const bgColor         = $("bg-color");
  const bgColorHex      = $("bg-color-hex");
  const genTitle        = $("gen-title");
  const titleCount      = $("title-count");
  const genDesc         = $("gen-desc");
  const descCount       = $("desc-count");
  const genDomain       = $("gen-domain");
  const resolutionSelect = $("resolution-select");
  const btnPreview      = $("btn-preview");
  const btnGenerate     = $("btn-generate");
  const canvasWrapper   = $("canvas-wrapper");
  const canvas          = $("gen-canvas");
  const downloadLinks   = $("download-links");
  const downloadButtons = $("download-buttons");

  /* ── Step 1: Get meta data from the active tab ─── */
  let metaData = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) throw new Error("No active tab found.");
    if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
      throw new Error("Cannot read meta data from this page.");
    }

    // Ensure content script is injected (handles cases where it wasn't auto-injected)
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    }).catch((_err) => {/* already injected – safe to ignore */});

    const response = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, { action: "GET_META_DATA" }, (res) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(res);
        }
      });
    });

    if (!response || !response.success) throw new Error("Failed to read page meta data.");
    metaData = response.data;
  } catch (err) {
    hide(loadingEl);
    show(errorEl);
    errorMsgEl.textContent = err.message || "Unable to read page meta data.";
    return;
  }

  /* ── Step 2: Populate UI ─── */
  hide(loadingEl);
  show(mainEl);

  // --- Status card ---
  const imageUrl = metaData.ogImage || metaData.twitterImage || "";
  if (imageUrl) {
    statusBadge.className = "status-badge status-found";
    statusIcon.textContent = "✓";
    statusText.textContent = "Meta image found";

    existingImg.src = imageUrl;
    metaSource.textContent = metaData.ogImage ? "og:image" : "twitter:image";
    const dims = metaData.ogImageWidth && metaData.ogImageHeight
      ? `${metaData.ogImageWidth} × ${metaData.ogImageHeight}`
      : "—";
    metaDimensions.textContent = dims;
    show(existingPreview);
  } else {
    statusBadge.className = "status-badge status-missing";
    statusIcon.textContent = "✗";
    statusText.textContent = "No meta image found";
  }

  // --- Page meta summary ---
  const displayTitle = metaData.ogTitle || metaData.twitterTitle || metaData.metaTitle || "—";
  const displayDesc  = metaData.ogDescription || metaData.twitterDescription || metaData.metaDescription || "—";

  pgTitle.textContent   = truncate(displayTitle, 80)  || "—";
  pgDesc.textContent    = truncate(displayDesc, 120)  || "—";
  pgDomain.textContent  = metaData.pageDomain         || "—";
  pgType.textContent    = metaData.ogType             || "—";
  pgTwitter.textContent = metaData.twitterCard        || "—";

  // --- Pre-fill generator with page data ---
  genTitle.value  = truncate(displayTitle !== "—" ? displayTitle : "", 80);
  genDesc.value   = truncate(displayDesc  !== "—" ? displayDesc  : "", 120);
  genDomain.value = metaData.pageDomain || "";

  // Update char counters
  titleCount.textContent = genTitle.value.length;
  descCount.textContent  = genDesc.value.length;

  /* ── Step 3: Wire up generator controls ─── */

  // Template → show/hide custom colour picker
  templateSelect.addEventListener("change", () => {
    colorGroup.style.display = templateSelect.value === "branded" ? "block" : "none";
  });

  // Colour picker ↔ hex input sync
  bgColor.addEventListener("input", () => {
    bgColorHex.value = bgColor.value;
  });
  bgColorHex.addEventListener("input", () => {
    if (/^#[0-9a-fA-F]{6}$/.test(bgColorHex.value)) {
      bgColor.value = bgColorHex.value;
    }
  });

  // Char counters
  genTitle.addEventListener("input", () => { titleCount.textContent = genTitle.value.length; });
  genDesc.addEventListener("input",  () => { descCount.textContent  = genDesc.value.length; });

  /* ── Step 4: Preview & Generate ─── */

  function getSelectedFormat() {
    return document.querySelector('input[name="img-format"]:checked')?.value || "png";
  }

  function getOpts() {
    return {
      templateKey: templateSelect.value,
      title: genTitle.value.trim(),
      description: genDesc.value.trim(),
      domain: genDomain.value.trim(),
      customBg: bgColor.value,
    };
  }

  function renderCanvas() {
    const { w, h } = parseResolution(resolutionSelect.value);
    canvas.width  = w;
    canvas.height = h;
    paintImage(canvas, getOpts());
    show(canvasWrapper);
  }

  btnPreview.addEventListener("click", () => {
    renderCanvas();
    hide(downloadLinks);
  });

  btnGenerate.addEventListener("click", () => {
    renderCanvas();

    // Build download buttons for all three formats
    downloadButtons.innerHTML = "";
    const format   = getSelectedFormat();
    // Sanitize domain to produce a safe filename (replace characters invalid on most OSes)
    const safeDomain = (genDomain.value.trim() || "social-preview").replace(/[/\\:*?"<>|]+/g, "-");
    const filename = safeDomain + "-og-image";

    // Offer the selected format as primary, plus the others as alternatives
    const formats = [format, ...["png", "jpeg", "webp"].filter(f => f !== format)];
    for (const fmt of formats) {
      downloadButtons.appendChild(makeDownloadLink(canvas, fmt, filename));
    }

    show(downloadLinks);
  });
});
