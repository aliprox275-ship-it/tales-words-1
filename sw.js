/* تطبيق القراءة — Service Worker
   - التثبيت: يخزّن هيكل التطبيق فقط (الصفحة + manifest + الأيقونات).
   - الصوت المسجل (A1 + A2): حزم audio-a1-bundles/ و audio-a2-bundles/ و
     audio-conv-bundles/ و audio-exam/ — تُخزَّن كاملة في كاش صوت مستقل
     (reading-audio-v1) وتُقدَّم طلبات Range منها:
     * عند التشغيل أونلاين: أول مرة تُنزَّل الحزمة كاملة وتُحفظ، وبعدها
       كل المقاطع منها تُقدَّم من الكاش.
     * زر «تحميل الصوت للاستخدام بدون نت» بالصفحة ينزّل كل الحزم (886 ملف،
       526 ميغا) مرة واحدة على واي فاي.
     * أوفلاين: أي حزمة محفوظة تشتغل؛ واللي ما انحفظت يرجع صوت الجهاز.
     (السبب: Cache API ما يقبل تخزين ردود 206 الجزئية، فلازم نخزّن الملف
     الكامل ونقطّع منه.)
   - التشغيل: network-first للصفحة والتنقلات؛ والأصول الثابتة
     (الصور والأيقونات والـmanifest) بـ stale-while-revalidate:
     تُقدَّم من الكاش فورًا وتُحدَّث بالخلفية. عند الانقطاع تُقدَّم
     النسخة المخزّنة فيعمل التطبيق أوفلاين.
   - التحديث: كاش مُصدَر؛ النسخة الجديدة تحذف كل الكاشات القديمة
     بأسمائها السابقة ما عدا كاش الصوت (حتى لا يُمسح الـ 526 ميغا
     عند كل تحديث للهيكل)، وتُفعّل نفسها (skipWaiting + clients.claim)
     فيتحدث التطبيق المثبت تلقائيًا. */

var VERSION = "v18";
var SHELL_CACHE = "reading-shell-" + VERSION;
var AUDIO_CACHE = "reading-audio-v1";

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
        // نحذف كل كاش قديم ما عدا كاش الهيكل الحالي وكاش الصوت
        // (كاش الصوت يُحفظ حتى لا يُعاد تنزيل الـ 526 ميغا عند كل تحديث)
        if (key !== SHELL_CACHE && key !== AUDIO_CACHE) {
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

/* ---- الصوت أوفلاين (v18) ----
   المشغّل يطلب مقطعًا صغيرًا من حزمة كبيرة عبر Range، والـ Cache API
   يرفض تخزين رد 206 جزئي. الحل: نخزّن الملف الكامل، ونقطّع منه Range. */
function parseRange(header, total) {
  var m = /^bytes=(\d*)-(\d*)$/.exec(header || "");
  if (!m) return null;
  var start, end;
  if (m[1] === "" && m[2] !== "") {
    var n = parseInt(m[2], 10);
    if (isNaN(n) || n <= 0) return null;
    start = Math.max(0, total - n);
    end = total - 1;
  } else {
    start = m[1] === "" ? 0 : parseInt(m[1], 10);
    end = m[2] === "" ? total - 1 : parseInt(m[2], 10);
    if (isNaN(start) || isNaN(end)) return null;
    if (start > end || start >= total) return null;
    if (end >= total) end = total - 1;
  }
  return { start: start, end: end };
}

function serveFromBuffer(res, rangeHeader) {
  return res.arrayBuffer().then(function (buf) {
    var total = buf.byteLength;
    if (!rangeHeader) {
      return new Response(buf, { status: 200, headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(total),
        "Accept-Ranges": "bytes"
      } });
    }
    var r = parseRange(rangeHeader, total);
    if (!r) {
      return new Response(null, { status: 416, headers: { "Content-Range": "bytes */" + total } });
    }
    var slice = buf.slice(r.start, r.end + 1);
    return new Response(slice, { status: 206, headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(r.end - r.start + 1),
      "Content-Range": "bytes " + r.start + "-" + r.end + "/" + total,
      "Accept-Ranges": "bytes"
    } });
  });
}

function audioResponse(request) {
  var url = request.url;
  var rangeHeader = request.headers.get("Range");
  return caches.open(AUDIO_CACHE).then(function (cache) {
    return cache.match(url, { ignoreSearch: true }).then(function (hit) {
      if (hit) return serveFromBuffer(hit, rangeHeader);
      return fetch(url).then(function (res) {
        if (!res || !res.ok) return res;
        var copy = res.clone();
        cache.put(url, copy).catch(function () {});
        return serveFromBuffer(res, rangeHeader);
      });
    });
  });
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return; // خطوط Google وغيرها تمر كما هي

  /* v18: حزم الصوت تُخدَّم من كاش الصوت (ملف كامل + تقطيع Range).
     أول تشغيل أونلاين ينزّل الحزمة كاملة ويحفظها؛ أوفلاين تُقدَّم
     المحفوظة، واللي ما انحفظت ترجع 503 فيتحول المشغّل لصوت الجهاز. */
  if (url.pathname.indexOf("/audio-a1-bundles/") === 0 || url.pathname.indexOf("/audio-a2-bundles/") === 0 || url.pathname.indexOf("/audio-exam/") === 0 || url.pathname.indexOf("/audio-conv-bundles/") === 0) {
    event.respondWith(audioResponse(request).catch(function () {
      return new Response(null, { status: 503 });
    }));
    return;
  }

  var isAsset = /\.(webp|png|jpg|jpeg|svg|gif|ico|webmanifest)$/.test(url.pathname);
  event.respondWith(isAsset ? staleWhileRevalidate(request, SHELL_CACHE)
                            : networkFirst(request, SHELL_CACHE));
});
