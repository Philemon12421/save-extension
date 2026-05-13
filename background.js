// SnapLoad Background Service Worker v2.2

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['enabled'], (r) => {
    if (r.enabled === undefined) {
      chrome.storage.sync.set({
        enabled: true,
        sites: {
          'youtube.com': true, 'instagram.com': true, 'tiktok.com': true,
          'snapchat.com': true, 'facebook.com': true, 'x.com': true,
          'twitter.com': true, 'google.com': true
        },
        customSites: {}
      });
    }
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // ── fetchDownload: fetch-then-download to bypass CORS ────────────────────
  if (msg.action === 'fetchDownload') {
    const { url, filename } = msg;
    if (!url) { sendResponse({ success: false, reason: 'no_url' }); return true; }

    // blob: URLs belong to the originating page — the background worker
    // cannot fetch them. Tell content script to handle it locally instead.
    if (url.startsWith('blob:')) {
      sendResponse({ success: false, reason: 'blob_url_local' });
      return true;
    }

    // data: URLs can be passed straight to chrome.downloads
    if (url.startsWith('data:')) {
      chrome.downloads.download({
        url,
        filename: sanitize(filename),
        saveAs: false,
        conflictAction: 'uniquify'
      }, id => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, reason: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, downloadId: id });
        }
      });
      return true;
    }

    // Normal HTTP(S) URL — fetch as blob, convert to data URL, then download
    fetch(url, { method: 'GET', credentials: 'omit' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.blob();
      })
      .then(blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror  = reject;
        reader.readAsDataURL(blob);
      }))
      .then(dataUrl => new Promise((resolve, reject) => {
        chrome.downloads.download({
          url: dataUrl,
          filename: sanitize(filename),
          saveAs: false,
          conflictAction: 'uniquify'
        }, id => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError.message);
          else resolve(id);
        });
      }))
      .then(id => sendResponse({ success: true, downloadId: id }))
      .catch(err => {
        // Fallback: direct chrome.downloads (works for many CDN URLs)
        chrome.downloads.download({
          url,
          filename: sanitize(filename),
          saveAs: false,
          conflictAction: 'uniquify'
        }, id => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, reason: String(err) });
          } else {
            sendResponse({ success: true, downloadId: id });
          }
        });
      });

    return true; // keep channel open for async response
  }

  // ── download: direct chrome.downloads (data: / object URLs from content) ──
  if (msg.action === 'download') {
    const { url, filename } = msg;
    if (!url) { sendResponse({ success: false }); return true; }

    // blob: URLs created in the content script (createObjectURL) cannot cross
    // to the background. Shouldn't reach here, but guard anyway.
    if (url.startsWith('blob:')) {
      sendResponse({ success: false, reason: 'blob_url_local' });
      return true;
    }

    chrome.downloads.download({
      url,
      filename: sanitize(filename || `snapload-${Date.now()}`),
      saveAs: false,
      conflictAction: 'uniquify'
    }, id => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, reason: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId: id });
      }
    });
    return true;
  }
});

function sanitize(name) {
  if (!name) return `snapload-${Date.now()}`;
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, '_').slice(0, 180);
}
