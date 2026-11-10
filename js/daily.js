// City Ambitions Daily (D-127): one pricing puzzle a day, the same for everyone, Wordle-style.
// The day's product, shoppers and their price limits come from a seed made of the date, so every
// visitor gets the same puzzle without a server. The best possible profit is found by trying every
// stock size and price, and the score is the share of it you reached. One try a day; the result,
// streak and best score stay in localStorage.
(function () {
  var root = document.querySelector("[data-daily]");
  var node = document.getElementById("daily-strings");
  if (!root || !node) return;
  var S = JSON.parse(node.textContent);
  function track(name, params) { if (window.caTrack) window.caTrack(name, params || {}); }

  // Products: id, unit cost and market price in cents (EconomyCatalog.json).
  var PRODUCTS = [["umbrella", 400, 1200], ["silk_scarf", 800, 2200], ["coffee", 180, 700], ["croissant", 220, 750],
    ["denim_jacket", 2400, 6500], ["sunglasses", 600, 1800], ["scented_candle", 450, 1400], ["tote_bag", 300, 1000],
    ["city_mug", 350, 1100], ["basic_tshirt", 700, 2000]];
  var EPOCH = Date.UTC(2026, 10, 10); // Daily #1 = 10 November 2026
  var dayNumber = Math.floor((Date.now() - EPOCH) / 86400000) + 1;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rng = mulberry32(dayNumber * 7919 + 104729);
  var p = PRODUCTS[Math.floor(rng() * PRODUCTS.length)];
  var product = { id: p[0], cost: p[1], market: p[2], name: S.products[p[0]] };
  var shopperCount = 14 + Math.floor(rng() * 7);
  var shoppers = [];
  for (var i = 0; i < shopperCount; i++) {
    var factor = 0.55 + rng() * 1.65;
    shoppers.push({ name: S.customers[Math.floor(rng() * S.customers.length)],
                    limit: Math.round(product.market * factor), want: 1 + Math.floor(Math.pow(rng(), 2) * 3) });
  }
  var QTY = [];
  for (var q = 5; q <= 60; q += 5) QTY.push(q);
  var minPrice = Math.max(1, Math.ceil(product.market / 200));
  var maxPrice = Math.floor(product.market * 3 / 100);

  function run(qty, priceCents) {
    var left = qty, sold = 0, log = [];
    shoppers.forEach(function (s) {
      var n = priceCents <= s.limit ? Math.min(s.want, left) : 0;
      left -= n; sold += n;
      log.push({ who: s.name, n: n, wanted: priceCents <= s.limit });
    });
    return { sold: sold, profit: sold * priceCents - qty * product.cost, log: log };
  }
  var best = { profit: -Infinity };
  QTY.forEach(function (q) {
    for (var d = minPrice; d <= maxPrice; d++) {
      var r = run(q, d * 100);
      if (r.profit > best.profit) best = { profit: r.profit, qty: q, price: d * 100 };
    }
  });

  var fmt;
  try { fmt = new Intl.NumberFormat(S.lang, { style: "currency", currency: "USD", maximumFractionDigits: 0 }); } catch (e) { fmt = null; }
  function money(c) { var v = Math.round(c / 100); var t = fmt ? fmt.format(v) : "$" + v; return t.replace("-", "−"); }
  function money2(c) {
    try { return new Intl.NumberFormat(S.lang, { style: "currency", currency: "USD" }).format(c / 100); } catch (e) { return "$" + (c / 100).toFixed(2); }
  }
  function esc(t) { var d = document.createElement("div"); d.textContent = String(t); return d.innerHTML; }
  function fill(t, map) { return t.replace(/\{(\w+)\}/g, function (_, k) { return map[k] !== undefined ? map[k] : ""; }); }

  var KEY = "ca-daily";
  var store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  var ui = { qty: 20, price: Math.round(product.market / 100) };

  function header() {
    return '<div class="daily-head"><img src="/img/prod-' + product.id + '-160.webp" alt="" width="72" height="72">' +
      '<div><p class="label" style="margin:0">' + esc(fill(S.today, { n: dayNumber })) + "</p><h2>" + esc(product.name) + "</h2></div></div>" +
      '<div class="panel"><div class="row"><span>' + esc(S.market) + "</span><span>" + money2(product.market) + '</span></div>' +
      '<div class="row"><span>' + esc(S.cost) + "</span><span>" + money2(product.cost) + "</span></div></div>" +
      '<p class="sub">' + esc(fill(S.shoppers, { n: shopperCount })) + " " + esc(S.leftovers) + "</p>";
  }

  function viewPlay() {
    root.innerHTML = header() +
      '<label class="daily-label">' + esc(S.qty) + ' <strong data-v="qty">' + ui.qty + "</strong></label>" +
      '<input class="range" type="range" min="5" max="60" step="5" value="' + ui.qty + '" data-r="qty">' +
      '<label class="daily-label">' + esc(S.price) + ' <strong data-v="price">' + money(ui.price * 100) + "</strong></label>" +
      '<input class="range" type="range" min="' + minPrice + '" max="' + maxPrice + '" step="1" value="' + ui.price + '" data-r="price">' +
      '<div class="panel"><div class="row"><span>' + esc(S.order) + '</span><span data-v="order">' + money(ui.qty * product.cost) + "</span></div></div>" +
      '<button class="btn btn-primary" data-go style="width:100%">' + esc(S.go) + "</button>";
  }

  function viewRun(qty, price) {
    var r = run(qty, price);
    root.innerHTML = header() + '<ul class="feed daily-feed" data-feed></ul>';
    var ul = root.querySelector("[data-feed]");
    var i = 0;
    var timer = setInterval(function () {
      if (i >= r.log.length) { clearInterval(timer); finish(qty, price, r); return; }
      var e = r.log[i++];
      var li = document.createElement("li");
      li.className = "new";
      if (e.n > 0) li.innerHTML = esc(fill(S.bought, { who: e.who, n: e.n })) + '<span class="amt">' + money(e.n * price) + "</span>";
      else li.innerHTML = esc(fill(e.wanted ? S.soldout : S.walked, { who: e.who })) + '<span class="missed">' + esc(S.missed) + "</span>";
      ul.insertBefore(li, ul.firstChild);
      while (ul.children.length > 6) ul.removeChild(ul.lastChild);
    }, 140);
  }

  function finish(qty, price, r) {
    var score = best.profit > 0 ? Math.max(0, Math.min(100, Math.round(r.profit * 100 / best.profit))) : 0;
    var yesterday = store.last === dayNumber - 1;
    store.streak = (store.last === dayNumber ? store.streak : (yesterday ? (store.streak || 0) + 1 : 1));
    store.last = dayNumber;
    store["d" + dayNumber] = { qty: qty, price: price, profit: r.profit, score: score };
    store.bestScore = Math.max(store.bestScore || 0, score);
    save();
    track("daily_result", { day: dayNumber, score: score, product: product.id, qty: qty, price_usd: price / 100 });
    viewResult();
  }

  function untilTomorrow() {
    var ms = EPOCH + dayNumber * 86400000 - Date.now();
    var h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    return h + ":" + (m < 10 ? "0" : "") + m;
  }

  function viewResult() {
    var mine = store["d" + dayNumber];
    root.innerHTML = header() +
      '<div class="daily-score"><span class="pct ' + (mine.score >= 80 ? "pos" : mine.score >= 50 ? "" : "neg") + '">' + mine.score + "%</span>" +
      '<span class="sub">' + esc(S.score_label) + "</span></div>" +
      '<div class="panel">' +
      '<div class="row"><span>' + esc(S.yours) + "</span><span>" + esc(fill(S.how, { q: mine.qty, p: money(mine.price) })) + "</span></div>" +
      '<div class="row"><span>' + esc(S.profit) + '</span><span class="' + (mine.profit >= 0 ? "pos" : "neg") + '">' + money(mine.profit) + "</span></div>" +
      '<div class="row"><span>' + esc(S.best) + "</span><span>" + esc(fill(S.how, { q: best.qty, p: money(best.price) })) + "</span></div>" +
      '<div class="row"><span>' + esc(S.best_profit) + '</span><span class="pos">' + money(best.profit) + "</span></div>" +
      '<div class="row"><span>' + esc(S.streak) + "</span><span>" + (store.streak || 1) + "</span></div></div>" +
      '<button class="btn btn-primary" data-share style="width:100%">' + esc(S.share) + "</button>" +
      '<p class="sub" style="text-align:center">' + esc(fill(S.next, { t: untilTomorrow() })) + "</p>" +
      '<div class="panel" style="background:var(--green-soft)"><strong>' + esc(S.cta_h) + '</strong><p class="sub" style="margin:4px 0 12px">' + esc(S.cta_p) + "</p>" +
      '<a class="btn btn-store" href="' + S.store_url + '" rel="noopener" data-track="app_store_click" data-placement="daily-result" style="width:100%"><span><small>' +
      esc(S.store_small) + "</small>" + esc(S.store_big) + "</span></a>" +
      '<p style="margin:10px 0 0;text-align:center;font-size:.9rem"><a href="' + S.play_url + '">' + esc(S.play_link) + " →</a></p></div>";
  }

  root.addEventListener("input", function (e) {
    var k = e.target.getAttribute("data-r");
    if (!k) return;
    ui[k] = parseInt(e.target.value, 10);
    root.querySelector('[data-v="qty"]').textContent = ui.qty;
    root.querySelector('[data-v="price"]').textContent = money(ui.price * 100);
    root.querySelector('[data-v="order"]').textContent = money(ui.qty * product.cost);
  });
  root.addEventListener("click", function (e) {
    if (e.target.closest("[data-go]")) {
      track("daily_play", { day: dayNumber, product: product.id });
      viewRun(ui.qty, ui.price * 100);
    } else if (e.target.closest("[data-share]")) {
      var mine = store["d" + dayNumber];
      var text = fill(S.share_text, { n: dayNumber, score: mine.score, product: product.name });
      track("daily_share", { day: dayNumber, score: mine.score, method: navigator.share ? "share_sheet" : "copy_link" });
      if (navigator.share) { navigator.share({ title: "City Ambitions Daily", text: text, url: S.url }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(text + " " + S.url).then(function () {
        e.target.closest("[data-share]").textContent = S.copied;
      });
    }
  });

  if (store["d" + dayNumber]) viewResult(); else viewPlay();
})();
