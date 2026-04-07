/**
 * content.js
 * Injected into every page to extract meta tag information.
 * Responds to messages from the popup asking for meta data.
 */

(function () {
  /**
   * Extract all relevant meta/OG/Twitter tags from the current page.
   * @returns {Object} Collected meta data.
   */
  function collectMetaData() {
    const getMeta = (selector) => {
      const el = document.querySelector(selector);
      return el ? (el.getAttribute("content") || el.getAttribute("href") || "") : "";
    };

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
