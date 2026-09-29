const CACHE = "devamsizlik-v3";
const ASSETS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  const font = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (!same && !font) return;

  const page = same && (req.mode === "navigate" || url.pathname.endsWith("/") || url.pathname.endsWith("/index.html"));

  if (page) {
    // Sayfa: önce internet (her zaman en yeni sürüm), internet yoksa kayıtlı kopya
    e.respondWith(
      fetch(url.href, { cache: "no-store", credentials: "same-origin" }).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copy));
        }
        return res;
      }).catch(() => caches.open(CACHE).then(c => c.match("./index.html").then(h => h || c.match("./"))))
    );
    return;
  }

  // İkon, font vb.: önce kayıtlı kopya, arkada güncelle
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(hit => {
        const net = fetch(req).then(res => {
          if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    )
  );
});

// Bildirim: gelen duyuruyu göster (iPhone her bildirimin gösterilmesini şart koşuyor)
self.addEventListener("push", e => {
  let p = {};
  try { p = e.data ? e.data.json() : {}; } catch (_) { p = { data: { body: e.data ? e.data.text() : "" } }; }
  const d = p.data || {}, n = p.notification || {};
  const title = n.title || d.title || "Devamsızlık";
  const body = n.body || d.body || "";
  const url = d.url || "./";
  e.waitUntil(self.registration.showNotification(title, {
    body, icon: "icon-192.png", data: { url }, tag: "duyuru-" + (p.fcmMessageId || Date.now())
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "./";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) { if ("focus" in c) return c.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
