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
