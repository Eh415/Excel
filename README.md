# Excel Sorter

Upload an Excel file, pick a column and sort order, and download a new sorted `.xlsx` file.

## Structure
- `backend/` — Express + TypeScript API. Parses uploads with `xlsx`, sorts rows, and streams back a sorted file.
- `frontend/` — React + Vite + TypeScript UI. Upload widget, column/order pickers, preview table, download button.

## Running locally

### 1. Backend
```bash
cd backend
npm install
npm run dev
```
Runs on `http://localhost:4000`.

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Runs on `http://localhost:5173` and proxies `/api` requests to the backend (see `vite.config.ts`).

Open `http://localhost:5173`, upload a `.xlsx`/`.xls` file, choose a column + order, then click **Sort & Download**.

## How it works
1. `POST /api/upload` — accepts the file (multipart, field name `file`), parses it in memory with the `xlsx` library, and returns the column names, a 5-row preview, and a `fileId` that references the parsed workbook (kept in an in-memory store for 30 minutes).
2. `POST /api/sort` — takes `{ fileId, column, order }`, re-sorts the rows (numeric-aware, falls back to locale string compare), rebuilds a workbook, and streams it back as an `.xlsx` attachment.

## Deploying it live (GitHub + hosting)

This is one repo with two apps in it (`backend/` and `frontend/`), so you deploy them as **two separate services** that point at each other.

### 1. Push to GitHub
```bash
cd excel-sorter
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

### 2. Deploy the backend (Render — free tier works)
1. Go to [render.com](https://render.com) → **New +** → **Web Service** → connect your GitHub repo.
2. Set **Root Directory** to `backend`.
3. Build command: `npm install && npm run build`
4. Start command: `npm start`
5. Environment: Node. No env vars are required (defaults to port 4000, Render overrides `PORT` automatically — the code already reads `process.env.PORT`).
6. Deploy, then copy the live URL Render gives you, e.g. `https://excel-sorter-backend.onrender.com`.

(Railway works the same way if you prefer it — same root directory / build / start commands.)

> Free-tier Render services spin down when idle and take ~30–60s to wake up on the first request. This is the same cold-start behavior you likely ran into with other Render-hosted backends — the first upload after idle time will feel slow, that's expected.

### 3. Deploy the frontend (Vercel — free tier works)
1. Go to [vercel.com](https://vercel.com) → **Add New** → **Project** → import the same GitHub repo.
2. Set **Root Directory** to `frontend`.
3. Framework preset: Vite (auto-detected).
4. Add an environment variable:
   - `VITE_API_BASE_URL` = your Render backend URL from step 2 (no trailing slash), e.g. `https://excel-sorter-backend.onrender.com`
5. Deploy.

(Netlify works too — same root directory and env var, build command `npm run build`, publish directory `dist`.)

### 4. Test it
Open your Vercel URL, upload a file, sort it, download it. If the download fails, check the browser console — it's almost always either a wrong `VITE_API_BASE_URL` or the backend still cold-starting.

## Notes / things to adjust for production
- The file store is in-memory (`Map`) and single-process — fine for a demo/capstone, but won't survive a server restart or scale across multiple instances. Swap in Redis or a temp-file-on-disk approach if you need persistence.
- No auth/rate limiting — add if this will be exposed publicly.
- Only the first sheet in the workbook is read/returned. Extend `sheetName` handling if you need multi-sheet support.
- Sorting only supports a single column. Multi-column sort would need a small extension to the `/api/sort` payload (e.g. an array of `{ column, order }`).
