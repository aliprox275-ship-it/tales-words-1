/* تطبيق القراءة — Service Worker
   - التثبيت: يخزّن هيكل التطبيق فقط (الصفحة + manifest + الأيقونات).
     لا توجد ملفات صوت بعد الآن — القراءة بصوت الجهاز (TTS) فقط،
     فلا كاش وسائط (reading-media) ولا تخزين mp3 إطلاقًا.
   - التشغيل: network-first للصفحة وكل ملفات الأصل نفسه؛ النسخة
     المخزّنة تُقدَّم عند الانقطاع فيعمل التطبيق أوفلاين.
   - التحديث: كاش مُصدَر؛ النسخة الجديدة تحذف كل الكاشات القديمة
     بأسمائها السابقة (reading-shell-v1/v2 و reading-media-v1/v2)
     فيُمسح أي mp3 مخزّن قديمًا من أجهزة المستخدمين، وتُفعّل نفسها
     (skipWaiting + clients.claim) فيتحدث التطبيق المثبت تلقائيًا. */

var VERSION = "v6";
var SHELL_CACHE = "reading-shell-" + VERSION;

var SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/manifest.webmanifest",
  "./robots.txt",
  "./sitemap.xml",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(SHELL_FILES);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== SHELL_CACHE) {
          return caches.delete(key);
        }
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

function networkFirst(request, cacheName) {
  return fetch(request).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      caches.open(cacheName).then(function (cache) { cache.put(request, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(request, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      if (request.mode === "navigate") return caches.match("./index.html");
      return hit;
    });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(request, SHELL_CACHE));
});
