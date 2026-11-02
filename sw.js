/* تطبيق القراءة — Service Worker
   - التثبيت: يخزّن هيكل التطبيق فقط (الصفحة + manifest + الأيقونات).
   - الصوت المسجل (A1 + A2): ملفات audio-a1-bundles/ و audio-a2-bundles/
     لا تُعترض ولا تُخزَّن إطلاقًا في v7 — طلباتها تذهب مباشرة إلى الشبكة (fetch) بلا
     cache.put، لأن تخزين استجابات Range الجزئية كان يُفسد التشغيل
     (تكرار/توقف) داخل الحزم الكبيرة.
   - التشغيل: network-first للصفحة والتنقلات؛ والأصول الثابتة
     (الصور والأيقونات والـmanifest) بـ stale-while-revalidate:
     تُقدَّم من الكاش فورًا وتُحدَّث بالخلفية. عند الانقطاع تُقدَّم
     النسخة المخزّنة فيعمل التطبيق أوفلاين.
   - التحديث: كاش مُصدَر؛ النسخة الجديدة تحذف كل الكاشات القديمة
     بأسمائها السابقة (reading-shell-v1/v2 و reading-media-v1/v2)
     فيُمسح أي mp3 مخزّن قديمًا من أجهزة المستخدمين، وتُفعّل نفسها
     (skipWaiting + clients.claim) فيتحدث التطبيق المثبت تلقائيًا. */

var VERSION = "v9";
var SHELL_CACHE = "reading-shell-" + VERSION;

var SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/manifest.webmanifest",
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
        // كل كاش غير الكاش الحالي يُحذف: يشمل أسماء الإصدارات السابقة
        // كلها (reading-shell-v1، reading-shell-v2، reading-media-v1،
        // reading-media-v2) وما خُزّن فيها من ملفات mp3 قديمة.
        if (key !== SHELL_CACHE) {
          return caches.delete(key);
        }
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* Network-first: نسخة حديثة عند الاتصال تُخزَّن في كاش الهيكل،
   ونسخة الكاش عند الانقطاع. */
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

/* Stale-while-revalidate للأصول الثابتة (صور/أيقونات/manifest):
   تُقدَّم نسخة الكاش فورًا وتُحدَّث من الشبكة في الخلفية،
   فتظهر الأغلفة لحظيًا عند تكرار الزيارة حتى على اتصال بطيء. */
function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request, { ignoreSearch: true }).then(function (hit) {
      var network = fetch(request).then(function (res) {
        if (res && res.ok) cache.put(request, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || network;
    });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return; // خطوط Google وغيرها تمر كما هي

  /* v7: audio bundles bypass the service worker entirely -- range
     requests go straight to the network, never cached, never rewritten.
     Covers both A1 and A2 bundle roots, plus exam audio. */
  if (url.pathname.indexOf("/audio-a1-bundles/") === 0 || url.pathname.indexOf("/audio-a2-bundles/") === 0 || url.pathname.indexOf("/audio-exam/") === 0) {
    event.respondWith(fetch(request));
    return;
  }

  var isAsset = /\.(webp|png|jpg|jpeg|svg|gif|ico|webmanifest)$/.test(url.pathname);
  event.respondWith(isAsset ? staleWhileRevalidate(request, SHELL_CACHE)
                            : networkFirst(request, SHELL_CACHE));
});
