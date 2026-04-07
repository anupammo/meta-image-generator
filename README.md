# Meta Image Generator

A **Google Chrome Extension** that checks whether a webpage has a Meta / OG Image and lets you generate a professional social-preview image on the spot.

![Meta Image Generator UI](https://github.com/user-attachments/assets/595dc1c4-85cb-4499-90ae-b1f3504eb875)

## Features

- **Meta Image Checker** – instantly shows whether the active tab has an `og:image` or `twitter:image` tag, displays a live preview of the image, its source and declared dimensions.
- **Page Meta Summary** – surfaces key Open Graph and Twitter Card meta fields (title, description, domain, OG type, Twitter card type).
- **Professional Image Generator** – canvas-based generator that creates a 1200 × 630 social-preview image with:
  - 7 built-in templates (Gradient Blue, Gradient Purple, Gradient Green, Gradient Orange, Dark Professional, Light Clean, and a fully custom-colour **Branded** option).
  - Auto-filled title, description, and domain pulled from the current page's meta tags.
  - Character-count guards (80 chars for title, 120 for description).
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
4. Use the **Generate Social Preview Image** section to create a custom image:
   - Choose a template and optionally a custom background colour.
   - Edit the title, description, and domain text.
   - Pick your desired format (PNG / JPEG / WebP) and resolution.
   - Click **Preview** to see the result, or **Generate & Download** to render and get download links for all three formats.

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
