/**
 * popup.js
 *
 * Handles:
 *  1. Reading page meta data and visual hints from the active tab
 *  2. Auditing social preview tags and image dimensions for common platforms
 *  3. Rendering a configurable social image with 10+ design templates
 *  4. Opening royalty-free image searches and exporting generated assets
 */

function show(el) { el.classList.remove("hidden"); }
function hide(el) { el.classList.add("hidden"); }
function $(id) { return document.getElementById(id); }

function truncate(str, maxLen) {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen - 1) + "…" : str;
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines;
}

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

function parseResolution(value) {
  const [w, h] = String(value || "1200x630").split("x").map(Number);
  return { w: w || 1200, h: h || 630 };
}

function makeDownloadLink(canvas, format, filename) {
  const mimeMap = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };
  const extMap = { png: "png", jpeg: "jpg", webp: "webp" };
  const mime = mimeMap[format] || "image/png";
  const ext = extMap[format] || "png";
  const quality = format === "jpeg" ? 0.92 : undefined;
  const dataUrl = canvas.toDataURL(mime, quality);

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${filename}.${ext}`;
  link.className = "download-btn";
  link.textContent = `↓ ${ext.toUpperCase()}`;
  return link;
}

function rgbStringToHex(value) {
  const match = String(value || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return "";
  const [, r, g, b] = match;
  return `#${[r, g, b].map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`;
}

function normalizeColor(value) {
  if (!value || value === "transparent" || value === "rgba(0, 0, 0, 0)") return "";
  const probe = document.createElement("span");
  probe.style.color = value;
  document.body.appendChild(probe);
  const computed = window.getComputedStyle(probe).color;
  probe.remove();
  return rgbStringToHex(computed);
}

function hexToRgb(hex) {
  const normalized = String(hex || "").replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function mixHex(a, b, weight) {
  const first = hexToRgb(a);
  const second = hexToRgb(b);
  if (!first) return b;
  if (!second) return a;
  const t = Math.max(0, Math.min(1, weight));
  const r = Math.round(first.r + (second.r - first.r) * t);
  const g = Math.round(first.g + (second.g - first.g) * t);
  const blue = Math.round(first.b + (second.b - first.b) * t);
  return `#${[r, g, blue].map((part) => part.toString(16).padStart(2, "0")).join("")}`;
}

function getRelativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channels = [rgb.r, rgb.g, rgb.b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function isLightColor(hex) {
  return getRelativeLuminance(hex) > 0.6;
}

function pickFirstColor(candidates, fallback) {
  for (const candidate of candidates) {
    const color = normalizeColor(candidate);
    if (color) return color;
  }
  return fallback;
}

function parseDimension(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function buildBrandProfile(metaData) {
  const hints = metaData.colorHints || {};
  const primary = pickFirstColor([
    hints.theme,
    hints.accentBackground,
    hints.accent,
    hints.headerBackground,
  ], "#1a73e8");

  let secondary = pickFirstColor([
    hints.headerBackground,
    hints.accent,
    hints.background,
  ], mixHex(primary, "#0f172a", 0.4));

  if (secondary === primary) {
    secondary = mixHex(primary, isLightColor(primary) ? "#0f172a" : "#ffffff", 0.35);
  }

  const background = pickFirstColor([hints.background], mixHex(primary, "#ffffff", 0.86));
  const text = pickFirstColor([hints.text], isLightColor(background) ? "#111827" : "#ffffff");

  return {
    primary,
    secondary,
    background,
    text,
    logoUrl: metaData.brandImageUrl || metaData.faviconUrl || "",
    faviconUrl: metaData.faviconUrl || "",
    palette: [primary, secondary, background],
  };
}

async function loadCanvasImage(url) {
  let objectUrl = url;
  let revoke = false;

  if (!/^data:|^blob:/i.test(url)) {
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) throw new Error("Source is not an image.");
    objectUrl = URL.createObjectURL(blob);
    revoke = true;
  }

  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Image failed to load."));
      image.src = objectUrl;
    });

    return {
      img,
      cleanup() {
        if (revoke) URL.revokeObjectURL(objectUrl);
      },
    };
  } catch (err) {
    if (revoke) URL.revokeObjectURL(objectUrl);
    throw err;
  }
}

async function tryLoadImage(url, label, warnings) {
  if (!url) return null;
  try {
    return await loadCanvasImage(url);
  } catch (_err) {
    warnings.push(`${label} could not be loaded from the selected source.`);
    return null;
  }
}

function drawImageCover(ctx, img, x, y, width, height) {
  const ratio = Math.max(width / img.width, height / img.height);
  const drawWidth = img.width * ratio;
  const drawHeight = img.height * ratio;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;
  ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
}

function drawImageContain(ctx, img, x, y, width, height) {
  const ratio = Math.min(width / img.width, height / img.height);
  const drawWidth = img.width * ratio;
  const drawHeight = img.height * ratio;
  const dx = x + (width - drawWidth) / 2;
  const dy = y + (height - drawHeight) / 2;
  ctx.drawImage(img, dx, dy, drawWidth, drawHeight);
}

