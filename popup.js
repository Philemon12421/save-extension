// SnapLoad Popup v2.1

const RESTRICTED = {
  'youtube.com':   { name:'YouTube',       warn:'YouTube uses adaptive streaming (HLS). Thumbnails download fine; full video files require a dedicated tool like yt-dlp.' },
  'instagram.com': { name:'Instagram',     warn:'Instagram restricts media downloads. Thumbnails work; video streams are protected.' },
  'tiktok.com':    { name:'TikTok',        warn:'TikTok protects video streams. Thumbnails download fine; videos may open in a new tab.' },
  'snapchat.com':  { name:'Snapchat',      warn:'Snapchat restricts media access. Only publicly visible thumbnails can be saved.' },
  'facebook.com':  { name:'Facebook',      warn:'Facebook encrypts video streams. Thumbnails work; full video downloads may not complete.' },
  'x.com':         { name:'X / Twitter',   warn:'X/Twitter video streams are protected. Preview images and thumbnails download fine.' },
  'twitter.com':   { name:'X / Twitter',   warn:'Twitter video streams are protected. Preview images and thumbnails download fine.' },
  'google.com':    { name:'Google',        warn:null },
};

const SITE_MAP = {
  'youtube.com':'youtube.com','youtu.be':'youtube.com',
  'instagram.com':'instagram.com','tiktok.com':'tiktok.com',
  'snapchat.com':'snapchat.com','facebook.com':'facebook.com','fb.com':'facebook.com',
  'x.com':'x.com','twitter.com':'x.com','google.com':'google.com',
};

const DEFAULT_SITES = {
  'youtube.com':true,'instagram.com':true,'tiktok.com':true,
  'snapchat.com':true,'facebook.com':true,'x.com':true,'twitter.com':true,'google.com':true
};

let ST = { enabled:true, sites:{...DEFAULT_SITES}, customSites:{} };
let curHost = '', curKey = '';

// ── Load ───────────────────────────────────────────────────────────────────
async function load() {
  const s = await chrome.storage.sync.get(['enabled','sites','customSites']);
  ST.enabled    = s.enabled !== false;
  ST.sites      = { ...DEFAULT_SITES, ...(s.sites||{}) };
  ST.customSites = s.customSites || {};

  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  if (tab?.url) {
    try {
      const u = new URL(tab.url);
      curHost = u.hostname.replace(/^www\./,'');
      curKey  = resolveKey(curHost);
    } catch(_) {}
  }
  renderAll();
}

function save() {
  chrome.storage.sync.set({ enabled:ST.enabled, sites:ST.sites, customSites:ST.customSites });
  chrome.tabs.query({ active:true, currentWindow:true }, tabs => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action:'stateUpdate',
        enabled: ST.enabled,
        siteEnabled: isSiteOn(curHost)
      }).catch(()=>{});
    }
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────
function resolveKey(h) {
  for (const [k,v] of Object.entries(SITE_MAP))
    if (h===k || h.endsWith('.'+k)) return v;
  return null;
}

function isSiteOn(h) {
  if (!h) return true;
  if (ST.customSites[h] !== undefined) return ST.customSites[h];
  const k = resolveKey(h);
  if (k) return ST.sites[k] !== false;
  return true;
}

// ── Render ─────────────────────────────────────────────────────────────────
function renderAll() {
  renderMaster();
  renderCurrentSite();
  renderRows();
  renderAddSite();
}

const EMOJIS = {
  'youtube.com':'▶️','instagram.com':'📸','tiktok.com':'🎵',
  'snapchat.com':'👻','facebook.com':'👍','x.com':'𝕏',
  'twitter.com':'𝕏','google.com':'🔍'
};

