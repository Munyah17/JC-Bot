# JC Insurance — WhatsApp Chatbot

A fast, fully-functional WhatsApp chatbot for an insurance company, built on the **WhatsApp Cloud API** (Meta). No paid dependencies.

## Features

- **Interactive menus** — WhatsApp list & button messages (tap, no typing needed)
- **Instant quotes** — Auto, Health, Home, Life with rule-based pricing (`src/data.js`)
- **Claims** — File a new claim (guided form) and track existing claims
- **FAQs** — keyword-matched answers from any point in the conversation
- **Agent handoff** — escalates to a human; bot stays silent until released
- **Session management** — per-number state with 30-min idle timeout
- **Event ledger** — quotes/claims/handoffs appended to `data/events.jsonl`
- **CLI simulator** — test the whole flow locally without Meta credentials

## Quick start (local, no WhatsApp needed)

```powershell
npm install
npm run simulate
```

Chat with the bot in your terminal. Type `menu`, `quote`, `claim`, `agent`, or pick list ids like `menu_quote`.

## Run the webhook server

```powershell
copy .env.example .env
npm start
```

Test locally without Meta credentials (replies are returned as JSON):

```powershell
curl -X POST http://localhost:3000/test -H "Content-Type: application/json" -d '{"phone":"123","text":"hi"}'
```

## Connect to real WhatsApp (WhatsApp Cloud API)

1. Create an app at [developers.facebook.com](https://developers.facebook.com) → add the **WhatsApp** product.
2. From the WhatsApp **API Setup** page, copy:
   - **Temporary access token** → `WHATSAPP_TOKEN` (create a permanent token via a System User for production)
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - Add a test recipient number (up to 5 while in dev mode)
3. Set `VERIFY_TOKEN` in `.env` to any secret string.
4. Expose your server:
   ```powershell
   ngrok http 3000
   ```
5. In the Meta app dashboard → WhatsApp → **Configuration**, set:
   - Callback URL: `https://<your-ngrok-host>/webhook`
   - Verify token: same as `VERIFY_TOKEN` in `.env`
   - Subscribe to the **`messages`** webhook field.
6. Text `hi` to your WhatsApp test number.

### Dry run on the real webhook

Set `DRY_RUN=true` in `.env` — inbound webhooks are processed and replies are printed to the console instead of sent. Useful while waiting for Meta approval.

## Project structure

```
src/
  index.js      Express server + webhook endpoints
  bot.js        Conversation engine (state machine) — channel-agnostic
  whatsapp.js   WhatsApp Cloud API client (renders replies to API payloads)
  data.js       Products, pricing rules, FAQs — edit to customize
  store.js      Session store + event ledger (in-memory + Supabase write-through)
  supabase.js   Supabase client — env-gated, no-ops when unconfigured
  simulator.js  CLI chat simulator
supabase/
  schema.sql    Tables: bot_sessions, bot_events (RLS enabled)
test/
  bot.test.js   Engine tests
```

## Deploy to Vercel

The repo is Vercel-ready — `api/index.js` exposes the Express app as a serverless function and `vercel.json` routes all traffic to it. Every push to `main` auto-deploys.

1. Import the GitHub repo in Vercel (already done → it deploys on each commit).
2. In **Vercel → Project → Settings → Environment Variables**, add (` .env` is gitignored and NOT uploaded):
   - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `VERIFY_TOKEN`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
   - `DRY_RUN` = `true` until Meta credentials are live (webhook processes, replies go to function logs)
3. Set the Meta webhook URL to `https://<your-project>.vercel.app/webhook`.

**Serverless note:** Supabase is required on Vercel — sessions are hydrated from `bot_sessions` on every message (`hydrateSession`), since cold instances share no memory. The local JSONL ledger is skipped (read-only FS); `bot_events` becomes the only event record.

## Database (Supabase)

The bot persists sessions and every quote/claim/handoff to Supabase when configured.

1. In your [Supabase dashboard](https://supabase.com/dashboard) → **SQL Editor**, run `supabase/schema.sql` — it creates `bot_sessions` and `bot_events` (with RLS enabled).
2. Copy **Project Settings → API → service_role key** into `.env`:
   ```
   SUPABASE_URL=https://owuzgtifqspeapsnpare.supabase.co
   SUPABASE_SERVICE_KEY=<service_role key>
   ```
   The service key bypasses RLS — keep it server-side only, never commit it.
3. Restart — the server logs `Supabase persistence enabled.`

Without credentials the bot still runs fully on in-memory sessions + `data/events.jsonl`.

## Customizing

- **Products / pricing / questions**: edit `src/data.js` — quote forms are generated from each product's `fields` array, and pricing from its `quote()` function.
- **Conversation flow**: edit `src/bot.js` state handlers.
- **Persistence**: swap `src/store.js` in-memory Map for Redis/Postgres in production.

## Production notes

- Use a **permanent** System User token, not the 24h temporary token.
- Put the server behind HTTPS (ngrok/Cloudflare Tunnel/reverse proxy).
- Inbound media (documents for claims) is detected as `__unsupported_*` — extend `extractInput` in `src/whatsapp.js` to download media via the Media API if needed.
- `data/events.jsonl` records every quote, claim and handoff — wire it to your CRM.
