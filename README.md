# Mike Fitzpatrick — Spec Kit Website

A static storytelling site built from Mike Fitzpatrick's memoir (\`text/Mike in Vietnam.md\`) and the scanned hometown newspaper clippings in \`images/\`. It highlights the primary narrative, interleaves press clippings, and lets visitors leave context-aware comments that sync to Google Sheets via Google Apps Script so the site stays completely static (GitHub Pages friendly) without CORS headaches.

## Project layout

- \`index.html\` — hero layout, narrative grid, clipping gallery, glossary, and the off-canvas comment drawer.
- \`styles.css\` — expressive serif/sans typography, gradient background, responsive grids, and motion for hero, cards, and drawers.
- \`data/content.js\` — single source of truth for the memoir sections, clipping metadata (image, source, date, summary), hero info, and glossary items. Adjusting relationships (e.g., which sections reference which clippings) only requires editing this file.
- \`scripts/comment-config.js\` — stores the published Google Apps Script URL. Update \`GOOGLE_SCRIPT_URL\` once you deploy the sheet-backed endpoint.
- \`scripts/app.js\` — renders data onto the page, wires the comment drawer, and syncs with Google Sheets while falling back to \`localStorage\` during offline dev.
- \`text/\`, \`images/\` — untouched source assets referenced directly by the frontend.

## Running locally

Any static file server works. Two quick options on Windows PowerShell:

```pwsh
# Option 1: use Python 3
python -m http.server 4173

# Option 2: if you have Node.js 18+
npx serve@14 .
```

Then open `http://localhost:4173` (or the port `serve` prints). Comments will fall back to `localStorage` until you configure the Google Apps Script URL.

## Google Sheets + Apps Script backend

1. Create a Google Sheet named anything you like. Add a header row with: `segmentId`, `segmentType`, `name`, `comment`, `createdAt`, `userAgent`, `ip` (optional), etc.
2. Open **Extensions → Apps Script** on that sheet, delete the sample `myFunction`, and paste the script below.
3. Deploy: **Deploy → New deployment → Web app**. Set *Execute as* “Me” and *Who has access* to “Anyone”. Copy the Web app URL.
4. Set `GOOGLE_SCRIPT_URL` in `scripts/comment-config.js` to that URL and redeploy the static site.

### Recommended Apps Script (CORS-safe)

```javascript
const SHEET_NAME = 'Sheet1';

function doGet(e) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const segmentId = (e.parameter.segmentId || '').trim();
  const rows = sheet.getDataRange().getValues();
  const headers = rows.shift();
  const data = rows
    .map((row) => Object.fromEntries(row.map((value, idx) => [headers[idx], value])))
    .filter((row) => !segmentId || row.segmentId === segmentId);
  return respond({ success: true, comments: data });
}

function doPost(e) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  const body = JSON.parse(e.postData.contents);
  const timestamp = new Date().toISOString();
  sheet.appendRow([
    body.segmentId,
    body.segmentType,
    body.name,
    body.comment,
    timestamp,
    e?.parameter?.userAgent || '',
    e?.parameter?.ip || ''
  ]);
  return respond({ success: true, createdAt: timestamp });
}

function doOptions() {
  return respond({ success: true });
}

function respond(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type')
    .setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
}
```

- The explicit `Access-Control-Allow-*` headers prevent CORS issues when testing locally or from GitHub Pages.
- Add validation/rate-limiting logic if you expect heavy traffic.

## Editing content & associations

- **Narrative order**: update the `sections` array in `data/content.js`. Each entry holds `title`, `summary`, `body` (array of paragraphs), and `relatedClippings`. Reordering sections automatically updates the page.
- **Clipping metadata**: adjust the `clippings` array. Each entry already references the matching PNG in `images/` and its OCR text.
- **Hero moments & glossary**: the hero block and glossary share the same file for easy tweaks.

## Deployment tips

1. Commit the new files, push to GitHub, and enable GitHub Pages (Settings → Pages → Deploy from branch → `main` / root).
2. Because the site is static, no build pipeline is needed. Just ensure the `images/` and `text/` folders ship with it.
3. After setting `GOOGLE_SCRIPT_URL`, test both locally and via the GitHub Pages URL to confirm CORS headers are working (open DevTools → Network → POST request → no red CORS banners).

## Testing checklist

- [ ] Load `index.html` locally; ensure the hero image (`images/MainImage.jpeg`) renders.
- [ ] Click “Comment on this section” — the drawer should slide in and show the selected section title.
- [ ] Submit a comment with Google Apps Script configured; verify the Sheet receives a row and the UI refreshes.
- [ ] Confirm local fallback by temporarily blanking `GOOGLE_SCRIPT_URL`; entries should persist via `localStorage`.
- [ ] Resize the browser to mobile widths (≤640px) to review the single-column layout and full-width comment drawer.

---
Questions or enhancements? Consider adding tagging filters, audio narration, or copying the Apps Script log to BigQuery for long-term archiving.
