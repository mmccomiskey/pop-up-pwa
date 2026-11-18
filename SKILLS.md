# 🛠️ Pop-Up PWA: Agent Skills & Architecture Playbook

This document defines the architecture patterns and agent skills required to programmatically build, deploy, manage, and tear down ephemeral pop-up PWAs for single-day trips and events.

---

## 1. Edge Architecture: Cloudflare Workers + KV

### Why this pattern beats full-stack frameworks for ephemeral apps:
- **Zero Cold Starts:** Edge workers boot globally in <5ms.
- **No Database Overhead:** Cloudflare KV acts as an ultra-fast global key-value store for lightweight state (`completed_stops: []`).
- **Single-File Delivery:** The Worker serves the HTML shell, the dynamic SVG icons, the Web App Manifest, the Service Worker, and the REST synchronization endpoints from a single file.

### Required Cloudflare API / Wrangler Operations:
1. **Verify Subdomain:** Check `GET /accounts/{account_id}/workers/subdomain`. If missing, register one with `PUT`.
2. **Create KV Namespace:** `POST /accounts/{account_id}/storage/kv/namespaces` with title (e.g. `POP_UP_KV`).
3. **Deploy Worker with KV Binding:**
   - Multi-part upload script with `metadata` declaring binding:
     ```json
     {
       "main_module": "worker.js",
       "bindings": [{ "type": "kv_namespace", "name": "POP_UP_KV", "namespace_id": "<ID>" }]
     }
     ```
4. **Enable Subdomain Route:** `POST /accounts/{account_id}/workers/scripts/{script_name}/subdomain` with `{ enabled: true }`.

---

## 2. PWA & Offline Engine Skills

### A. Preventing the "Black Screen of Death" on Launch
Mobile browsers (especially iOS WebKit in standalone PWA mode) will display a black/white blank canvas while waiting for network requests or external Google fonts to parse.
- **Rule 1:** Include an inline, zero-external-dependency splash element right after opening `<body>`:
  ```html
  <div id="app-splash" style="position:fixed; inset:0; background:#0b0f17; z-index:99999; ...">
    <div style="font-size:72px; animation: pulseFlame 1.4s infinite alternate;">🔥</div>
    <div>Firing up your trip...</div>
  </div>
  ```
- **Rule 2:** Dismiss the splash when DOM is ready (`document.readyState === 'complete'` or fallback timeout 1200ms).
- **Rule 3:** Use `display: swap` on fonts and define native system font fallbacks (`-apple-system, system-ui, sans-serif`).

### B. Service Worker Caching Strategy
- Use **Stale-While-Revalidate / Cache-First** for static assets (`/`, `/manifest.json`, `/apple-touch-icon.png`).
- **NEVER** cache `/api/*` endpoints in the Service Worker.
- Call `self.skipWaiting()` on install and `self.clients.claim()` on activate to ensure updates take effect immediately without requiring users to reinstall.

### C. Subway-Proof Offline Sync Outbox
1. **Optimistic Local Storage:** Always mutate local `Set` and update DOM immediately.
2. **Pending Queue:** Push `{ stopId, completed, timestamp }` into a `syncQueue` stored in `localStorage`.
3. **Network Flush:**
   - If `navigator.onLine`, flush the queue immediately via `POST /api/state`.
   - If offline, update UI badge to `⚡ Saved Offline (Will Sync)`.
   - On `window.addEventListener('online')`, flush all queued actions and fetch the latest server state.

---

## 3. Real-Time Multi-Device Sync Without WebSockets

WebSockets require active connections, reconnection logic, and stateful server instances. For single-day group trips, an **adaptive polling + visibility-triggered** model is far more reliable:

1. **Visibility Trigger:**
   ```javascript
   document.addEventListener('visibilitychange', () => {
     if (document.visibilityState === 'visible') fetchState();
   });
   window.addEventListener('focus', () => fetchState());
   ```
   *Whenever someone pulls their phone out of their pocket or unlocks it, it immediately syncs.*
2. **Active Polling:** While the app remains open on-screen, poll `/api/state` every 3.5 seconds.
3. **Conflict Resolution:** If `syncQueue.length === 0`, server state is the single source of truth. If there are pending un-flushed offline edits, apply the server state and then overlay local pending actions on top.

---

## 4. Ephemeral Lifecycle: Scheduled Teardowns

Because pop-up PWAs are created for specific events (e.g. "Friday the 20th"), agents should always offer or automatically schedule an ephemeral teardown:
- Use a scheduled task / cron runner configured for the morning after the event (e.g. `Monday 09:00 AM`).
- The task issues `DELETE /workers/scripts/{script_name}` and `DELETE /storage/kv/namespaces/{namespace_id}`.
- Zero leftover resources or unused endpoints on the account.

---

## 5. Event Discovery & Design Intake Protocol

Before writing code or deploying infrastructure, the AI agent **must run this structured intake checklist** to tailor the app's visual identity, vibe, and logistics to the specific event.

### 📋 Discovery Questions to Ask the User:

1. **Event Type & Vibe / Aesthetic:**
   - *Options to present:*
     - ⚡ **Midnight / Neon Dark Mode** (bars, pub crawls, nighttime events, high energy)
     - ☀️ **Clean Day-Tripper / Minimal Light Mode** (museums, walking tours, coffee crawls)
     - 🌿 **Earth / Outdoors** (hiking, park visits, outdoor festivals)
     - 🍸 **Retro / Speakeasy** (warm cream background, serif typography, burgundy/gold accents)
   - *"Do you have a preferred vibe or theme color palette in mind?"*

2. **Core Icon / Mascot Emoji:**
   - *What single emoji best represents the event for the home-screen app icon and splash screen?* (e.g. 🍺 for beer crawl, 🍕 for food tour, ⛳ for golf trip, 🏎️ for car show, 💍 for bachelor party).

3. **Logistics & Transit Anchors:**
   - *What are the hard start and end times / transit constraints?* (e.g. arrival bus time, flight departure, dinner reservation times).
   - *Are there specific geographic boundaries or neighborhoods to avoid zig-zagging?*

4. **Group Style & Social Tone:**
   - *Casual grazing vs. scheduled sit-downs?*
   - *Include group chat receipts/quotes or keep it strictly logistical?*

5. **Lifecycle / Teardown Date:**
   - *When is the event officially over so we can schedule an automatic teardown of the Cloudflare Worker and KV storage?*

### 🛠️ Agent Implementation Rule:
Use the user's answers to configure:
- CSS variables (`--bg`, `--card-bg`, `--accent-*`, `--font-*`)
- `APP_CONFIG.iconEmoji`, `themeColor`, and splash animations in `worker.js`
- Automated teardown schedule using the `tasks` tool
