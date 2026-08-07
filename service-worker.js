/* ============================================================
   ARML — Service Worker

   DO NOT hand-edit BUILD_ID or SHELL_FILES below. Both are
   stamped automatically by ARM-Builder/build-data.js on every
   build. Because BUILD_ID changes on every build, this file
   changes byte-wise every build, which is what makes the
   browser notice there's a new service worker at all.

   This replaces the old manual "bump CACHE_NAME by hand" step,
   which was the single most common cause of "I made a change
   but nothing looks different."

   TWO CACHES, on purpose:
     arml-shell-<BUILD_ID>  App code. Replaced every build.
     arml-assets-v1         PDFs. Deliberately NOT versioned, so
                            a content update doesn't wipe every
                            PDF a medic downloaded for offline use.
   ============================================================ */

const BUILD_ID = '3.0.1+dc738015cf61';
const SHELL_FILES = [
  "index.html",
  "style.css",
  "app.js",
  "data.js",
  "manifest.json",
  "version.json",
  "insurance-guide-text.js",
  "icons/icon-180.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/slp-patch-small.png",
  "icons/slp-patch.ico",
  "icons/slp-patch.png",
  "icons/waypoint-icon.svg",
  "icons/ysn-icon.svg"
];

const SHELL_CACHE = `arml-shell-${BUILD_ID}`;
const ASSET_CACHE = 'arml-assets-v1';

/* Always checked against the network first, so a published update actually
   reaches an already-installed app instead of being masked forever by the
   cache. Cached copies still serve the moment the network isn't there. */
const NETWORK_FIRST = ['version.json', 'data.js'];

function isNetworkFirst(url) {
  return NETWORK_FIRST.some(name => url.pathname.endsWith(name));
}

function isAsset(url) {
  return /\/Assets\//i.test(url.pathname);
}

/* ---- Install: precache the app shell ---- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

/* ---- Activate: drop stale SHELL caches only ----
   The asset cache is left alone on purpose - see header comment. */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k.startsWith('arml-shell-') && k !== SHELL_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ---- Fetch ---- */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* Never intercept cross-origin requests (Apple Maps, Hennepin Waypoint,
     resource websites). Caching opaque cross-origin responses just fills
     storage with things we can't read or validate anyway. */
  if (url.origin !== self.location.origin) return;

  /* --- Network-first: version.json, data.js --- */
  if (isNetworkFirst(url)) {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req).then(hit => hit || Promise.reject('offline, not cached')))
    );
    return;
  }

  /* --- Assets (PDFs): cache-first, stored in the durable asset cache --- */
  if (isAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(cache =>
        cache.match(req).then(cached => {
          if (cached) return cached;
          return fetch(req).then(res => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  /* --- Everything else (shell): cache-first --- */
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req)
        .then(res => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then(c => c.put(req, clone));
          }
          return res;
        })
        .catch(() => {
          if (req.mode === 'navigate') return caches.match('index.html');
          return Promise.reject('offline, not cached');
        });
    })
  );
});

/* ---- Messages from the page ----
   PRECACHE_ALL is what the Update button uses: it walks the generated
   assets-manifest.json and downloads EVERY PDF, so a medic has the whole
   library offline instead of only the files they happened to open before
   losing signal. Progress is reported back so the UI can show it. */
self.addEventListener('message', event => {
  const msg = event.data || {};

  if (msg.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (msg.type === 'PRECACHE_ALL') {
    event.waitUntil(precacheAll());
  }
});

async function postAll(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach(c => c.postMessage(message));
}

async function precacheAll() {
  try {
    const manifestRes = await fetch('assets-manifest.json', { cache: 'no-store' });
    if (!manifestRes.ok) throw new Error('Could not load assets-manifest.json');
    const manifest = await manifestRes.json();

    const shell = manifest.shell || [];
    const assets = manifest.assets || [];
    const total = shell.length + assets.length;
    let done = 0;
    const failed = [];

    const shellCache = await caches.open(SHELL_CACHE);
    const assetCache = await caches.open(ASSET_CACHE);

    /* Sequential rather than parallel on purpose: a station Wi-Fi handing
       100+ PDFs to an iPad all at once is a good way to get half of them to
       time out. Slower and complete beats faster and partial. */
    const groups = [
      { files: shell, cache: shellCache },
      { files: assets, cache: assetCache }
    ];

    for (const group of groups) {
      for (const file of group.files) {
        try {
          const res = await fetch(file, { cache: 'no-store' });
          if (res && res.ok) {
            await group.cache.put(file, res.clone());
          } else {
            failed.push(file);
          }
        } catch (e) {
          failed.push(file);
        }
        done++;
        await postAll({ type: 'PRECACHE_PROGRESS', done, total });
      }
    }

    await postAll({ type: 'PRECACHE_DONE', total, failed });
  } catch (err) {
    await postAll({
      type: 'PRECACHE_ERROR',
      message: String(err && err.message ? err.message : err)
    });
  }
}
