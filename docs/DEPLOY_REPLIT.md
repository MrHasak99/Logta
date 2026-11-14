# Hosting the Logta API on Replit

The Vercel site stays as is. Replit runs **only the API server + SQLite database** (`npm run server`).

**Why the backup step matters:** Replit Deployments (Autoscale, Static, Reserved VM) **do not keep files written at
runtime**; anything on disk is lost on redeploy ([Replit docs](https://docs.replit.com/hosting/deployments/about-deployments)).
So the server snapshots the SQLite file to **Replit Object Storage** every 3 minutes (when something changed) and on
shutdown, and restores it on start (`server/backup.ts`). This turns on automatically on Replit once a bucket exists.

## Steps (about 10 minutes)

1. **Import the repo:** Replit → *Create App* → *Import from GitHub* → `MrHasak99/AI-Hackathon`, branch `main`.
   The repo's `.replit` sets Node 22 and `npm run server`. If Replit says the `nodejs-22` module is unknown, pick
   **Node.js 22 or newer** in the language/tools picker (better-sqlite3 needs Node ≥ 22).
2. **Secrets** (padlock icon / *Secrets* tool). Add these as Replit Secrets, **not** in a committed file:
   - `OPENROUTER_API_KEY` = your key (or `OPENAI_API_KEY` / `GEMINI_API_KEY`)
   - `ADMIN_TOKEN` = any long random string
   - `ALLOWED_ORIGINS` = `https://logta-alpha.vercel.app` (add other front-end URLs, comma-separated)
3. **Object Storage:** *Tools → Object Storage* → **Create a bucket**. (Without it the app still runs, but data resets on each redeploy.)
4. **Try it in the workspace:** press **Run**. The console should show
   `Logta API on port 8787 · … · AI: openrouter · backup: object storage` and, on first start, the seed stats.
   Open the webview URL + `/api/health` → `{"ok":true,"llm":"openrouter",…}`.
5. **Deploy:** *Publish / Deploy* → **Reserved VM** (smallest machine is enough) → build `npm ci --include=dev`,
   run `npm run server` (pre-filled from `.replit`) → Deploy. Secrets carry over; check that they appear in the deployment settings.
6. **Point the UI at it:** in Vercel, set `VITE_API_BASE=https://<your-app>.replit.app` and redeploy the front end.
   Make sure the Vercel URL is in `ALLOWED_ORIGINS`.

## Check it works
```bash
curl https://<your-app>.replit.app/api/health
curl https://<your-app>.replit.app/api/stats
```
After a redeploy, `/api/stats` should still show the same receipt count. The console prints `[backup] … restored database from object storage`.

## Notes
- Use **Reserved VM**, not Autoscale: Autoscale can run several instances at once, and each would have its own SQLite copy.
- Snapshots overwrite one object (`logta.db`). To reset the demo data, delete that object in Object Storage and redeploy.
- `LOGTA_BACKUP=off` disables snapshots; `LOGTA_BACKUP=replit` forces them outside Replit (needs Replit credentials).
- If you rotate the OpenRouter key (recommended after the event), update the Replit Secret and restart.
