# Chrome Web Store Privacy And Review Copy

## Single Purpose Description

This extension checks the social preview metadata of the active webpage and generates a downloadable social preview image using that page's meta tags, branding cues, and optional user-provided image URL.

## activeTab justification

The extension uses activeTab only when the user opens it on the current page so it can read that page's metadata and generate a preview image on demand.

## scripting justification

The scripting permission is required to inject the packaged content script into the active tab so the extension can read page metadata, branding hints, and image references for the popup.

## Host permission justification

The extension needs host access because it works on whichever page the user opens and may fetch page-declared images or a user-provided direct image URL to preview or render the generated social image.

## Remote Code

Select: No, I am not using Remote code

Justification: All executable code is bundled with the extension. It does not load remote JavaScript or Wasm and does not use eval.

## Data Usage

Select none of the listed data types.

The extension reads page content locally in the browser to perform its function but does not collect, store, transmit, sell, or share that information with the developer or third parties.

## Required Certifications

1. I do not sell or transfer user data to third parties, apart from the approved use cases.
2. I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
3. I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy Policy

If the store requires a privacy policy URL, publish `privacy-policy.html` from this folder and use its public URL.