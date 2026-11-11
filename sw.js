/* تطبيق القراءة — Service Worker v19 (Obelisk redesign)
   - التثبيت: يخزّن هيكل التطبيق فقط (الصفحة + manifest + الأيقونات).
   - الصوت المسجل (Obelisk): حزم Opus تحت audio-obelisk/ — أسماؤها تحمل
     بصمة محتوى (hash) فلا يمكن أن تُقدَّم نسخة قديمة أبدًا. تُخزَّن كاملة
     في كاش صوت مُصدَر (tw-audio-v19) وتُقدَّم طلبات Range منها:
     * عند التشغيل أونلاين: أول مرة تُنزَّل الحزمة كاملة وتُحفظ، وبعدها
       كل المقاطع منها تُقدَّم من الكاش.
     * زر «تحميل الصوت للاستخدام بدون نت» بالصفحة ينزّل كل الحزم
       (114 ملف، ~250 ميغا) مرة واحدة على واي فاي.
     * أوفلاين: أي حزمة محفوظة تشتغل؛ واللي ما انحفظت يرجع صوت الجهاز.
     (السبب: Cache API ما يقبل تخزين ردود 206 الجزئية، فلازم نخزّن الملف
     الكامل ونقطّع منه.)
   - الـ manifest (audio-obelisk/manifest-<lang>.json): network-first،
     لأنه يتحدث عند كل إعادة تسجيل.
   - التشغيل: network-first للصفحة والتنقلات؛ والأصول الثابتة
     (الصور والأيقونات والـmanifest) بـ stale-while-revalidate.
   - التحديث: كاش مُصدَر؛ النسخة الجديدة تحذف كل الكاشات القديمة
     بأسمائها السابقة — بما فيها كاش الصوت القديم (reading-audio-v1،
     572 ميغا من الحزم القديمة) لأن النظام الجديد لا يستخدمه أبدًا —
     وتُفعّل نفسها (skipWaiting + clients.claim). */

var VERSION = "v19";
var SHELL_CACHE = "reading-shell-" + VERSION;
var AUDIO_CACHE = "tw-audio-" + VERSION;

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
        // v19: نحذف كل كاش قديم ما عدا كاش الهيكل الحالي وكاش الصوت الجديد.
        // كاش الصوت القديم (reading-audio-v1) يُحذف عمدًا: النظام الجديد
        // لا يطلب الحزم القديمة أبدًا، فيتحرر ~572 ميغا من الهاتف.
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
   تُقدَّم نسخة الكاش فورًا وتُحدَّث من الشبكة في الخلفية. */
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

/* ---- الصوت أوفلاين (v19) ----
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

function audioContentType(url) {
  if (url.indexOf(".opus") !== -1) return "audio/ogg";
  return "audio/mpeg";
}

function serveFromBuffer(res, rangeHeader, url) {
  return res.arrayBuffer().then(function (buf) {
    var total = buf.byteLength;
    var ct = audioContentType(url || "");
    if (!rangeHeader) {
      return new Response(buf, { status: 200, headers: {
        "Content-Type": ct,
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
      "Content-Type": ct,
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
      if (hit) return serveFromBuffer(hit, rangeHeader, url);
      return fetch(url).then(function (res) {
        if (!res || !res.ok) return res;
        var copy = res.clone();
        cache.put(url, copy).catch(function () {});
        return serveFromBuffer(res, rangeHeader, url);
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

  /* v19: حزم Obelisk (audio-obelisk/*.opus) تُخدَّم من كاش الصوت
     (ملف كامل + تقطيع Range). أسماؤها تحمل بصمة محتوى فالكاش آمن.
     ملفات الـ manifest (JSON) تُخدَّم network-first لأنها تتحدث. */
  if (url.pathname.indexOf("/audio-obelisk/") === 0) {
    if (/\.json$/.test(url.pathname)) {
      event.respondWith(networkFirst(request, SHELL_CACHE));
      return;
    }
    event.respondWith(audioResponse(request).catch(function () {
      return new Response(null, { status: 503 });
    }));
    return;
  }

  var isAsset = /\.(webp|png|jpg|jpeg|svg|gif|ico|webmanifest)$/.test(url.pathname);
  event.respondWith(isAsset ? staleWhileRevalidate(request, SHELL_CACHE)
                            : networkFirst(request, SHELL_CACHE));
});