function renderCurrentSite() {
  const fav    = document.getElementById('siteFav');
  const domain = document.getElementById('siteDomain');
  const stat   = document.getElementById('siteStat');
  const tog    = document.getElementById('siteToggle');
  const card   = document.getElementById('siteCard');
  const nWrap  = document.getElementById('noticeWrap');
  const nTitle = document.getElementById('noticeTitle');
  const nBody  = document.getElementById('noticeBody');

  if (!curHost) {
    domain.textContent = 'No site detected';
    stat.textContent   = 'Open a webpage first';
    return;
  }

  domain.textContent = curHost;
  fav.textContent    = EMOJIS[curKey] || curHost.charAt(0).toUpperCase();

  const on = isSiteOn(curHost);
  tog.checked = on;
  card.classList.toggle('active', on && ST.enabled);

  if (!ST.enabled) {
    stat.textContent = 'Extension is globally off';
    stat.className   = 'site-status warn';
  } else if (on) {
    stat.textContent = '✓ SnapLoad active here';
    stat.className   = 'site-status on';
  } else {
    stat.textContent = '✗ Disabled for this site';
    stat.className   = 'site-status off';
  }

  // Highlight matching row + add HERE tag
  document.querySelectorAll('.site-row').forEach(r => {
    r.classList.remove('here');
    r.querySelector('.here-tag')?.remove();
  });
  if (curKey) {
    const row = document.querySelector(`.site-row[data-key="${curKey}"]`);
    if (row) {
      row.classList.add('here');
      // dot
      const dk = curKey.split('.')[0];
      const dot = document.getElementById('d-'+dk);
      if (dot) dot.className = 's-dot here-dot';
      // tag
      const tag = document.createElement('span');
      tag.className = 'here-tag'; tag.textContent = 'HERE';
      const sw = row.querySelector('label');
      row.insertBefore(tag, sw);
    }
  }

  // Notice for restricted sites
  const info = RESTRICTED[curKey];
  if (info && info.warn) {
    nWrap.classList.remove('hidden');
    nTitle.textContent = `${info.name} restricts media`;
    nBody.textContent  = ' ' + info.warn;
  } else {
    nWrap.classList.add('hidden');
  }
}

function renderMaster() {
  const card  = document.getElementById('masterCard');
  const lbl   = document.getElementById('masterLbl');
  const desc  = document.getElementById('masterDesc');
  const dot   = document.getElementById('liveDot');
  const dlbl  = document.getElementById('liveLbl');
  const tog   = document.getElementById('masterToggle');

  tog.checked = ST.enabled;
  if (ST.enabled) {
    card.className='master-card on'; lbl.textContent='SnapLoad Active';
    desc.textContent='Hover any media to download';
    dot.className='live-dot on'; dlbl.className='live-lbl on';
    dlbl.textContent='Running on this page';
  } else {
    card.className='master-card off'; lbl.textContent='SnapLoad Disabled';
    desc.textContent='Enable to start downloading media';
    dot.className='live-dot warn'; dlbl.className='live-lbl warn';
    dlbl.textContent='Disabled — toggle to activate';
  }
}

function renderRows() {
  document.querySelectorAll('.sc').forEach(cb => {
    const k = cb.dataset.key;
    const on = ST.sites[k] !== false;
    cb.checked = on;
    const name = k.split('.')[0];
    const dot  = document.getElementById('d-'+name);
    if (dot && dot.className !== 's-dot here-dot') {
      dot.className = 's-dot' + (on?' on':'');
    }
    cb.closest('.site-row').classList.toggle('enabled', on);
  });
}

function renderAddSite() {
  const sec   = document.getElementById('addSiteSec');
  const title = document.getElementById('addTitle');
  const sub   = document.getElementById('addSub');

  // Hide if current site is a known site
  if (curKey) { sec.classList.add('hidden'); return; }
  sec.classList.remove('hidden');

  if (curHost) {
    const already = ST.customSites[curHost] === true;
    title.textContent = already ? '✓ Enabled on this site' : 'Enable on current site';
    sub.textContent   = curHost || 'Grant SnapLoad access here';
  }
}

// ── Events ─────────────────────────────────────────────────────────────────
document.getElementById('masterToggle').addEventListener('change', e => {
  ST.enabled = e.target.checked; save(); renderAll();
});

document.getElementById('siteToggle').addEventListener('change', e => {
  const on = e.target.checked;
  if (curKey)  ST.sites[curKey] = on;
  else if (curHost) ST.customSites[curHost] = on;
  // Sync twitter.com ↔ x.com
  if (curKey === 'x.com')      ST.sites['twitter.com'] = on;
  if (curKey === 'twitter.com') ST.sites['x.com']      = on;
  save(); renderAll();
});

document.querySelectorAll('.sc').forEach(cb => {
  cb.addEventListener('change', e => {
    const k = e.target.dataset.key;
    ST.sites[k] = e.target.checked;
    if (k === 'x.com')       ST.sites['twitter.com'] = e.target.checked;
    if (k === 'twitter.com') ST.sites['x.com']       = e.target.checked;
    save(); renderRows(); renderCurrentSite();
  });
});

document.getElementById('addBtn').addEventListener('click', e => {
  e.preventDefault();
  if (!curHost) return;
  ST.customSites[curHost] = true;
  save(); renderAll();
});

load();