const TEMPLATE_DEFS = [
  { key: "page-brand", label: "Auto Brand", preview: "linear-gradient(135deg, #1a73e8 0%, #1557b0 45%, #0f172a 100%)" },
  { key: "gradient-blue", label: "Ocean Blue", preview: "linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%)" },
  { key: "gradient-purple", label: "Velvet Purple", preview: "linear-gradient(135deg, #7c3aed 0%, #3b0764 100%)" },
  { key: "gradient-green", label: "Emerald", preview: "linear-gradient(135deg, #10b981 0%, #064e3b 100%)" },
  { key: "gradient-orange", label: "Amber Flame", preview: "linear-gradient(135deg, #fb923c 0%, #7c2d12 100%)" },
  { key: "gradient-rose", label: "Rose Burst", preview: "linear-gradient(135deg, #fb7185 0%, #881337 100%)" },
  { key: "gradient-teal", label: "Teal Depth", preview: "linear-gradient(135deg, #14b8a6 0%, #134e4a 100%)" },
  { key: "gradient-indigo", label: "Indigo Night", preview: "linear-gradient(135deg, #6366f1 0%, #312e81 100%)" },
  { key: "gradient-sunrise", label: "Sunrise", preview: "linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)" },
  { key: "dark", label: "Dark Pro", preview: "linear-gradient(135deg, #111827 0%, #27272a 100%)" },
  { key: "light", label: "Light Clean", preview: "linear-gradient(135deg, #ffffff 0%, #e5e7eb 100%)" },
  { key: "branded", label: "Custom Brand", preview: "linear-gradient(135deg, #2563eb 0%, #0f172a 100%)" },
];

const LAYOUT_DEFS = [
  { key: "split-right", label: "Split Right" },
  { key: "split-left", label: "Split Left" },
  { key: "stacked", label: "Stacked Story" },
  { key: "framed", label: "Framed Focus" },
  { key: "spotlight", label: "Spotlight Banner" },
];

const TEMPLATES = {
  "page-brand": {
    bg(ctx, w, h, opts) {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, mixHex(opts.branding.primary, "#ffffff", 0.12));
      gradient.addColorStop(0.55, opts.branding.primary);
      gradient.addColorStop(1, opts.branding.secondary);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    },
  },
  "gradient-blue": {
    bg(ctx, w, h) {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, "#1a73e8");
      gradient.addColorStop(1, "#0d47a1");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    },
  },
  "gradient-purple": {
    bg(ctx, w, h) {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, "#7c3aed");
      gradient.addColorStop(1, "#3b0764");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    },
  },
  "gradient-green": {
    bg(ctx, w, h) {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, "#10b981");
      gradient.addColorStop(1, "#064e3b");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    },
  },
  "gradient-orange": {
    bg(ctx, w, h) {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, "#fb923c");
      gradient.addColorStop(1, "#7c2d12");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    },
  },
  "gradient-rose": {
    bg(ctx, w, h) {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, "#fb7185");
      gradient.addColorStop(1, "#881337");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    },
  },
  "gradient-teal": {
    bg(ctx, w, h) {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, "#14b8a6");
      gradient.addColorStop(1, "#134e4a");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    },
  },
  "gradient-indigo": {
    bg(ctx, w, h) {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, "#6366f1");
      gradient.addColorStop(1, "#312e81");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    },
  },
  "gradient-sunrise": {
    bg(ctx, w, h) {
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, "#f59e0b");
      gradient.addColorStop(1, "#ec4899");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    },
  },
  dark: {
    bg(ctx, w, h) {
      ctx.fillStyle = "#18181b";
      ctx.fillRect(0, 0, w, h);
    },
  },
  light: {
    bg(ctx, w, h) {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, w, h);
      const gradient = ctx.createLinearGradient(0, 0, w, 0);
      gradient.addColorStop(0, "#1a73e8");
      gradient.addColorStop(1, "#7c3aed");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, 10);
    },
  },
  branded: {
    bg(ctx, w, h, opts) {
      const primary = opts.customBg || opts.branding.primary || "#1a73e8";
      const secondary = mixHex(primary, "#0f172a", 0.45);
      const gradient = ctx.createLinearGradient(0, 0, w, h);
      gradient.addColorStop(0, primary);
      gradient.addColorStop(1, secondary);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    },
  },
};

function resolveTemplateTextColors(templateKey, branding, customBg) {
  if (templateKey === "light") {
    return {
      textColor: "#111827",
      subTextColor: "rgba(17,24,39,0.75)",
      accentColor: "rgba(17,24,39,0.08)",
      domainColor: "rgba(17,24,39,0.72)",
      logoBadge: "rgba(17,24,39,0.06)",
      textShadow: "rgba(255,255,255,0.5)",
      panelFill: "rgba(255,255,255,0.72)",
      panelStroke: "rgba(255,255,255,0.82)",
    };
  }

  const base = templateKey === "branded" ? (customBg || branding.primary) : branding.primary;
  const light = isLightColor(base);
  return {
    textColor: light ? "#111827" : "#ffffff",
    subTextColor: light ? "rgba(17,24,39,0.75)" : "rgba(255,255,255,0.82)",
    accentColor: light ? "rgba(17,24,39,0.08)" : "rgba(255,255,255,0.18)",
    domainColor: light ? "rgba(17,24,39,0.72)" : "rgba(255,255,255,0.78)",
    logoBadge: light ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.92)",
    textShadow: light ? "rgba(255,255,255,0.42)" : "rgba(15,23,42,0.55)",
    panelFill: light ? "rgba(255,255,255,0.7)" : "rgba(15,23,42,0.34)",
    panelStroke: light ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.14)",
  };
}

