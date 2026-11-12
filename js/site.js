// Menu, language picker and the "this page is also in your language" hint. No tracking.
(function () {
  var toggle = document.querySelector("[data-menu]");
  var nav = document.getElementById("nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  var select = document.querySelector("[data-lang-select]");
  if (select) {
    select.addEventListener("change", function () {
      try { localStorage.setItem("ca-lang-chosen", "1"); } catch (e) {}
      window.location.href = select.value;
    });
  }

  // Suggest the visitor's language once, never redirect: search engines and shared links must
  // always land where they point.
  var hint = document.querySelector("[data-lang-hint]");
  if (!hint) return;
  try { if (localStorage.getItem("ca-lang-chosen")) return; } catch (e) {}
  var hints = {};
  try { hints = JSON.parse(hint.getAttribute("data-hints") || "{}"); } catch (e) { return; }
  var links = {};
  document.querySelectorAll('link[rel="alternate"][hreflang]').forEach(function (l) {
    links[l.getAttribute("hreflang").toLowerCase()] = l.getAttribute("href");
  });
  var wanted = (navigator.languages || [navigator.language || ""]).map(function (x) { return x.toLowerCase(); });
  var current = document.documentElement.lang.toLowerCase();
  for (var i = 0; i < wanted.length; i++) {
    var w = wanted[i];
    var base = w.split("-")[0];
    if (w === current || base === current.split("-")[0]) return; // already in a language they read
    var match = Object.keys(hints).filter(function (k) {
      var kl = k.toLowerCase();
      return kl === w || kl.split("-")[0] === base;
    })[0];
    if (match && links[match.toLowerCase()]) {
      var h = hints[match];
      var target = new URL(links[match.toLowerCase()], window.location.href);
      hint.innerHTML = '<div class="wrap"><span></span><button type="button"></button></div>';
      var span = hint.querySelector("span");
      span.textContent = h.text + " ";
      var a = document.createElement("a");
      a.href = target.pathname;
      a.textContent = h.link + " →";
      a.addEventListener("click", function () { try { localStorage.setItem("ca-lang-chosen", "1"); } catch (e) {} });
      span.appendChild(a);
      var close = hint.querySelector("button");
      close.textContent = "×";
      close.setAttribute("aria-label", h.close);
      close.addEventListener("click", function () {
        hint.classList.remove("show");
        try { localStorage.setItem("ca-lang-chosen", "1"); } catch (e) {}
      });
      hint.classList.add("show");
      return;
    }
  }
})();

// Analytics (D-162). Only present when the build sets GA_MEASUREMENT_ID (body[data-ga]).
// Visitors in a European time zone (EU, UK, Switzerland, Turkey...) are asked first and Google's
// script is not even loaded until they accept; elsewhere it loads straight away. The choice lives
// in localStorage and can be changed from the footer. window.caTrack(name, params) is always
// defined so pages can call it; without analytics it does nothing.
(function () {
  window.caTrack = function (name, params) { if (window.gtag) window.gtag("event", name, params || {}); };
  var body = document.body;
  var id = body.getAttribute("data-ga");
  if (!id) return;
  var strings = {};
  try { strings = JSON.parse(body.getAttribute("data-consent") || "{}"); } catch (e) {}
  var lang = document.documentElement.lang;
  var KEY = "ca-consent";
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

  var loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", id, { site_lang: lang, page_type: body.getAttribute("data-page") || "" });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(id);
    document.head.appendChild(s);
  }

  var tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  var needsConsent = /^Europe\//.test(tz) || ["Asia/Nicosia", "Asia/Famagusta", "Atlantic/Canary", "Atlantic/Madeira",
    "Atlantic/Azores", "Atlantic/Reykjavik", "Atlantic/Faroe", "Arctic/Longyearbyen"].indexOf(tz) >= 0;

  var banner = null;
  function showBanner() {
    if (banner) { banner.hidden = false; return; }
    banner = document.createElement("div");
    banner.className = "consent";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-live", "polite");
    banner.innerHTML = '<div class="consent-inner"><p></p><div class="consent-actions">' +
      '<button type="button" class="btn btn-secondary" data-c="no"></button>' +
      '<button type="button" class="btn btn-primary" data-c="yes"></button></div></div>';
    var p = banner.querySelector("p");
    p.textContent = (strings.text || "") + " ";
    var more = document.createElement("a");
    more.href = strings.privacy || "/privacy/";
    more.textContent = strings.more || "Privacy";
    p.appendChild(more);
    banner.querySelector('[data-c="yes"]').textContent = strings.accept || "OK";
    banner.querySelector('[data-c="no"]').textContent = strings.decline || "No";
    banner.addEventListener("click", function (e) {
      var c = e.target.getAttribute("data-c");
      if (!c) return;
      write(c === "yes" ? "granted" : "denied");
      banner.hidden = true;
      if (c === "yes") load();
      else if (loaded) { window.location.reload(); } // stop an already running session
    });
    document.body.appendChild(banner);
  }

  var choice = read();
  if (choice === "granted" || (!needsConsent && choice !== "denied")) load();
  else if (choice !== "denied") showBanner();

  document.addEventListener("click", function (e) {
    var open = e.target.closest("[data-consent-open]");
    if (open) { e.preventDefault(); showBanner(); return; }
    var el = e.target.closest("[data-track]");
    if (el) window.caTrack(el.getAttribute("data-track"), { placement: el.getAttribute("data-placement") || "", site_lang: lang });
  });
  var select = document.querySelector("[data-lang-select]");
  if (select) select.addEventListener("change", function () {
    window.caTrack("language_switch", { from_lang: lang, to_path: select.value });
  });
  document.querySelectorAll(".faq details").forEach(function (d, i) {
    d.addEventListener("toggle", function () {
      if (d.open) window.caTrack("faq_open", { question: i + 1, site_lang: lang });
    });
  });
})();
