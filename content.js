/* SnapLoad Content Script v2.1 */
(() => {
  'use strict';

  // ── Config ─────────────────────────────────────────────────────────────────
  const RESTRICTED = ['youtube.com','youtu.be','instagram.com','tiktok.com',
    'snapchat.com','facebook.com','fb.com','x.com','twitter.com'];
  const SITE_MAP = {
    'youtube.com':'youtube.com','youtu.be':'youtube.com',
    'instagram.com':'instagram.com','tiktok.com':'tiktok.com',
    'snapchat.com':'snapchat.com','facebook.com':'facebook.com','fb.com':'facebook.com',
    'x.com':'x.com','twitter.com':'x.com','google.com':'google.com'
  };
  const host = location.hostname.replace(/^www\./, '');

  // ── State ──────────────────────────────────────────────────────────────────
  let enabled = true, siteEnabled = true;
  let overlay = null, currentMedia = null;
  let hideTimer = null, hoveringOverlay = false;

  // ── Boot ───────────────────────────────────────────────────────────────────
  chrome.storage.sync.get(['enabled','sites','customSites'], init);

  chrome.runtime.onMessage.addListener(msg => {
    if (msg.action === 'stateUpdate') {
      enabled = msg.enabled; siteEnabled = msg.siteEnabled;
      if (enabled && siteEnabled) { if (!overlay) setup(); }
      else teardown();
    }
  });

  function init(s) {
    enabled = s.enabled !== false;
    siteEnabled = resolveSite(s);
    if (enabled && siteEnabled) setup();
  }

  function resolveSite(s) {
    const custom = s.customSites || {};
    if (custom[host] !== undefined) return custom[host];
    const key = knownKey(host);
    if (key) return (s.sites || {})[key] !== false;
    return true;
  }

  function knownKey(h) {
    for (const [k,v] of Object.entries(SITE_MAP))
      if (h === k || h.endsWith('.'+k)) return v;
    return null;
  }

  function isRestricted() {
    return RESTRICTED.some(r => host === r || host.endsWith('.'+r));
  }

  // ── DOM setup ─────────────────────────────────────────────────────────────
  function setup() {
    if (!overlay) buildOverlay();
    document.addEventListener('mouseover', onOver, true);
    document.addEventListener('mouseout',  onOut,  true);
    document.addEventListener('scroll',    onScroll, { passive: true, capture: true });
  }

  function teardown() {
    document.removeEventListener('mouseover', onOver, true);
    document.removeEventListener('mouseout',  onOut,  true);
    document.removeEventListener('scroll',    onScroll, true);
    overlay?.remove(); overlay = null; currentMedia = null;
  }

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'snapload-overlay';
    overlay.innerHTML =
      `<div class="sl-glass">` +
        `<div class="sl-thumb" id="sl-thumb"></div>` +
        `<div class="sl-info">` +
          `<div class="sl-type" id="sl-type">MEDIA</div>` +
          `<div class="sl-name" id="sl-name">file</div>` +
          `<div class="sl-hint" id="sl-hint">Choose option</div>` +
        `</div>` +
        `<div class="sl-sep"></div>` +
        `<div class="sl-actions" id="sl-actions"></div>` +
      `</div>`;
    overlay.addEventListener('mouseenter', () => { hoveringOverlay = true;  clearTimer(); });
    overlay.addEventListener('mouseleave', () => { hoveringOverlay = false; queueHide(); });
    document.documentElement.appendChild(overlay);
  }

  // ── Events ─────────────────────────────────────────────────────────────────
  function onOver(e) {
    if (!enabled || !siteEnabled || !overlay) return;
    if (overlay.contains(e.target)) return;
    const m = detect(e.target);
    if (!m) return;
    clearTimer();
    currentMedia = m;
    render(m);
    position(e.target);
    overlay.classList.add('sl-visible');
  }

  function onOut(e) {
    if (!overlay) return;
    if (overlay.contains(e.relatedTarget)) return;
    queueHide();
  }

  function onScroll() {
    if (currentMedia && overlay?.classList.contains('sl-visible'))
      position(currentMedia._el);
  }

  function clearTimer() { clearTimeout(hideTimer); }
  function queueHide(ms = 360) {
    clearTimer();
    hideTimer = setTimeout(() => { if (!hoveringOverlay) hide(); }, ms);
  }
  function hide() { overlay?.classList.remove('sl-visible'); currentMedia = null; }

  // ── Detection ──────────────────────────────────────────────────────────────
  function detect(el) {
    // IMG
    if (el.tagName === 'IMG') {
      const src = el.currentSrc || el.src;
      if (src && !isSvgData(src) && !isDataUri(src))
        return mk('image', 'IMAGE', src, src, null, el);
      if (src && isDataUri(src) && src.startsWith('data:image/'))
        return mk('image', 'IMAGE', src, src, null, el);
    }

    // VIDEO or child of VIDEO
    const vid = el.tagName === 'VIDEO' ? el : el.closest?.('video');
    if (vid) {
      const vsrc = vid.currentSrc || vid.src || vid.querySelector('source')?.src || null;
      const poster = vid.poster || null;
      const frame = tryFrame(vid);
      const thumbSrc = poster || frame;
      return mk('video', 'VIDEO', vsrc || thumbSrc, thumbSrc, vsrc, vid);
    }

    // SOURCE inside video
    if (el.tagName === 'SOURCE' && el.closest?.('video'))
      return detect(el.closest('video'));

    // YouTube thumbnail detection (img with ytimg.com src, or anchor with watch?v=)
    const ytThumb = detectYT(el);
    if (ytThumb) return mk('yt-thumb', 'YT THUMBNAIL', ytThumb, ytThumb, null, el);

    // CANVAS
    if (el.tagName === 'CANVAS')
      return mk('canvas', 'CANVAS', null, null, null, el);

    // SVG element (not inline SVG icons inside buttons)
    if (el.tagName === 'svg' && el.getAttribute('width') > 60)
      return mk('svg', 'SVG', null, null, null, el);

    // CSS background
    const bg = getBg(el) || getBg(el.parentElement);
    if (bg) return mk('image', 'BG IMAGE', bg, bg, null, el);

    return null;
  }

  function mk(type, label, src, thumbSrc, videoSrc, el) {
    return { type, label, src, thumbSrc, videoSrc, _el: el };
  }

  function getBg(el) {
    if (!el) return null;
    try {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none') {
        const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
        if (m && m[1] && !isSvgData(m[1])) return m[1];
      }
    } catch(_) {}
    return null;
  }

  function detectYT(el) {
    // img hosted on ytimg.com
    if (el.tagName === 'IMG') {
      const s = el.currentSrc || el.src || '';
      if (s.includes('ytimg.com') || s.includes('yt3.ggpht.com')) return s;
    }
    // ancestor anchor with ?v= param
    const a = el.closest?.('a[href*="watch?v="], a[href*="youtu.be/"]');
    if (a) {
      const id = extractYtId(a.href);
      if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    }
    return null;
  }

  function extractYtId(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes('youtube.com')) return u.searchParams.get('v');
      if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('?')[0];
    } catch(_) {}
    return null;
  }

  function tryFrame(vid) {
    try {
      if (!vid.videoWidth) return null;
      const c = document.createElement('canvas');
      c.width = vid.videoWidth; c.height = vid.videoHeight;
      c.getContext('2d').drawImage(vid, 0, 0);
      return c.toDataURL('image/jpeg', 0.82);
    } catch(_) { return null; }
  }

  function isSvgData(s) { return typeof s === 'string' && s.startsWith('data:image/svg'); }
  function isDataUri(s) { return typeof s === 'string' && s.startsWith('data:'); }

  // ── Render overlay ─────────────────────────────────────────────────────────
  function render(m) {
    const thumb   = document.getElementById('sl-thumb');
    const typeEl  = document.getElementById('sl-type');
    const nameEl  = document.getElementById('sl-name');
    const hintEl  = document.getElementById('sl-hint');
    const actions = document.getElementById('sl-actions');

    typeEl.textContent = m.label;
    nameEl.textContent = fname(m.src || m.thumbSrc, m.type);
    actions.innerHTML  = '';

    // Thumb preview
    if (m.thumbSrc) {
      const img = document.createElement('img');
      img.src = m.thumbSrc;
      img.onerror = () => { thumb.innerHTML = typeIconHTML(m.type); };
      thumb.innerHTML = ''; thumb.appendChild(img);
    } else {
      thumb.innerHTML = typeIconHTML(m.type);
    }

    const restricted = isRestricted();

    if (m.type === 'video') {
      // ── Two buttons: THUMB + VIDEO ────────────────────────────────────────
      const btnT = mkBtn('sl-btn-thumb', svgImg(),   'THUMB', false);
      const btnV = mkBtn('sl-btn-video', svgVideo(), 'VIDEO', false);

      // Is this a streaming/blob URL that can't be downloaded?
      const streaming = !m.videoSrc || isStreaming(m.videoSrc);

      if (streaming) {
        // Mark video btn as restricted but still clickable (will open in tab)
        const badge = document.createElement('div');
        badge.className = 'sl-badge'; badge.textContent = '!';
        btnV.appendChild(badge);
        btnV.title = 'Streaming video — will open in new tab';
      }

      btnT.addEventListener('click', ev => { ev.stopPropagation(); doThumb(m, btnT); });
      btnV.addEventListener('click', ev => { ev.stopPropagation(); doVideo(m, btnV); });

      actions.appendChild(btnT);
      actions.appendChild(btnV);
      hintEl.textContent = streaming
        ? 'Thumbnail ↓  ·  Video: frame or tab ↗'
        : 'Thumbnail or full video download';

    } else if (m.type === 'yt-thumb') {
      const btn = mkBtn('sl-btn-thumb', svgImg(), 'THUMB', false);
      btn.addEventListener('click', ev => { ev.stopPropagation(); doThumb(m, btn); });
      actions.appendChild(btn);
      hintEl.textContent = 'YouTube thumbnail';

    } else if (m.type === 'canvas') {
      const btn = mkBtn('sl-btn-img', svgImg(), 'PNG', false);
      btn.addEventListener('click', ev => { ev.stopPropagation(); doCanvas(m, btn); });
      actions.appendChild(btn);
      hintEl.textContent = 'Save canvas as PNG';

    } else if (m.type === 'svg') {
      const btn = mkBtn('sl-btn-thumb', svgImg(), 'SVG', false);
      btn.addEventListener('click', ev => { ev.stopPropagation(); doSvg(m, btn); });
      actions.appendChild(btn);
      hintEl.textContent = 'Download SVG';

    } else {
      // Plain image
      const btn = mkBtn('sl-btn-img', svgImg(), 'SAVE', false);
      btn.addEventListener('click', ev => { ev.stopPropagation(); doThumb(m, btn); });
      actions.appendChild(btn);
      hintEl.textContent = 'Click to download image';
    }
  }

  function mkBtn(cls, icon, lbl, disabled) {
    const b = document.createElement('button');
    b.className = `sl-btn ${cls}`;
    b.innerHTML = icon + `<span class="sl-btn-lbl">${lbl}</span>`;
    if (disabled) b.disabled = true;
    return b;
  }

  // ── Position ───────────────────────────────────────────────────────────────
  function position(el) {
    if (!overlay || !el) return;
    const r = el.getBoundingClientRect();
    const ow = overlay.offsetWidth  || 260;
    const oh = overlay.offsetHeight || 72;
    const gap = 10, sx = scrollX, sy = scrollY;

    let top  = r.bottom + sy + gap;
    let left = r.left   + sx;

    if (r.bottom + oh + gap > innerHeight) top = r.top + sy - oh - gap;
    if (left + ow > sx + innerWidth  - gap) left = sx + innerWidth  - ow - gap;
    if (left < sx + gap) left = sx + gap;

    overlay.style.position = 'absolute';
    overlay.style.top  = top  + 'px';
    overlay.style.left = left + 'px';
  }

  // ── Download actions ───────────────────────────────────────────────────────

  // Download thumbnail/image
  function doThumb(m, btn) {
    const url = m.thumbSrc || m.src;
    if (!url) { setState(btn, 'err'); return; }
    setState(btn, 'load');

    // data: URL — download directly in-page (no background needed)
    if (isDataUri(url)) {
      anchorDownload(url, `snapload-thumb-${Date.now()}.jpg`);
      setState(btn, 'done'); afterDone();
      return;
    }

    // blob: URL lives in this page's context — background cannot fetch it.
    // Instead, grab a frame from the video element if available, else open in tab.
    if (url.startsWith('blob:')) {
      const frame = m._el ? tryFrame(m._el) : null;
      if (frame) {
        anchorDownload(frame, `snapload-thumb-${Date.now()}.jpg`);
        setState(btn, 'done'); afterDone();
      } else {
        window.open(url, '_blank', 'noopener');
        setState(btn, 'done'); afterDone();
      }
      return;
    }

    // Normal HTTP(S) — let background fetch+download (bypasses CORS)
    chrome.runtime.sendMessage({
      action: 'fetchDownload',
      url,
      filename: `snapload-thumb-${Date.now()}.${ext(url) || 'jpg'}`,
      referer: location.href
    }, res => {
      if (res && res.success) {
        setState(btn, 'done'); afterDone();
      } else {
        // last resort anchor
        anchorDownload(url, `snapload-thumb-${Date.now()}.${ext(url) || 'jpg'}`);
        setState(btn, 'done'); afterDone();
      }
    });
  }

  // Download video — handles blob/stream/direct URLs
  function doVideo(m, btn) {
    const url = m.videoSrc;
    const vid  = m._el;

    setState(btn, 'load');

    // ── CASE 1: blob: URL (YouTube, Twitch, etc.) ──────────────────────────
    // blob: URLs are page-scoped; can't fetch them. Best we can do is capture
    // a high-quality frame from the live video element.
    if (!url || url.startsWith('blob:')) {
      const frame = vid ? tryFrame(vid) : null;
      if (frame) {
        anchorDownload(frame, `snapload-frame-${Date.now()}.jpg`);
        setState(btn, 'done'); afterDone();
      } else {
        // No frame either — open video page so user can use browser's built-in save
        window.open(location.href, '_blank', 'noopener');
        setState(btn, 'done'); afterDone();
      }
      return;
    }

    // ── CASE 2: HLS/DASH manifest — cannot download as a file ──────────────
    if (isManifest(url)) {
      // Capture a frame if the video is playing, otherwise open in tab
      const frame = vid ? tryFrame(vid) : null;
      if (frame) {
        anchorDownload(frame, `snapload-frame-${Date.now()}.jpg`);
        setState(btn, 'done'); afterDone();
      } else {
        window.open(url, '_blank', 'noopener');
        setState(btn, 'done'); afterDone();
      }
      return;
    }

    // ── CASE 3: Direct video file (mp4, webm, ogg, etc.) ──────────────────
    // Route through background service worker (fetch → dataURL → chrome.downloads)
    // which bypasses CORS and produces a proper file in Downloads.
    chrome.runtime.sendMessage({
      action: 'fetchDownload',
      url,
      filename: `snapload-video-${Date.now()}.${ext(url) || 'mp4'}`,
      referer: location.href
    }, res => {
      if (res && res.success) {
        setState(btn, 'done'); afterDone();
      } else {
        // Fallback: force anchor download (works for same-origin or permissive CDNs)
        anchorDownload(url, `snapload-video-${Date.now()}.${ext(url) || 'mp4'}`);
        setState(btn, 'done'); afterDone();
      }
    });
  }

  // Separate manifest check (does NOT treat blob: as streaming — that's handled above)
  function isManifest(url) {
    if (!url) return false;
    const u = url.toLowerCase();
    return u.includes('.m3u8') || u.includes('.mpd') || u.includes('/manifest') || u.includes('googlevideo.com');
  }

  function doCanvas(m, btn) {
    try {
      m._el.toBlob(blob => {
        if (!blob) { setState(btn, 'err'); return; }
        const u = URL.createObjectURL(blob);
        anchorDownload(u, `snapload-canvas-${Date.now()}.png`);
        setTimeout(() => URL.revokeObjectURL(u), 5000);
        setState(btn, 'done'); afterDone();
      }, 'image/png');
    } catch(_) { setState(btn, 'err'); }
  }

  function doSvg(m, btn) {
    try {
      const str = new XMLSerializer().serializeToString(m._el);
      const blob = new Blob([str], { type: 'image/svg+xml' });
      const u = URL.createObjectURL(blob);
      anchorDownload(u, `snapload-svg-${Date.now()}.svg`);
      setTimeout(() => URL.revokeObjectURL(u), 5000);
      setState(btn, 'done'); afterDone();
    } catch(_) { setState(btn, 'err'); }
  }

  function openStream(url) {
    window.open(url || location.href, '_blank', 'noopener');
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function anchorDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.documentElement.appendChild(a);
    a.click(); a.remove();
  }

  function isStreaming(url) {
    if (!url) return true;
    if (url.startsWith('blob:')) return true;
    return isManifest(url);
  }

  function ext(url) {
    try {
      const p = new URL(url, location.href).pathname;
      const e = p.split('.').pop().split('?')[0].toLowerCase();
      if (['jpg','jpeg','png','gif','webp','avif','mp4','webm','ogg','mov','avi','svg'].includes(e)) return e;
    } catch(_) {}
    return null;
  }

  function fname(url, type) {
    if (!url) return { image:'image.jpg', video:'video.mp4', canvas:'canvas.png', svg:'file.svg' }[type] || 'file';
    try {
      const p = new URL(url, location.href).pathname;
      const n = decodeURIComponent(p.split('/').pop().split('?')[0]);
      if (n && n.includes('.')) return n.length > 34 ? n.slice(0,32)+'…' : n;
    } catch(_) {}
    return `snapload.${ext(url)||'jpg'}`;
  }

  function setState(btn, s) {
    btn.classList.remove('sl-loading','sl-done','sl-err');
    const lbl = btn.querySelector('.sl-btn-lbl');
    if (s === 'load') {
      btn.classList.add('sl-loading');
      btn.innerHTML = svgSpin() + `<span class="sl-btn-lbl">…</span>`;
    } else if (s === 'done') {
      btn.classList.add('sl-done');
      btn.innerHTML = svgCheck() + `<span class="sl-btn-lbl">DONE</span>`;
    } else {
      btn.classList.add('sl-err');
      btn.innerHTML = svgX() + `<span class="sl-btn-lbl">ERR</span>`;
    }
  }

  function afterDone() { setTimeout(() => queueHide(2000), 400); }

  // ── SVG icons ──────────────────────────────────────────────────────────────
  function svgImg()   { return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`; }
  function svgVideo() { return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`; }
  function svgSpin()  { return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:sl-spin .7s linear infinite"><path d="M21 12a9 9 0 1 1-6.22-8.56"/></svg>`; }
  function svgCheck() { return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`; }
  function svgX()     { return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`; }

  function typeIconHTML(type) {
    const colors = { video:'#fca5a5', image:'#c4c0ff', canvas:'#fcd34d', svg:'#a78bfa' };
    const icons  = { video: svgVideo(), image: svgImg(), canvas: svgImg(), svg: svgImg() };
    const c = colors[type] || colors.image;
    const i = icons[type]  || icons.image;
    const colored = i.replace('stroke-width', `stroke="${c}" stroke-width`);
    return `<div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;">${colored}</div>`;
  }

})();