function compareRatio(width, height, targetWidth, targetHeight) {
  if (!width || !height) return { ratioMatch: false, sizeMatch: false, diff: Number.POSITIVE_INFINITY };
  const current = width / height;
  const target = targetWidth / targetHeight;
  const diff = Math.abs(current - target);
  return {
    ratioMatch: diff <= 0.02,
    sizeMatch: width >= targetWidth && height >= targetHeight,
    diff,
  };
}

async function inferImageDimensions(imageUrl, fallbackWidth, fallbackHeight) {
  const fallback = {
    width: parseDimension(fallbackWidth),
    height: parseDimension(fallbackHeight),
    source: parseDimension(fallbackWidth) && parseDimension(fallbackHeight) ? "meta tags" : "unknown",
  };

  if (!imageUrl) return fallback;

  try {
    const asset = await loadCanvasImage(imageUrl);
    try {
      return {
        width: asset.img.naturalWidth || asset.img.width || fallback.width,
        height: asset.img.naturalHeight || asset.img.height || fallback.height,
        source: "loaded image",
      };
    } finally {
      asset.cleanup();
    }
  } catch (_err) {
    return fallback;
  }
}

function makeAuditCard(title, status, note) {
  const card = document.createElement("div");
  card.className = "audit-card";

  const head = document.createElement("div");
  head.className = "audit-card-head";

  const label = document.createElement("div");
  label.className = "audit-title";
  label.textContent = title;

  const badge = document.createElement("span");
  badge.className = `audit-status audit-status-${status}`;
  badge.textContent = status === "ok" ? "Ready" : status === "warn" ? "Partial" : "Missing";

  const body = document.createElement("p");
  body.className = "audit-note";
  body.textContent = note;

  head.appendChild(label);
  head.appendChild(badge);
  card.appendChild(head);
  card.appendChild(body);
  return card;
}

function applyTextStyle(ctx, color, shadowColor) {
  ctx.fillStyle = color;
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;
}

