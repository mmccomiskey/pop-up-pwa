# ⚡ Pop-Up PWA

> **An ephemeral, zero-dependency Progressive Web App template with real-time multi-device syncing and offline caching on Cloudflare Workers + KV.**

Designed for single-day events, pub crawls, bachelor parties, conferences, and travel itineraries where you need an installable mobile app with live check-offs across friends' phones—**without** App Store reviews, frameworks, or database servers.

---

## 🌟 Core Features

- 📱 **True PWA (Installable on iOS & Android):** Runs standalone with no browser URL bar or bottom navigation.
- ⚡ **Instant Animated Splash Screen:** Eliminates the blank white/black screen delay on cold launch with a 0ms inline animated loader.
- 📶 **100% Offline-First (Subway-Proof):**
  - Uses `Cache-First` Service Worker caching (`stale-while-revalidate`) for instantaneous launches even with airplane mode on.
  - Check-offs write instantly to `localStorage` + an offline queue.
  - Listens for `window.addEventListener('online')` to auto-flush queued changes up to the cloud the second you step above ground.
- 🔄 **Real-Time Multi-Device Sync:**
  - Backed by Cloudflare Workers KV.
  - Automatically fetches fresh updates when someone unlocks their phone (`document.visibilitychange` & `window.onfocus`) or in 3.5s background polling.
- 🎨 **Dynamic SVG Favicons & Icons:** Generated on the edge directly from emojis (no PNG asset pipeline required).
- 🧭 **Turn-by-turn Navigation & Chat Lore:** Deep-links to Google Maps / Apple Maps alongside embedded quotes from group chat planning.

---

## 📁 Repository Structure

```
pop-up-pwa/
├── index.html       # The complete frontend application (PWA, offline engine, live sync)
├── worker.js        # The edge backend (manifest, icons, service worker, KV state sync)
├── wrangler.toml    # Cloudflare Wrangler deployment configuration
├── SKILLS.md        # AI Agent Skills & Playbook for zero-touch deployment
└── README.md        # Documentation
```

---

## 🚀 Quick Start (Deploying in 60 Seconds)

### 1. Install Wrangler & Login
```bash
npx wrangler login
```

### 2. Create a KV Namespace
```bash
npx wrangler kv namespace create POP_UP_KV
```
Copy the returned `id` into `wrangler.toml`:
```toml
[[kv_namespaces]]
binding = "POP_UP_KV"
id = "<YOUR_NAMESPACE_ID>"
```

### 3. Deploy to Cloudflare
```bash
npx wrangler deploy
```

Your app is now live at `https://pop-up-pwa.<your-subdomain>.workers.dev`!

---

## 🤖 Using with AI Coding Agents (Cline / Claude Code)

See [`SKILLS.md`](./SKILLS.md) for the exact step-by-step instructions for AI agents to generate, deploy, sync, and tear down ephemeral pop-up PWAs.

---

## 🧹 Ephemeral Teardown

To avoid leaving zombie infrastructure running after your trip or event:
```bash
# Delete the Worker
npx wrangler delete

# Delete the KV Namespace
npx wrangler kv namespace delete --binding POP_UP_KV
```
