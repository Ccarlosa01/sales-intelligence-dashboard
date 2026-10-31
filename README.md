# Sales Intelligence Dashboard

A static, desktop-first retail performance dashboard built for the generated `2026_YTD_Sales_Top300_ThruJune30th.static.xlsx` workbook layout. It analyzes **one Excel report at a time**, across its three-digit store tabs.

## Features

- Side-by-side Full Store and Top 300 KPI columns
- Official store sales (G1) and Top 300 sales (G2) on each three-digit tab
- YTD sales, units, margin dollars, margin rates, year-over-year growth
- Department and subcategory filters
- Sales / Units / Margin $ historical comparison (2024, 2025, 2026)
- Searchable, sortable product table with expandable subrows for the other two metrics
- Product details drawer for inventory, price and cost
- Comparisons, rule-based insights, CSV export
- Local-in-browser Excel parsing; no server required

## Run locally

Open `index.html` in a current browser with internet connectivity, then select the Excel workbook. The Excel parser loads from a public CDN. For a local development server, run `python -m http.server 8000` from the project folder and open `http://localhost:8000`.

## Deploy with GitHub Pages

1. Create a **new repository** named `sales-intelligence-dashboard` on GitHub. Choose **Private** if available for your account and deployment needs; note that GitHub Pages site visibility can differ from repository visibility. Do not assume a Pages URL is private.
2. Upload only `index.html`, `styles.css`, `app.js`, `.gitignore`, and `README.md` to the root of the repository. Do **not** upload your workbook or exported data.
3. Go to **Settings → Pages**; under **Build and deployment** choose **Deploy from a branch**; select `main` and `/ (root)`; click **Save**.
4. Open the Pages URL GitHub shows, normally `https://YOUR-USERNAME.github.io/sales-intelligence-dashboard/`.
5. Click **Upload Excel** and choose the report file on your computer.

Changes pushed to `main` will update the static website after GitHub Pages deploys them.

## Workbook mapping

Only tabs named with exactly three digits are analyzed. Column names are read from row 3 (`A3:AB3`).

| Columns | Meaning |
|---|---|
| B:E | Item, Description, Department, SUB |
| G:P | Current YTD retail / sales / contributions / on-hand / units / cost / margin |
| Q:S | Historical YTD Sales: 2024, 2025, 2026 |
| U:W | Historical YTD Units: 2024, 2025, 2026 |
| Y:AA | Historical YTD Margin $: 2024, 2025, 2026 |
| G1 | Official current store sales |
| G2 | Official Top 300 current sales |

The Top 300 cohort is determined by sorting all current-report product rows descending on 2026 YTD sales and selecting exactly 300 items (item number breaks ties). This is validated against the reported Top 300 sales G2 total in Store 101. Column J contains contribution ratios for more than 300 rows and therefore cannot be used as a membership flag. Historical Top 300 charts follow this current-report cohort, not independently ranked historical top-300 cohorts.

### Accounting/data considerations

- The **unfiltered current-year Sales** cards use the official G1 and G2 workbook totals.
- The **filtered Sales** cards and **Units / Margin** cards use the rows actually listed in the three-digit tab. When a tab omits products or aggregate rows, those values may not equal whole-store accounting totals.
- Historical *Full Store* is calculated by summing historical values for product rows present in this report. It is **not an independently verified full-store historical total**.
- Comparisons presume the workbook's historical columns refer to equivalent YTD cutoffs. The application displays a fixed June 30, 2026 report label; if future reports use different cutoffs, update the report-date logic.
- A prior-year zero gives "N/A" growth, not infinite percentage growth.
- The website does not upload or store report data; reselect the Excel file after reload.

## Security and privacy

**Do not publish the Excel workbook, derived JSON/CSV files, credentials, or secret keys in the repository.** GitHub Pages hosting typically makes the published site publicly accessible. All workbook parsing occurs in the browser and the initial site does not call your Google Drive account. Do not use this first version as an authenticated/private data platform.

## Future phases

Google Drive report picker, persisted saved views, custom year/cutoff parsing, seasonal cross-report analysis, and authorized access can be added later.


## Version 1.1 — Margin and Top 300 performance

- **Products:** Margin % is a fourth main metric. Its year-over-year difference is shown in **percentage points (pp)**. Expand a product to see the other three metrics. Margin percentages are calculated as margin dollars divided by sales for each year. No-sales years display — rather than a misleading percentage.
- **Product performance filter:** High volume / high margin includes products at or above the 75th percentile on **both** 2026 units and 2026 gross margin percentage in the currently scoped store/department/product group. Low / low includes products at or below the 25th percentile on both measures. This deliberately does not label high margin alone as best performance.
- **Top 300 Rankings:** Sales rank is always based on 2026 YTD sales for the selected store. The ten worst-performing products are selected independently of sales rank: lowest average of 2026 unit-volume percentile and gross-margin-% percentile, calculated among that store's 300 top-selling products. Ties break by lower units, lower margin %, then higher sales rank. The 10 flags remain fixed when department or search filters change. Search, filter, inspect details, paginate, and export the current Top 300 selection.
- The Excel file is parsed in the browser and should **not** be included in the published repository.
