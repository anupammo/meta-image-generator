/**
 * content.js
 * Injected into every page to extract meta tag information.
 * Responds to messages from the popup asking for meta data.
 */

(function () {
  function absoluteUrl(value) {
    if (!value) return "";
    try {
      return new URL(value, window.location.href).href;
    } catch (_err) {
      return "";
    }
  }

  function firstContent(selectors, attribute = "content") {
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const value = el.getAttribute(attribute) || "";
      if (value) return value;
    }
    return "";
  }

  function collectColorHints() {
    const readColor = (selector, property) => {
      const el = document.querySelector(selector);
      if (!el) return "";
      const value = window.getComputedStyle(el)[property] || "";
      return value && value !== "rgba(0, 0, 0, 0)" ? value : "";
    };

    const bodyStyles = window.getComputedStyle(document.body);

    return {
      theme: firstContent(['meta[name="theme-color"]']),
      background: bodyStyles.backgroundColor || "",
      text: bodyStyles.color || "",
      accent: readColor("a, button, [role='button']", "color"),
      accentBackground: readColor("button, [role='button'], .btn, [class*='button']", "backgroundColor"),
      headerBackground: readColor("header, [role='banner'], nav", "backgroundColor"),
    };
  }

  function collectBrandImage() {
    const logoMeta = absoluteUrl(firstContent([
      'meta[property="og:logo"]',
      'meta[name="og:logo"]',
      'meta[itemprop="logo"]',
    ]));

    const favicon = absoluteUrl(firstContent([
      'link[rel="apple-touch-icon"]',
      'link[rel="mask-icon"]',
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
    ], "href"));

    const logoSelectors = [
      'header img[alt*="logo" i]',
      'img[alt*="logo" i]',
      'img[class*="logo" i]',
      'img[id*="logo" i]',
      'header a img',
      'nav a img',
    ];

    let pageLogo = "";
    for (const selector of logoSelectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const src = absoluteUrl(el.currentSrc || el.src || el.getAttribute("src"));
      if (src) {
        pageLogo = src;
        break;
      }
    }

    const candidates = [logoMeta, pageLogo, favicon].filter(Boolean);
    return {
      favicon,
      logo: logoMeta || pageLogo || favicon,
      candidates: [...new Set(candidates)],
    };
  }

  function collectKeywords() {
    const rawParts = [
      document.title,
      firstContent(['meta[name="description"]']),
      document.querySelector("h1")?.textContent || "",
      window.location.hostname.replace(/^www\./, "").replace(/\.[^.]+$/, ""),
    ];

    const stopWords = new Set([
      "the", "and", "for", "with", "from", "that", "this", "your", "have", "page",
      "home", "about", "into", "more", "best", "free", "online", "official", "site",
    ]);

    const seen = new Set();
    const keywords = [];
    for (const part of rawParts) {
      const words = String(part || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 2 && !stopWords.has(word));

      for (const word of words) {
        if (seen.has(word)) continue;
        seen.add(word);
        keywords.push(word);
        if (keywords.length >= 8) return keywords;
      }
    }

    return keywords;
  }

  /**
   * Extract all relevant meta/OG/Twitter tags from the current page.
   * @returns {Object} Collected meta data.
   */
  function collectMetaData() {
    const getMeta = (selector) => {
      const el = document.querySelector(selector);
      return el ? (el.getAttribute("content") || el.getAttribute("href") || "") : "";
    };

    const brandImage = collectBrandImage();

    return {
      // Open Graph
      ogTitle: getMeta('meta[property="og:title"]'),
      ogDescription: getMeta('meta[property="og:description"]'),
      ogImage: getMeta('meta[property="og:image"]'),
      ogImageWidth: getMeta('meta[property="og:image:width"]'),
      ogImageHeight: getMeta('meta[property="og:image:height"]'),
      ogUrl: getMeta('meta[property="og:url"]'),
      ogSiteName: getMeta('meta[property="og:site_name"]'),
      ogType: getMeta('meta[property="og:type"]'),

      // Twitter Card
      twitterCard: getMeta('meta[name="twitter:card"]'),
      twitterTitle: getMeta('meta[name="twitter:title"]'),
      twitterDescription: getMeta('meta[name="twitter:description"]'),
      twitterImage: getMeta('meta[name="twitter:image"]'),
      twitterSite: getMeta('meta[name="twitter:site"]'),

      // Standard meta
      metaTitle: document.title || "",
      metaDescription: getMeta('meta[name="description"]'),

      // Canonical / page URL
      canonicalUrl: getMeta('link[rel="canonical"]') || window.location.href,
      pageUrl: window.location.href,
      pageDomain: window.location.hostname,

      // Brand / visual hints
      faviconUrl: brandImage.favicon,
      brandImageUrl: brandImage.logo,
      brandImageCandidates: brandImage.candidates,
      colorHints: collectColorHints(),
      keywords: collectKeywords(),
    };
  }

  // Listen for messages from popup.js
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === "GET_META_DATA") {
      sendResponse({ success: true, data: collectMetaData() });
    }
    // Return true to keep the message channel open for async responses (not needed
    // here but good practice).
    return true;
  });
})();
