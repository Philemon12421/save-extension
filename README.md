# SnapLoad – Media Downloader Chrome Extension

Hover any image or video on any site to get a **glassy overlay** with two smart download options: **thumbnail** or **full video**. Per-site access toggles built in.

---

## ✦ What's New in this extension

- 🖼 **Two download buttons** on video hover: *Thumbnail* (poster/frame) + *Video* (full file)
- 🌐 **Per-site access controls** — toggle YouTube, Instagram, TikTok, Snapchat, Facebook, X, Google individually
- 🔍 **Auto-detects current site** — popup shows which site you're on and its access status
- ➕ **Add any custom site** — one click to enable SnapLoad on any other site
- ⚠️ **Restricted site warnings** — clearly shows when a site blocks direct video downloads
- 🔧 **Fixed YouTube/Instagram network errors** — downloads routed through background service worker

---

## 🚀 Installation

1. Download and **unzip** the folder
2. Open Chrome → `chrome://extensions`
3. Enable **Developer Mode** (toggle top-right)
4. Click **Load unpacked** → select the `snapload-extension` folder
5. Click the SnapLoad icon in your toolbar

---

## 🎮 How to Use

### Basic
1. Open the popup → make sure the master toggle is **ON**
2. Hover any image/video/GIF on any website
3. The glassy overlay appears below the media
4. **Two buttons appear for videos:**
   - 🔵 **THUMB** — downloads thumbnail/poster image
   - 🔴 **VIDEO** — downloads the actual video file (if available)

### Site Access
- The popup **auto-detects** what site you're on
- Use the top site toggle to quickly **enable/disable** SnapLoad on that specific site
- Toggle individual sites: YouTube, Instagram, TikTok, Snapchat, Facebook, X, Google
- Click **"Enable on current site"** for any other site not in the list

---

## ⚠️ About Restricted Sites (YouTube, Instagram, etc.)

These platforms protect their media:
- **Thumbnail downloads** ✅ — always work (loads from CDN directly)
- **Video downloads** ❌ — YouTube/Instagram use HLS/DASH streaming, not direct MP4 files. The video button will show a warning badge and open the stream URL instead.

For full YouTube video downloads, use a dedicated tool like `yt-dlp`.

---

## 📁 File Structure

```
snapload-extension/
├── manifest.json       ← Manifest V3 config
├── popup.html          ← Popup with site access toggles
├── popup.js            ← Popup logic + site detection
├── content.js          ← Hover detection + dual download overlay
├── content.css         ← Glassy dark overlay styles
├── background.js       ← Service worker (chrome.downloads API)
└── icons/
    ├── icon16.png
    ├── icon32.png
    ├── icon48.png
    └── icon128.png
```

---

## 🛡 Permissions

| Permission | Why |
|---|---|
| `activeTab` | Read current tab URL for site detection |
| `storage` | Save toggle preferences |
| `downloads` | Trigger file downloads without CORS errors |
| `scripting` | Inject content script on demand |
| `host_permissions: <all_urls>` | Run on every website |

---

Made with ♥ by Philemon
# save-extension
