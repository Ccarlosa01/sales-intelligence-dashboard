# Sales Intelligence v1.5 — GitHub UI + Google Drive archive

The original v1.1 visual styling and analytics are preserved. All website pages run on GitHub Pages; the separate Apps Script project stores and retrieves report files only.

## GitHub
Upload `index.html`, `styles.css`, `app.js`, `archive.js` to repository root. Enable GitHub Pages (main / root). Do not upload workbooks.

## Apps Script
Replace `Code.gs` with the included backend code, run `testFolderConnection` once, then deploy **Web app → Execute as Me** and configure access according to your privacy needs. The frontend expects GET JSONP actions (list, startRead, readChunk) and POST form actions (begin, chunk, finish). No HTML templates are needed in Apps Script.

## Connect
Open your GitHub site → Report Library → Google Drive connection settings → paste the `/exec` URL and save. Choose Month and Year, upload an Excel file, then click **Save current workbook to Drive**. The UI and analyses stay in GitHub.

## Security and limitations
A web app deployed with **Anyone** and **Execute as Me** exposes the specified archive to anyone who can discover the endpoint, even if the dashboard is hosted elsewhere. This project does not implement user authentication. Do **not** use this public configuration for sensitive reports. A proper access-controlled intermediary (e.g., Cloudflare Worker + identity provider) is recommended before making the app public. The browser stores the Apps Script URL locally; it is not a secret. Apps Script request limits and the repeated Drive read for each chunk may affect large (~12MB) workbooks. Browser upload/download has not been verified against a deployed Apps Script account. Report history is stored per month/year with timestamped versions; old files are retained. The original spreadsheet parser still expects the specific 2026 YTD report structure.
