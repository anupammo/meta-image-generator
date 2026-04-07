# Meta Image Generator

A **Google Chrome Extension** that checks whether a webpage has a Meta / OG Image and lets you generate a professional social-preview image on the spot.

![Meta Image Generator UI](https://github.com/user-attachments/assets/595dc1c4-85cb-4499-90ae-b1f3504eb875)

## Features

- **Meta Image Checker** – instantly shows whether the active tab has an `og:image` or `twitter:image` tag, displays a live preview of the image, its source and declared dimensions.
- **Page Meta Summary** – surfaces key Open Graph and Twitter Card meta fields (title, description, domain, OG type, Twitter card type).
- **Social Preview Audit** – checks whether OG / Meta, Twitter / X, Facebook, and LinkedIn preview tags are present and compares the current image dimensions against common social-preview targets.
- **Brand-Aware Generator** – the popup now reads page color hints, favicon/logo candidates, and keywords so the generator can:
   - Default to an **Auto from Page Brand** template built from the current page's color scheme.
   - Reuse a detected **brand logo or favicon** as a smaller, more professional brand mark when available.
   - Keep generation controls and the rendered preview on the **same screen**.
- **Optional Visual Assets** – choose between a text-only layout, the current page meta image, the detected brand image, or a custom direct image URL.
- **Royalty-Free Search Shortcuts** – open keyword searches for Unsplash, Pexels, Pixabay, Getty Images, and Freepik directly from working popup action buttons, then paste a direct image URL if you want to include an external image in the generated asset.
- **Professional Image Generator** – canvas-based generator that creates a 1200 × 630 social-preview image with:
   - 12 templates including the new **Auto from Page Brand** mode plus multiple gradient, dark, light, and custom branded variants.
   - Auto-filled title, description, and domain pulled from the current page's meta tags.
   - Character-count guards (80 chars for title, 120 for description).
   - Optional gradient overlay when using an image-based layout.
   - 5 preset resolutions: `1200×630` (OG recommended), `1200×628` (Facebook / LinkedIn), `1024×512` (Twitter Summary Large), `800×418`, `600×314`.
- **Multi-format Downloads** – one-click download of the generated image as **PNG**, **JPEG**, or **WebP**.

## File Structure

```
meta-image-generator/
├── manifest.json      # Chrome Extension Manifest V3
├── content.js         # Injected into pages – extracts meta/OG/Twitter tags
├── popup.html         # Extension popup UI
├── popup.css          # Popup styles
├── popup.js           # Popup logic (meta checker + canvas image generator)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Installation (Developer Mode)

1. Clone or download this repository.
2. Open **Chrome** and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the repository folder.
5. The extension icon will appear in the toolbar.

## Usage

1. Navigate to any webpage in Chrome.
2. Click the **Meta Image Generator** extension icon.
3. The popup shows:
   - Whether a meta/OG image exists on the page.
   - A summary of the page's Open Graph and Twitter Card tags.
   - A social preview audit for OG / Meta, Twitter / X, Facebook, and LinkedIn tags plus image-ratio checks.
4. Use the **Generate Social Preview Image** section to create a custom image:
   - Start with **Auto from Page Brand** to reuse the current site's palette.
   - Keep or disable the detected **logo / favicon**.
   - Choose a visual source: no image, the page meta image, the detected brand image, or a custom direct image URL.
   - Use the gradient preview cards to choose a design, or open a royalty-free source search if you want to find a relevant external image.
   - Paste a direct image URL when the provider exposes one and you want that image inside the generated asset.
   - Edit the title, description, and domain text.
   - Pick your desired format (PNG / JPEG / WebP) and resolution.
   - Click **Preview** to see the result, or **Generate & Download** to render and get download links for all three formats.

## Notes on External Images

- Search links for Unsplash, Pexels, Pixabay, Getty Images, and Freepik are convenience shortcuts only.
- The extension can only place an external image on the canvas when the pasted URL is a direct image resource that the browser extension can fetch.
- Licensing, attribution, and commercial-use rules still depend on the source provider and the chosen image.

## Supported Meta Tags

| Tag | Property |
|-----|----------|
| Open Graph | `og:title`, `og:description`, `og:image`, `og:image:width`, `og:image:height`, `og:url`, `og:site_name`, `og:type` |
| Twitter Card | `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`, `twitter:site` |
| Standard | `<title>`, `meta[name="description"]`, `link[rel="canonical"]` |

## Image Specifications

| Format | Dimensions | Use Case |
|--------|-----------|----------|
| OG / Meta | 1200 × 630 | Default recommended size |
| Facebook / LinkedIn | 1200 × 628 | Optimal for these platforms |
| Twitter Summary Large | 1024 × 512 | Twitter large card |
| Compact OG | 800 × 418 | Bandwidth-conscious option |
| Minimum OG | 600 × 314 | Smallest acceptable OG size |

## License

[MIT](LICENSE)