function clearTextStyle(ctx) {
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function drawDomainIdentity(ctx, area, domain, fontSize, theme, logoAsset) {
  if (!domain) return;

  ctx.save();
  ctx.font = `600 ${fontSize}px "Google Sans", "Segoe UI", Roboto, Arial, sans-serif`;
  const iconSize = logoAsset ? Math.max(18, fontSize + 2) : 0;
  const gap = logoAsset ? 10 : 0;
  const textW = ctx.measureText(domain).width;
  const pillH = fontSize + 22;
  const pillW = textW + 34 + iconSize + gap;
  const pillX = area.x;
  const pillY = area.y + area.h - pillH;

  ctx.fillStyle = theme.panelFill;
  ctx.strokeStyle = theme.panelStroke;
  ctx.lineWidth = 1;
  roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.stroke();

  let contentX = pillX + 16;
  if (logoAsset) {
    ctx.fillStyle = theme.logoBadge;
    roundRect(ctx, contentX, pillY + (pillH - iconSize) / 2, iconSize, iconSize, iconSize / 2);
    ctx.fill();
    drawImageContain(ctx, logoAsset.img, contentX + 3, pillY + (pillH - iconSize) / 2 + 3, iconSize - 6, iconSize - 6);
    contentX += iconSize + gap;
  }

  applyTextStyle(ctx, theme.domainColor, theme.textShadow);
  ctx.textBaseline = "middle";
  ctx.fillText(domain, contentX, pillY + pillH / 2);
  clearTextStyle(ctx);
  ctx.restore();
}

async function paintImage(canvas, opts) {
  const warnings = [];
  const tpl = TEMPLATES[opts.templateKey] || TEMPLATES["page-brand"];
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const PAD = Math.round(W * 0.07);
  const theme = resolveTemplateTextColors(opts.templateKey, opts.branding, opts.customBg);
  const layoutKey = opts.layoutKey || "split-right";

  const logoUrl = opts.includeLogo && opts.logoUrl ? opts.logoUrl : "";
  const [heroAsset, logoAsset] = await Promise.all([
    tryLoadImage(opts.heroImageUrl, "Selected image", warnings),
    tryLoadImage(logoUrl, "Brand image", warnings),
  ]);

  try {
    tpl.bg(ctx, W, H, opts);

    const wash = ctx.createRadialGradient(W * 0.18, H * 0.14, 10, W * 0.18, H * 0.14, W * 0.55);
    wash.addColorStop(0, "rgba(255,255,255,0.18)");
    wash.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = theme.accentColor;
    ctx.beginPath();
    ctx.arc(W * 1.02, H * 1.02, H * 0.54, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-W * 0.05, -H * 0.04, H * 0.25, 0, Math.PI * 2);
    ctx.fill();

    const baseArea = { x: PAD, y: PAD, w: W - PAD * 2, h: H - PAD * 2 };
    const textArea = { ...baseArea };
    const titleFontSize = Math.round(H * (layoutKey === "stacked" ? 0.09 : 0.096));
    const descFontSize = Math.round(H * 0.046);
    const domainFontSize = Math.round(H * 0.039);
    const gap = Math.round(H * 0.042);

    if (layoutKey === "split-right" && heroAsset) {
      const panelW = Math.round(W * 0.29);
      const panelX = W - PAD - panelW;
      ctx.save();
      roundRect(ctx, panelX, PAD, panelW, H - PAD * 2, 26);
      ctx.clip();
      drawImageCover(ctx, heroAsset.img, panelX, PAD, panelW, H - PAD * 2);
      if (opts.useGradientOverlay) {
        const imageWash = ctx.createLinearGradient(panelX, 0, panelX + panelW, 0);
        imageWash.addColorStop(0, "rgba(15,23,42,0.18)");
        imageWash.addColorStop(1, "rgba(15,23,42,0.46)");
        ctx.fillStyle = imageWash;
        ctx.fillRect(panelX, PAD, panelW, H - PAD * 2);
      }
      ctx.restore();
      textArea.w = panelX - PAD - 26;
    } else if (layoutKey === "split-left" && heroAsset) {
      const panelW = Math.round(W * 0.29);
      const panelX = PAD;
      ctx.save();
      roundRect(ctx, panelX, PAD, panelW, H - PAD * 2, 26);
      ctx.clip();
      drawImageCover(ctx, heroAsset.img, panelX, PAD, panelW, H - PAD * 2);
      if (opts.useGradientOverlay) {
        const imageWash = ctx.createLinearGradient(panelX, 0, panelX + panelW, 0);
        imageWash.addColorStop(0, "rgba(15,23,42,0.46)");
        imageWash.addColorStop(1, "rgba(15,23,42,0.18)");
        ctx.fillStyle = imageWash;
        ctx.fillRect(panelX, PAD, panelW, H - PAD * 2);
      }
      ctx.restore();
      textArea.x = panelX + panelW + 26;
      textArea.w = W - textArea.x - PAD;
    } else if (layoutKey === "stacked") {
      if (heroAsset) {
        ctx.save();
        roundRect(ctx, PAD, PAD, W - PAD * 2, H - PAD * 2, 30);
        ctx.clip();
        drawImageCover(ctx, heroAsset.img, PAD, PAD, W - PAD * 2, H - PAD * 2);
        const stackedWash = ctx.createLinearGradient(0, 0, 0, H);
        stackedWash.addColorStop(0, opts.useGradientOverlay ? "rgba(15,23,42,0.18)" : "rgba(15,23,42,0.08)");
        stackedWash.addColorStop(0.55, opts.useGradientOverlay ? "rgba(15,23,42,0.28)" : "rgba(15,23,42,0.14)");
        stackedWash.addColorStop(1, "rgba(15,23,42,0.72)");
        ctx.fillStyle = stackedWash;
        ctx.fillRect(PAD, PAD, W - PAD * 2, H - PAD * 2);
        ctx.restore();
      }
      textArea.x = PAD + 24;
      textArea.y = H * 0.18;
      textArea.w = W - PAD * 2 - 48;
      textArea.h = H - textArea.y - PAD - 14;
    } else if (layoutKey === "framed") {
      if (heroAsset) {
        drawImageCover(ctx, heroAsset.img, 0, 0, W, H);
      }
      const scrim = ctx.createLinearGradient(0, 0, W, H);
      scrim.addColorStop(0, heroAsset ? "rgba(15,23,42,0.58)" : "rgba(15,23,42,0.18)");
      scrim.addColorStop(1, heroAsset ? "rgba(15,23,42,0.34)" : "rgba(15,23,42,0.08)");
      ctx.fillStyle = scrim;
      ctx.fillRect(0, 0, W, H);

      textArea.x = Math.round(W * 0.08);
      textArea.y = Math.round(H * 0.14);
      textArea.w = Math.round(W * 0.6);
      textArea.h = Math.round(H * 0.72);

      ctx.fillStyle = theme.panelFill;
      ctx.strokeStyle = theme.panelStroke;
      ctx.lineWidth = 1;
      roundRect(ctx, textArea.x, textArea.y, textArea.w, textArea.h, 28);
      ctx.fill();
      ctx.stroke();

      textArea.x += 28;
      textArea.y += 28;
      textArea.w -= 56;
      textArea.h -= 56;
    } else if (layoutKey === "spotlight") {
      if (heroAsset) {
        const stripY = Math.round(H * 0.56);
        const stripH = H - stripY - PAD;
        ctx.save();
        roundRect(ctx, PAD, stripY, W - PAD * 2, stripH, 24);
        ctx.clip();
        drawImageCover(ctx, heroAsset.img, PAD, stripY, W - PAD * 2, stripH);
        const bannerWash = ctx.createLinearGradient(0, stripY, 0, H);
        bannerWash.addColorStop(0, "rgba(15,23,42,0.12)");
        bannerWash.addColorStop(1, "rgba(15,23,42,0.5)");
        ctx.fillStyle = bannerWash;
        ctx.fillRect(PAD, stripY, W - PAD * 2, stripH);
        ctx.restore();
      }
      textArea.h = Math.round(H * 0.42);
    }

    const maxTextWidth = Math.max(240, textArea.w);
    ctx.textBaseline = "top";
    ctx.font = `700 ${titleFontSize}px "Google Sans", "Segoe UI", Roboto, Arial, sans-serif`;
    const titleLines = wrapText(ctx, opts.title || "Untitled", maxTextWidth).slice(0, layoutKey === "stacked" ? 3 : 2);
    const titleLineH = titleFontSize * 1.13;

    ctx.font = `400 ${descFontSize}px "Google Sans", "Segoe UI", Roboto, Arial, sans-serif`;
    const descLines = wrapText(ctx, opts.description || "", maxTextWidth).slice(0, layoutKey === "stacked" ? 2 : 3);
    const descLineH = descFontSize * 1.45;
    const domainReserved = domainFontSize + 32;
    const totalTextH = titleLines.length * titleLineH + (descLines.length ? gap + descLines.length * descLineH : 0);
    let y = textArea.y;

    if (layoutKey === "split-right" || layoutKey === "split-left") {
      y = Math.max(textArea.y + 12, Math.round(textArea.y + (textArea.h - domainReserved - totalTextH) / 2));
    } else if (layoutKey === "stacked") {
      y = textArea.y + Math.max(0, textArea.h - domainReserved - totalTextH - 26);
    } else if (layoutKey === "framed") {
      y = textArea.y + 4;
    } else if (layoutKey === "spotlight") {
      y = textArea.y + 8;
    }

    applyTextStyle(ctx, theme.textColor, theme.textShadow);
    ctx.font = `700 ${titleFontSize}px "Google Sans", "Segoe UI", Roboto, Arial, sans-serif`;
    for (const line of titleLines) {
      ctx.fillText(line, textArea.x, y);
      y += titleLineH;
    }

    if (descLines.length) {
      y += gap;
      applyTextStyle(ctx, theme.subTextColor, theme.textShadow);
      ctx.font = `400 ${descFontSize}px "Google Sans", "Segoe UI", Roboto, Arial, sans-serif`;
      for (const line of descLines) {
        ctx.fillText(line, textArea.x, y);
        y += descLineH;
      }
    }

    clearTextStyle(ctx);

    drawDomainIdentity(ctx, textArea, opts.domain, domainFontSize, theme, logoAsset);

    if (opts.templateKey === "page-brand") {
      const stripY = H - 8;
      const segment = W / opts.branding.palette.length;
      opts.branding.palette.forEach((color, index) => {
        ctx.fillStyle = color;
        ctx.fillRect(segment * index, stripY, Math.ceil(segment), 8);
      });
    }
  } finally {
    if (heroAsset) heroAsset.cleanup();
    if (logoAsset) logoAsset.cleanup();
  }

  return { warnings };
}

document.addEventListener("DOMContentLoaded", async () => {
  const loadingEl = $("loading");
  const errorEl = $("error-state");
  const errorMsgEl = $("error-message");
  const mainEl = $("main-content");

  const statusBadge = $("status-badge");
  const statusIcon = $("status-icon");
  const statusText = $("status-text");
  const existingPreview = $("existing-preview");
  const existingImg = $("existing-img");
  const metaSource = $("meta-source");
  const metaDimensions = $("meta-dimensions");
  const metaRatioCheck = $("meta-ratio-check");

  const pgTitle = $("pg-title");
  const pgDesc = $("pg-desc");
  const pgDomain = $("pg-domain");
  const pgType = $("pg-type");
  const pgTwitter = $("pg-twitter");

  const platformAuditGrid = $("platform-audit-grid");
  const dimensionAuditGrid = $("dimension-audit-grid");

  const studioPanel = $("studio-panel");
  const detailsPanel = $("details-panel");
  const tabButtons = [$("tab-studio"), $("tab-details")];

  const brandSummary = $("brand-summary");
  const brandMediaWrap = $("brand-media-wrap");
  const brandPreview = $("brand-preview");
  const brandSource = $("brand-source");
  const paletteChips = $("palette-chips");

  const templateGrid = $("template-grid");
  const templateSelect = $("template-select");
  const layoutGrid = $("layout-grid");
  const layoutSelect = $("layout-select");
  const colorGroup = $("color-group");
  const bgColor = $("bg-color");
  const bgColorHex = $("bg-color-hex");
  const heroImageSelect = $("hero-image-select");
  const heroImageUrlGroup = $("hero-image-url-group");
  const heroImageUrl = $("hero-image-url");
  const useBrandImage = $("use-brand-image");
  const useGradientOverlay = $("use-gradient-overlay");

  const genTitle = $("gen-title");
  const titleCount = $("title-count");
  const genDesc = $("gen-desc");
  const descCount = $("desc-count");
  const genDomain = $("gen-domain");
  const resolutionSelect = $("resolution-select");
  const btnPreview = $("btn-preview");
  const btnGenerate = $("btn-generate");

  const canvasWrapper = $("canvas-wrapper");
  const canvas = $("gen-canvas");
  const renderMessage = $("render-message");
  const downloadLinks = $("download-links");
  const downloadButtons = $("download-buttons");

  function setRenderMessage(message) {
    if (!message) {
      hide(renderMessage);
      renderMessage.textContent = "";
      return;
    }
    renderMessage.textContent = message;
    show(renderMessage);
  }

  function setBusy(isBusy, previewLabel) {
    btnPreview.disabled = isBusy;
    btnGenerate.disabled = isBusy;
    btnPreview.textContent = isBusy && previewLabel ? previewLabel : "Preview";
    btnGenerate.textContent = isBusy ? "Rendering…" : "Generate & Download";
  }

  let metaData;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) throw new Error("No active tab found.");
    if (!tab.url || tab.url.startsWith("chrome://") || tab.url.startsWith("chrome-extension://")) {
      throw new Error("Cannot read meta data from this page.");
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    }).catch(() => undefined);

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

  const brandProfile = buildBrandProfile(metaData);
  const imageUrl = metaData.ogImage || metaData.twitterImage || "";
  const existingDimensions = await inferImageDimensions(imageUrl, metaData.ogImageWidth, metaData.ogImageHeight);
  const displayTitle = metaData.ogTitle || metaData.twitterTitle || metaData.metaTitle || "—";
  const displayDesc = metaData.ogDescription || metaData.twitterDescription || metaData.metaDescription || "—";

  hide(loadingEl);
  show(mainEl);

  function renderTemplateCards() {
    templateGrid.innerHTML = "";
    TEMPLATE_DEFS.forEach((template) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "template-card";
      card.dataset.templateKey = template.key;
      card.setAttribute("aria-pressed", String(templateSelect.value === template.key));

      const preview = document.createElement("div");
      preview.className = "template-card-preview";
      preview.style.background = template.key === "page-brand"
        ? `linear-gradient(135deg, ${brandProfile.primary} 0%, ${brandProfile.secondary} 100%)`
        : template.key === "branded"
          ? `linear-gradient(135deg, ${bgColor.value} 0%, ${mixHex(bgColor.value, "#0f172a", 0.45)} 100%)`
          : template.preview;

      const name = document.createElement("div");
      name.className = "template-card-name";
      name.textContent = template.label;

      card.appendChild(preview);
      card.appendChild(name);
      card.addEventListener("click", () => {
        templateSelect.value = template.key;
        syncControls();
      });
      templateGrid.appendChild(card);
    });
  }

  function updateSelectedTemplateCard() {
    templateGrid.querySelectorAll(".template-card").forEach((card) => {
      const selected = card.dataset.templateKey === templateSelect.value;
      card.classList.toggle("is-selected", selected);
      card.setAttribute("aria-pressed", String(selected));
    });
  }

  function renderLayoutCards() {
    layoutGrid.innerHTML = "";
    LAYOUT_DEFS.forEach((layout) => {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "layout-card";
      card.dataset.layoutKey = layout.key;
      card.setAttribute("aria-pressed", String(layoutSelect.value === layout.key));

      const preview = document.createElement("div");
      preview.className = "layout-card-preview";

      const name = document.createElement("div");
      name.className = "layout-card-name";
      name.textContent = layout.label;

      card.appendChild(preview);
      card.appendChild(name);
      card.addEventListener("click", () => {
        layoutSelect.value = layout.key;
        updateSelectedLayoutCard();
      });
      layoutGrid.appendChild(card);
    });
  }

  function updateSelectedLayoutCard() {
    layoutGrid.querySelectorAll(".layout-card").forEach((card) => {
      const selected = card.dataset.layoutKey === layoutSelect.value;
      card.classList.toggle("is-selected", selected);
      card.setAttribute("aria-pressed", String(selected));
    });
  }

  function renderBrandSummary() {
    if (brandProfile.logoUrl || brandProfile.palette.length) {
      if (brandProfile.logoUrl) {
        brandMediaWrap.style.display = "flex";
        brandPreview.src = brandProfile.logoUrl;
        brandSource.textContent = metaData.brandImageUrl
          ? "Detected page logo or favicon will be used as a subtle brand mark in generated images."
          : "Detected favicon will be used as a subtle brand mark in generated images.";
      } else {
        brandMediaWrap.style.display = "none";
        brandSource.textContent = "No page logo was detected, but the page color scheme is available for the auto template.";
      }

      paletteChips.innerHTML = "";
      brandProfile.palette.forEach((color) => {
        const chip = document.createElement("span");
        chip.className = "palette-chip";

        const swatch = document.createElement("span");
        swatch.className = "palette-chip-swatch";
        swatch.style.background = color;

        chip.appendChild(swatch);
        chip.appendChild(document.createTextNode(color));
        paletteChips.appendChild(chip);
      });
      show(brandSummary);
    }
  }

  function renderExistingImageStatus() {
    if (!imageUrl) {
      statusBadge.className = "status-badge status-missing";
      statusIcon.textContent = "✗";
      statusText.textContent = "No meta image found";
      metaRatioCheck.textContent = "No image available for ratio checks.";
      return;
    }

    statusBadge.className = "status-badge status-found";
    statusIcon.textContent = "✓";
    statusText.textContent = "Meta image found";
    existingImg.src = imageUrl;
    metaSource.textContent = metaData.ogImage ? "og:image" : "twitter:image";

    if (existingDimensions.width && existingDimensions.height) {
      metaDimensions.textContent = `${existingDimensions.width} × ${existingDimensions.height} (${existingDimensions.source})`;
      const bestTarget = [
        { label: "OG / Meta", width: 1200, height: 630 },
        { label: "Facebook / LinkedIn", width: 1200, height: 628 },
        { label: "Twitter / X", width: 1024, height: 512 },
      ]
        .map((target) => ({ target, result: compareRatio(existingDimensions.width, existingDimensions.height, target.width, target.height) }))
        .sort((a, b) => a.result.diff - b.result.diff)[0];

      if (bestTarget.result.ratioMatch && bestTarget.result.sizeMatch) {
        metaRatioCheck.textContent = `Good fit for ${bestTarget.target.label}.`;
      } else if (bestTarget.result.ratioMatch) {
        metaRatioCheck.textContent = `Correct aspect ratio for ${bestTarget.target.label}, but smaller than the recommended size.`;
      } else {
        metaRatioCheck.textContent = `Closest to ${bestTarget.target.label}, but the aspect ratio is off.`;
      }
    } else {
      metaDimensions.textContent = "—";
      metaRatioCheck.textContent = "Dimensions could not be verified.";
    }

    show(existingPreview);
  }

  function renderPlatformAudit() {
    platformAuditGrid.innerHTML = "";
    const checks = [
      {
        title: "OG / Meta",
        status: metaData.ogTitle && metaData.ogDescription && metaData.ogImage ? "ok" : (metaData.ogTitle || metaData.ogDescription || metaData.ogImage ? "warn" : "missing"),
        note: metaData.ogTitle && metaData.ogDescription && metaData.ogImage
          ? "og:title, og:description, and og:image are present."
          : "Expected og:title, og:description, and og:image for a complete Open Graph preview.",
      },
      {
        title: "Twitter / X",
        status: metaData.twitterCard && metaData.twitterTitle && metaData.twitterImage ? "ok" : (metaData.twitterCard || metaData.twitterTitle || metaData.twitterImage ? "warn" : "missing"),
        note: metaData.twitterCard && metaData.twitterTitle && metaData.twitterImage
          ? "Dedicated Twitter / X card tags are present."
          : "Expected twitter:card, twitter:title, and twitter:image for a dedicated Twitter / X preview.",
      },
      {
        title: "Facebook",
        status: metaData.ogTitle && metaData.ogDescription && metaData.ogImage && metaData.ogUrl ? "ok" : (metaData.ogTitle || metaData.ogDescription || metaData.ogImage ? "warn" : "missing"),
        note: metaData.ogTitle && metaData.ogDescription && metaData.ogImage && metaData.ogUrl
          ? "Open Graph tags required by Facebook are present."
          : "Facebook relies on Open Graph tags, and og:url is also recommended.",
      },
      {
        title: "LinkedIn",
        status: metaData.ogTitle && metaData.ogDescription && metaData.ogImage ? "ok" : (metaData.ogTitle || metaData.ogDescription || metaData.ogImage ? "warn" : "missing"),
        note: metaData.ogTitle && metaData.ogDescription && metaData.ogImage
          ? "LinkedIn should be able to build a social preview from the page tags."
          : "LinkedIn primarily reads Open Graph tags, so title, description, and image should all be present.",
      },
    ];

    checks.forEach((item) => {
      platformAuditGrid.appendChild(makeAuditCard(item.title, item.status, item.note));
    });
  }

  function renderDimensionAudit() {
    dimensionAuditGrid.innerHTML = "";
    const targets = [
      { title: "OG / Meta", width: 1200, height: 630 },
      { title: "Facebook / LinkedIn", width: 1200, height: 628 },
      { title: "Twitter / X", width: 1024, height: 512 },
      { title: "Compact OG", width: 800, height: 418 },
      { title: "Minimum OG", width: 600, height: 314 },
    ];

    if (!existingDimensions.width || !existingDimensions.height) {
      dimensionAuditGrid.appendChild(makeAuditCard("Image Dimensions", "missing", "No image dimensions were available to compare against common social-preview aspect ratios."));
      return;
    }

    targets.forEach((target) => {
      const result = compareRatio(existingDimensions.width, existingDimensions.height, target.width, target.height);
      let status = "missing";
      let note = `Current image is ${existingDimensions.width} × ${existingDimensions.height}.`;

      if (result.ratioMatch && result.sizeMatch) {
        status = "ok";
        note = `${existingDimensions.width} × ${existingDimensions.height} matches the expected ${target.width} × ${target.height} aspect ratio and meets the recommended size.`;
      } else if (result.ratioMatch) {
        status = "warn";
        note = `${existingDimensions.width} × ${existingDimensions.height} has the correct aspect ratio for ${target.width} × ${target.height}, but it is smaller than recommended.`;
      } else {
        status = "missing";
        note = `${existingDimensions.width} × ${existingDimensions.height} does not match the expected ${target.width}:${target.height} aspect ratio closely enough.`;
      }

      dimensionAuditGrid.appendChild(makeAuditCard(target.title, status, note));
    });
  }

  function activateTab(targetId) {
    const isStudio = targetId === "studio-panel";
    studioPanel.classList.toggle("hidden", !isStudio);
    detailsPanel.classList.toggle("hidden", isStudio);
    tabButtons.forEach((button) => {
      const active = button.dataset.tabTarget === targetId;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function syncControls() {
    colorGroup.style.display = templateSelect.value === "branded" ? "block" : "none";
    heroImageUrlGroup.classList.toggle("hidden", heroImageSelect.value !== "custom-url");
    if (templateSelect.value === "page-brand") {
      bgColor.value = brandProfile.primary;
      bgColorHex.value = brandProfile.primary;
    }
    renderTemplateCards();
    updateSelectedTemplateCard();
    renderLayoutCards();
    updateSelectedLayoutCard();
  }

  function resolveHeroImageUrl() {
    if (heroImageSelect.value === "page-meta-image") return imageUrl;
    if (heroImageSelect.value === "brand-image") return brandProfile.logoUrl;
    if (heroImageSelect.value === "custom-url") return heroImageUrl.value.trim();
    return "";
  }

  function getSelectedFormat() {
    return document.querySelector('input[name="img-format"]:checked')?.value || "png";
  }

  function getRenderOptions() {
    return {
      templateKey: templateSelect.value,
      layoutKey: layoutSelect.value,
      title: genTitle.value.trim(),
      description: genDesc.value.trim(),
      domain: genDomain.value.trim(),
      customBg: bgColor.value,
      branding: brandProfile,
      includeLogo: useBrandImage.checked,
      logoUrl: brandProfile.logoUrl,
      heroImageUrl: resolveHeroImageUrl(),
      useGradientOverlay: useGradientOverlay.checked,
    };
  }

  async function renderCanvas() {
    const { w, h } = parseResolution(resolutionSelect.value);
    canvas.width = w;
    canvas.height = h;
    const result = await paintImage(canvas, getRenderOptions());
    show(canvasWrapper);
    return result;
  }

  pgTitle.textContent = truncate(displayTitle, 80) || "—";
  pgDesc.textContent = truncate(displayDesc, 120) || "—";
  pgDomain.textContent = metaData.pageDomain || "—";
  pgType.textContent = metaData.ogType || "—";
  pgTwitter.textContent = metaData.twitterCard || "—";

  genTitle.value = truncate(displayTitle !== "—" ? displayTitle : "", 80);
  genDesc.value = truncate(displayDesc !== "—" ? displayDesc : "", 120);
  genDomain.value = metaData.pageDomain || "";
  titleCount.textContent = String(genTitle.value.length);
  descCount.textContent = String(genDesc.value.length);

  bgColor.value = brandProfile.primary;
  bgColorHex.value = brandProfile.primary;
  templateSelect.value = "page-brand";
  layoutSelect.value = "split-right";
  heroImageSelect.value = imageUrl ? "page-meta-image" : "none";
  useBrandImage.checked = Boolean(brandProfile.logoUrl);
  useBrandImage.disabled = !brandProfile.logoUrl;

  renderBrandSummary();
  renderExistingImageStatus();
  renderPlatformAudit();
  renderDimensionAudit();
  renderTemplateCards();
  renderLayoutCards();
  syncControls();
  activateTab("studio-panel");

  bgColor.addEventListener("input", () => {
    bgColorHex.value = bgColor.value;
    renderTemplateCards();
    updateSelectedTemplateCard();
  });

  bgColorHex.addEventListener("input", () => {
    if (/^#[0-9a-fA-F]{6}$/.test(bgColorHex.value)) {
      bgColor.value = bgColorHex.value;
      renderTemplateCards();
      updateSelectedTemplateCard();
    }
  });

  heroImageSelect.addEventListener("change", syncControls);
  templateSelect.addEventListener("change", syncControls);
  layoutSelect.addEventListener("change", updateSelectedLayoutCard);
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activateTab(button.dataset.tabTarget);
    });
  });

  genTitle.addEventListener("input", () => {
    titleCount.textContent = String(genTitle.value.length);
  });

  genDesc.addEventListener("input", () => {
    descCount.textContent = String(genDesc.value.length);
  });

  btnPreview.addEventListener("click", async () => {
    setBusy(true, "Rendering…");
    try {
      const result = await renderCanvas();
      hide(downloadLinks);
      setRenderMessage(result.warnings[0] || "Preview updated using the selected design.");
    } catch (err) {
      setRenderMessage(err.message || "Could not render the preview.");
    } finally {
      setBusy(false);
    }
  });

  btnGenerate.addEventListener("click", async () => {
    setBusy(true, "Rendering…");
    try {
      const result = await renderCanvas();
      downloadButtons.innerHTML = "";
      const format = getSelectedFormat();
      const safeDomain = (genDomain.value.trim() || "social-preview").replace(/[/\\:*?"<>|]+/g, "-");
      const filename = `${safeDomain}-og-image`;
      const formats = [format, ...["png", "jpeg", "webp"].filter((value) => value !== format)];
      formats.forEach((fmt) => {
        downloadButtons.appendChild(makeDownloadLink(canvas, fmt, filename));
      });
      show(downloadLinks);
      setRenderMessage(result.warnings[0] || "Image generated. Use the download buttons below.");
    } catch (err) {
      hide(downloadLinks);
      setRenderMessage(err.message || "Could not generate the image.");
    } finally {
      setBusy(false);
    }
  });
});