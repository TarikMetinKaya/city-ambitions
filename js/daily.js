// City Ambitions Daily (D-127, D-128): one puzzle a day, the same for everyone, Wordle-style.
// You start with $1,000 and sell two products in a row: the first product's profit goes into the
// cash you buy the second one with. The products, shoppers and their price limits come from a seed
// made of the date, so every visitor gets the same day without a server. The best possible final
// cash is found by trying every stock and price for both products; the score is the share of that
// gain you reached. One try a day; result, streak and best score stay in localStorage.
(function () {
  var root = document.querySelector("[data-daily]");
  var node = document.getElementById("daily-strings");
  if (!root || !node) return;
  var S = JSON.parse(node.textContent);
  function track(name, params) { if (window.caTrack) window.caTrack(name, params || {}); }

  // id, unit cost, market price in cents (EconomyCatalog.json)
  var PRODUCTS = [["umbrella", 400, 1200], ["silk_scarf", 800, 2200], ["coffee", 180, 700], ["croissant", 220, 750],
    ["denim_jacket", 2400, 6500], ["sunglasses", 600, 1800], ["scented_candle", 450, 1400], ["tote_bag", 300, 1000],
    ["city_mug", 350, 1100], ["basic_tshirt", 700, 2000]];
  var START_CASH = 100000;
  var EPOCH = Date.UTC(2026, 10, 10); // Daily #1 = 10 November 2026, new puzzle at 00:00 UTC
  var dayNumber = Math.floor((Date.now() - EPOCH) / 86400000) + 1;
  var SHOPPER_MS = 450;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rng = mulberry32(dayNumber * 7919 + 104729);
  function makeProduct(exclude) {
    var p;
    do { p = PRODUCTS[Math.floor(rng() * PRODUCTS.length)]; } while (p[0] === exclude);
    var count = 12 + Math.floor(rng() * 7), shoppers = [];
    for (var i = 0; i < count; i++) {
      shoppers.push({ name: S.customers[Math.floor(rng() * S.customers.length)],
                      limit: Math.round(p[2] * (0.55 + rng() * 1.65)), want: 1 + Math.floor(Math.pow(rng(), 2) * 3) });
    }
    return { id: p[0], cost: p[1], market: p[2], name: S.products[p[0]], shoppers: shoppers,
             minPrice: Math.max(1, Math.ceil(p[2] / 200)), maxPrice: Math.floor(p[2] * 3 / 100) };
  }
  var first = makeProduct(null);
  var day = [first, makeProduct(first.id)];

  function run(prod, qty, priceCents) {
    var left = qty, sold = 0, log = [];
    prod.shoppers.forEach(function (s) {
      var n = priceCents <= s.limit ? Math.min(s.want, left) : 0;
      left -= n; sold += n;
      log.push({ who: s.name, n: n, wanted: priceCents <= s.limit });
    });
    return { sold: sold, profit: sold * priceCents - qty * prod.cost, log: log };
  }
  function options(prod) {
    var out = [];
    for (var q = 5; q <= 60; q += 5) for (var d = prod.minPrice; d <= prod.maxPrice; d++) {
      out.push({ qty: q, price: d * 100, spend: q * prod.cost, profit: run(prod, q, d * 100).profit });
    }
    return out;
  }
  // Best final cash: try every choice for the first product, then the best affordable second.
  var opts1 = options(day[0]), opts2 = options(day[1]);
  function bestSecond(cash) {
    var b = { profit: 0, qty: 0, price: 0 };
    opts2.forEach(function (o) { if (o.spend <= cash && o.profit > b.profit) b = o; });
    return b;
  }
  var best = { cash: -Infinity };
  opts1.forEach(function (o) {
    if (o.spend > START_CASH) return;
    var c1 = START_CASH + o.profit, s = bestSecond(c1), total = c1 + s.profit;
    if (total > best.cash) best = { cash: total, a: o, b: s };
  });

  var fmt0, fmt2;
  try { fmt0 = new Intl.NumberFormat(S.lang, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
        fmt2 = new Intl.NumberFormat(S.lang, { style: "currency", currency: "USD" }); } catch (e) {}
  function money(c) { var v = Math.round(c / 100); return (fmt0 ? fmt0.format(v) : "$" + v).replace("-", "−"); }
  function money2(c) { return fmt2 ? fmt2.format(c / 100) : "$" + (c / 100).toFixed(2); }
  function esc(t) { var d = document.createElement("div"); d.textContent = String(t); return d.innerHTML; }
  function fill(t, map) { return t.replace(/\{(\w+)\}/g, function (_, k) { return map[k] !== undefined ? map[k] : ""; }); }

  var KEY = "ca-daily2";
  var store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }

  var state = { step: 0, cash: START_CASH, picks: [] };
  var ui = {};
  function maxQty(prod) { return Math.max(0, Math.min(60, Math.floor(state.cash / prod.cost / 5) * 5)); }
  function resetUi() {
    var prod = day[state.step];
    ui = { qty: Math.min(20, maxQty(prod)), price: Math.round(prod.market / 100) };
  }

  function top() {
    return '<div class="daily-top"><span class="label" style="margin:0">' + esc(fill(S.today, { n: dayNumber })) + "</span>" +
      '<span class="daily-cash">' + esc(S.cash) + ' <strong data-v="cash">' + money(state.cash) + "</strong></span></div>";
  }
  function header(prod, idx) {
    return '<div class="daily-head"><img src="/img/prod-' + prod.id + '-160.webp" alt="" width="72" height="72">' +
      '<div><p class="sub" style="margin:0">' + esc(fill(S.step, { i: idx + 1 })) + "</p><h2>" + esc(prod.name) + "</h2></div></div>" +
      '<div class="panel"><div class="row"><span>' + esc(S.market) + "</span><span>" + money2(prod.market) + '</span></div>' +
      '<div class="row"><span>' + esc(S.cost) + "</span><span>" + money2(prod.cost) + "</span></div></div>" +
      '<p class="sub">' + esc(fill(S.shoppers, { n: prod.shoppers.length })) + " " + esc(S.leftovers) + "</p>";
  }

  function viewIntro() {
    root.innerHTML = top() + "<h2>" + esc(fill(S.start, { cash: money(START_CASH) })) + "</h2>" +
      '<p class="sub">' + esc(S.start_p) + "</p>" +
      '<div class="daily-pair">' + day.map(function (p, i) {
        return '<div class="panel" style="text-align:center"><img src="/img/prod-' + p.id + '-160.webp" alt="" width="72" height="72" style="margin:0 auto 8px;border-radius:12px">' +
          '<p class="sub" style="margin:0">' + esc(fill(S.step, { i: i + 1 })) + "</p><strong>" + esc(p.name) + "</strong></div>";
      }).join("") + "</div>" +
      nextLine() + '<button class="btn btn-primary" data-begin style="width:100%">' + esc(S.begin) + "</button>";
  }

  function viewPlay() {
    var prod = day[state.step], mq = maxQty(prod);
    if (ui.qty > mq) ui.qty = mq;
    root.innerHTML = top() + header(prod, state.step) +
      '<label class="daily-label">' + esc(S.qty) + ' <strong data-v="qty">' + ui.qty + "</strong></label>" +
      '<input class="range" type="range" min="0" max="' + mq + '" step="5" value="' + ui.qty + '" data-r="qty">' +
      '<label class="daily-label">' + esc(S.price) + ' <strong data-v="price">' + money(ui.price * 100) + "</strong></label>" +
      '<input class="range" type="range" min="' + prod.minPrice + '" max="' + prod.maxPrice + '" step="1" value="' + ui.price + '" data-r="price">' +
      '<div class="panel"><div class="row"><span>' + esc(S.order) + '</span><span data-v="order">' + money(ui.qty * prod.cost) + "</span></div>" +
      '<div class="row"><span>' + esc(S.after_order) + '</span><span data-v="left">' + money(state.cash - ui.qty * prod.cost) + "</span></div></div>" +
      '<button class="btn btn-primary" data-go style="width:100%">' + esc(S.go) + "</button>";
  }

  function viewRun() {
    var prod = day[state.step], qty = ui.qty, price = ui.price * 100, r = run(prod, qty, price);
    state.cash -= qty * prod.cost;
    root.innerHTML = top() + header(prod, state.step) +
      '<div class="bar"><i data-v="bar" style="width:0%"></i></div><ul class="feed daily-feed" data-feed></ul>';
    var ul = root.querySelector("[data-feed]"), bar = root.querySelector('[data-v="bar"]'), cashNode = root.querySelector('[data-v="cash"]');
    var i = 0;
    cashNode.textContent = money(state.cash);
    var timer = setInterval(function () {
      if (i >= r.log.length) {
        clearInterval(timer);
        state.picks.push({ qty: qty, price: price, profit: r.profit, sold: r.sold });
        setTimeout(function () { state.step === 0 ? viewBetween() : finish(); }, 700);
        return;
      }
      var e = r.log[i++];
      if (e.n > 0) { state.cash += e.n * price; cashNode.textContent = money(state.cash); }
      bar.style.width = (i * 100 / r.log.length) + "%";
      var li = document.createElement("li");
      li.className = "new";
      li.innerHTML = e.n > 0 ? esc(fill(S.bought, { who: e.who, n: e.n })) + '<span class="amt">' + money(e.n * price) + "</span>"
        : esc(fill(e.wanted ? S.soldout : S.walked, { who: e.who })) + '<span class="missed">' + esc(S.missed) + "</span>";
      ul.insertBefore(li, ul.firstChild);
      while (ul.children.length > 6) ul.removeChild(ul.lastChild);
    }, SHOPPER_MS);
  }

  function viewBetween() {
    var a = state.picks[0];
    root.innerHTML = top() + "<h2>" + esc(fill(S.after1_h, { product: day[0].name })) + "</h2>" +
      '<div class="panel"><div class="row"><span>' + esc(S.sold) + "</span><span>" + a.sold + " / " + a.qty + "</span></div>" +
      '<div class="row"><span>' + esc(S.profit) + '</span><span class="' + (a.profit >= 0 ? "pos" : "neg") + '">' + money(a.profit) + "</span></div>" +
      '<div class="row"><span>' + esc(S.cash) + "</span><span>" + money(state.cash) + "</span></div></div>" +
      '<p class="sub">' + esc(fill(S.after1_p, { product: day[1].name })) + "</p>" +
      '<button class="btn btn-primary" data-next style="width:100%">' + esc(fill(S.next_product, { product: day[1].name })) + "</button>";
  }

  function finish() {
    var gain = state.cash - START_CASH, bestGain = best.cash - START_CASH;
    var score = bestGain > 0 ? Math.max(0, Math.min(100, Math.round(gain * 100 / bestGain))) : 0;
    store.streak = store.last === dayNumber ? store.streak : (store.last === dayNumber - 1 ? (store.streak || 0) + 1 : 1);
    store.last = dayNumber;
    store["d" + dayNumber] = { cash: state.cash, score: score, picks: state.picks };
    store.bestScore = Math.max(store.bestScore || 0, score);
    save();
    track("daily_result", { day: dayNumber, score: score, final_cash_usd: Math.round(state.cash / 100),
                            product_1: day[0].id, product_2: day[1].id });
    viewResult();
  }

  // When the next puzzle opens, in the visitor's own time, with a live countdown.
  var tick = null;
  function nextLine() {
    var at = new Date(EPOCH + dayNumber * 86400000), time;
    try { time = new Intl.DateTimeFormat(S.lang, { hour: "2-digit", minute: "2-digit" }).format(at); } catch (e) { time = at.toISOString().slice(11, 16); }
    return '<p class="daily-next">' + esc(fill(S.next_at, { time: time })) + ' <strong data-v="count"></strong></p>';
  }
  function startCountdown() {
    if (tick) clearInterval(tick);
    function update() {
      var n = root.querySelector('[data-v="count"]');
      if (!n) return;
      var ms = Math.max(0, EPOCH + dayNumber * 86400000 - Date.now());
      if (ms === 0) { window.location.reload(); return; }
      var h = Math.floor(ms / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
      n.textContent = fill(S.countdown, { t: h + ":" + (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s });
    }
    update();
    tick = setInterval(update, 1000);
  }

  function viewResult() {
    var mine = store["d" + dayNumber];
    state.cash = mine.cash;
    function line(i) {
      var p = mine.picks[i] || { qty: 0, price: 0, profit: 0 };
      return '<div class="row"><span>' + esc(day[i].name) + "</span><span>" + esc(fill(S.how, { q: p.qty, p: money(p.price) })) +
        ' <b class="' + (p.profit >= 0 ? "pos" : "neg") + '">' + money(p.profit) + "</b></span></div>";
    }
    function bestLine(o, prod) {
      return '<div class="row"><span>' + esc(prod.name) + "</span><span>" + (o.qty ? esc(fill(S.how, { q: o.qty, p: money(o.price) })) : "—") + "</span></div>";
    }
    root.innerHTML = top() +
      '<div class="daily-score"><span class="pct ' + (mine.score >= 80 ? "pos" : mine.score >= 50 ? "" : "neg") + '">' + mine.score + "%</span>" +
      '<span class="sub">' + esc(S.score_label) + "</span></div>" +
      '<div class="panel"><p class="label" style="margin-bottom:4px">' + esc(S.yours) + "</p>" + line(0) + line(1) +
      '<div class="row"><span><strong>' + esc(S.final_cash) + "</strong></span><span><strong>" + money(mine.cash) + "</strong></span></div></div>" +
      '<div class="panel"><p class="label" style="margin-bottom:4px">' + esc(S.best) + "</p>" + bestLine(best.a, day[0]) + bestLine(best.b, day[1]) +
      '<div class="row"><span>' + esc(S.final_cash) + '</span><span class="pos">' + money(best.cash) + "</span></div></div>" +
      '<div class="panel"><div class="row"><span>' + esc(S.streak) + "</span><span>" + (store.streak || 1) + "</span></div></div>" +
      '<div data-leaderboard></div>' +
      '<button class="btn btn-primary" data-share style="width:100%">' + esc(S.share) + "</button>" +
      nextLine() +
      '<div class="panel" style="background:var(--green-soft)"><strong>' + esc(S.cta_h) + '</strong><p class="sub" style="margin:4px 0 12px">' + esc(S.cta_p) + "</p>" +
      '<a class="btn btn-store" href="' + S.store_url + '" rel="noopener" data-track="app_store_click" data-placement="daily-result" style="width:100%"><span><small>' +
      esc(S.store_small) + "</small>" + esc(S.store_big) + "</span></a>" +
      '<p style="margin:10px 0 0;text-align:center;font-size:.9rem"><a href="' + S.play_url + '">' + esc(S.play_link) + " →</a></p></div>";
    startCountdown();
    leaderboard(root.querySelector("[data-leaderboard]"), mine);
  }

  // ---- Leaderboard (D-129) ------------------------------------------------------------------
  // Firestore daily/{day}/scores/{playerId}: name, the four choices, claimed final cash, language.
  // Rules allow create only, for today or yesterday. Every entry is replayed here with the same
  // simulation; an entry whose cash does not match its choices is not shown.
  var FS = "https://firestore.googleapis.com/v1/projects/" + S.fb_project + "/databases/(default)/documents";
  function replay(q1, p1, q2, p2) {
    var c = START_CASH;
    if (q1 % 5 || q1 < 0 || q1 > 60 || q1 * day[0].cost > c) return null;
    if (p1 < day[0].minPrice || p1 > day[0].maxPrice) return null;
    c += run(day[0], q1, p1 * 100).profit;
    if (q2 % 5 || q2 < 0 || q2 > 60 || q2 * day[1].cost > c) return null;
    if (q2 > 0 && (p2 < day[1].minPrice || p2 > day[1].maxPrice)) return null;
    if (q2 > 0) c += run(day[1], q2, p2 * 100).profit;
    return c;
  }
  function playerId() {
    if (!store.pid) {
      var a = new Uint8Array(12); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; });
      store.pid = Array.from(a).map(function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); save();
    }
    return store.pid;
  }
  function fsValue(v) { return v.integerValue !== undefined ? parseInt(v.integerValue, 10) : v.stringValue; }
  function loadBoard() {
    var body = { structuredQuery: { from: [{ collectionId: "scores" }], orderBy: [{ field: { fieldPath: "cash" }, direction: "DESCENDING" }], limit: 200 } };
    return fetch(FS + "/daily/" + dayNumber + ":runQuery?key=" + S.fb_key, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (rows) {
        var out = [];
        rows.forEach(function (row) {
          if (!row.document) return;
          var f = {}; Object.keys(row.document.fields).forEach(function (k) { f[k] = fsValue(row.document.fields[k]); });
          var cash = replay(f.q1, f.p1, f.q2, f.p2);
          if (cash === null || cash !== f.cash) return; // does not add up: not shown
          out.push({ id: row.document.name.split("/").pop(), name: f.name, cash: cash });
        });
        out.sort(function (a, b) { return b.cash - a.cash; });
        return out;
      });
  }
  function submit(name, mine) {
    var p = mine.picks, fields = { name: { stringValue: name }, lang: { stringValue: S.code },
      q1: { integerValue: p[0].qty }, p1: { integerValue: p[0].price / 100 },
      q2: { integerValue: p[1] ? p[1].qty : 0 }, p2: { integerValue: p[1] && p[1].qty ? p[1].price / 100 : 0 },
      cash: { integerValue: Math.round(mine.cash) } };
    return fetch(FS + "/daily/" + dayNumber + "/scores?documentId=" + playerId() + "&key=" + S.fb_key,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: fields }) })
      .then(function (r) { if (!r.ok && r.status !== 409) throw new Error(r.status); });
  }
  function leaderboard(box, mine) {
    if (!box || !S.fb_key) return;
    box.innerHTML = '<div class="panel"><p class="label" style="margin-bottom:6px">' + esc(S.lb_h) + '</p><div data-lb>' + esc(S.lb_loading) + "</div></div>";
    var list = box.querySelector("[data-lb]");
    function draw(rows) {
      var me = store.pid, myRank = -1;
      rows.forEach(function (r, i) { if (r.id === me) myRank = i; });
      var html = rows.length ? "" : '<p class="sub">' + esc(S.lb_empty) + "</p>";
      rows.slice(0, 20).forEach(function (r, i) {
        html += '<div class="row lb-row' + (r.id === me ? " lb-me" : "") + '"><span>' + (i + 1) + ". " + esc(r.name) + "</span><span>" + money(r.cash) + "</span></div>";
      });
      if (myRank >= 20) html += '<div class="row lb-row lb-me"><span>' + (myRank + 1) + ". " + esc(rows[myRank].name) + "</span><span>" + money(rows[myRank].cash) + "</span></div>";
      if (myRank >= 0) html += '<p class="sub" style="margin:8px 0 0">' + esc(fill(S.lb_rank, { r: myRank + 1, n: rows.length })) + "</p>";
      if (!store["lb" + dayNumber]) {
        html += '<form class="lb-form" data-lb-form><input class="input" name="n" maxlength="16" minlength="2" required placeholder="' + esc(S.lb_name) +
          '" value="' + esc(store.nick || "") + '"><button class="btn btn-secondary" type="submit">' + esc(S.lb_join) + "</button></form>";
      }
      list.innerHTML = html;
      var form = list.querySelector("[data-lb-form]");
      if (form) form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var name = form.n.value.trim().replace(/\s+/g, " ");
        if (!/^[\p{L}\p{N} ._-]{2,16}$/u.test(name)) { form.n.focus(); return; }
        form.querySelector("button").disabled = true;
        submit(name, mine).then(function () {
          store["lb" + dayNumber] = true; store.nick = name; save();
          track("daily_leaderboard_join", { day: dayNumber });
          return loadBoard().then(draw);
        }).catch(function () { list.insertAdjacentHTML("beforeend", '<p class="sub neg">' + esc(S.lb_err) + "</p>"); form.querySelector("button").disabled = false; });
      });
    }
    loadBoard().then(draw).catch(function () { list.innerHTML = '<p class="sub">' + esc(S.lb_err) + "</p>"; });
  }

  root.addEventListener("input", function (e) {
    var k = e.target.getAttribute("data-r");
    if (!k) return;
    var prod = day[state.step];
    ui[k] = parseInt(e.target.value, 10);
    root.querySelector('[data-v="qty"]').textContent = ui.qty;
    root.querySelector('[data-v="price"]').textContent = money(ui.price * 100);
    root.querySelector('[data-v="order"]').textContent = money(ui.qty * prod.cost);
    root.querySelector('[data-v="left"]').textContent = money(state.cash - ui.qty * prod.cost);
  });
  root.addEventListener("click", function (e) {
    if (e.target.closest("[data-begin]")) {
      if (tick) clearInterval(tick);
      track("daily_play", { day: dayNumber });
      resetUi(); viewPlay();
    } else if (e.target.closest("[data-go]")) {
      viewRun();
    } else if (e.target.closest("[data-next]")) {
      state.step = 1; resetUi(); viewPlay();
    } else if (e.target.closest("[data-share]")) {
      var mine = store["d" + dayNumber];
      var text = fill(S.share_text, { n: dayNumber, cash: money(mine.cash), score: mine.score });
      track("daily_share", { day: dayNumber, score: mine.score, method: navigator.share ? "share_sheet" : "copy_link" });
      if (navigator.share) { navigator.share({ title: "City Ambitions Daily", text: text, url: S.url }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(text + " " + S.url).then(function () {
        e.target.closest("[data-share]").textContent = S.copied;
      });
    }
  });

  if (store["d" + dayNumber]) viewResult(); else { viewIntro(); startCountdown(); }
})();
