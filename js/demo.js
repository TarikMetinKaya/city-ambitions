// The first day of City Ambitions in the browser.
//
// This is a line-for-line port of the street sale in
// Packages/SimulationKit/Sources/SimulationKit/OpeningGame.swift (steps .skill, .stock, .price,
// .sales, .result). Same cash, same unit cost, same eight shoppers in the same order, same
// half-second clock, same rule that one umbrella stays in the bag. If the opening changes in the
// game, change it here too, or the demo promises a day the app no longer plays.
(function () {
  var root = document.querySelector("[data-demo]");
  var stringsNode = document.getElementById("demo-strings");
  if (!root || !stringsNode) return;
  var S = JSON.parse(stringsNode.textContent);

  // ---- model (cents, like the game) ----------------------------------------------------------
  var CUSTOMERS = [ // OpeningGame: name, willingness to pay, umbrellas wanted
    [0, 1000, 1], [1, 1700, 2], [2, 2400, 4], [3, 3200, 1],
    [4, 2800, 3], [5, 2200, 1], [6, 3000, 3], [7, 1500, 1]
  ];
  var INTERVALS = [1, 3, 2, 4, 2, 1, 3, 2];
  var SALES_HALF_SECONDS = 60;

  function freshGame() {
    return { step: "intro", cash: 200000, skill: null, stock: 0, purchased: 0, sold: 0, price: 1200,
             revenue: 0, ticks: 0, elapsed: 0, nextCustomer: 1, feed: [] };
  }
  var g = freshGame();
  var ui = { quantity: 50, price: 12 };
  var timer = null;
  // Analytics hook from site.js (D-162); a no-op when the site has no analytics.
  function track(name, params) { if (window.caTrack) window.caTrack(name, params || {}); }

  function unitCost() { return g.skill === "bargaining" ? 380 : 400; }
  function netProfit() { return g.revenue - g.sold * unitCost(); }

  function tick() {
    var elapsed = g.elapsed + 1;
    g.elapsed = elapsed;
    if (elapsed >= g.nextCustomer) {
      var c = CUSTOMERS[(g.ticks + Math.floor(g.price / 100)) % CUSTOMERS.length];
      var threshold = g.skill === "selling" ? Math.floor(c[1] * 110 / 100) : c[1];
      var quantity = Math.min(Math.max(0, g.stock - 1), c[2]); // one umbrella always stays in the bag
      var name = S.customers[c[0]];
      if (g.price <= threshold && quantity > 0) {
        g.stock -= quantity; g.sold += quantity; g.revenue += quantity * g.price; g.cash += quantity * g.price;
        g.feed.unshift({ id: g.ticks, units: quantity, amount: quantity * g.price,
          text: (quantity === 1 ? S.sale_one : S.sale_many).replace("{who}", name).replace("{n}", quantity) });
      } else {
        g.feed.unshift({ id: g.ticks, units: 0, text: S.walked.replace("{who}", name) });
      }
      g.feed = g.feed.slice(0, 5);
      g.ticks += 1;
      g.nextCustomer = elapsed + INTERVALS[g.ticks % INTERVALS.length];
    }
    if (elapsed >= SALES_HALF_SECONDS || g.stock <= 1) {
      g.step = "result";
      stop();
      track("demo_result", { skill: g.skill, quantity: g.purchased, price_usd: g.price / 100, sold: g.sold,
                             revenue_usd: g.revenue / 100, profit_usd: netProfit() / 100 });
    }
  }

  // ---- formatting ------------------------------------------------------------------------------
  var fmtCache = {};
  function money(cents) {
    // Game rule (Money.formatted): cents only show under $100 and only when non-zero.
    var showCents = Math.abs(cents) < 10000 && cents % 100 !== 0;
    var digits = showCents ? 2 : 0;
    var amount = showCents ? cents / 100 : Math.round(cents / 100);
    var key = S.lang + digits;
    if (!fmtCache[key]) {
      try {
        fmtCache[key] = new Intl.NumberFormat(S.lang, { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
      } catch (e) {
        fmtCache[key] = { format: function (v) { return "$" + v.toFixed(digits); } };
      }
    }
    var text = fmtCache[key].format(amount);
    return text.replace("-", "−");
  }
  function esc(text) {
    var d = document.createElement("div"); d.textContent = String(text); return d.innerHTML;
  }

  // ---- views -----------------------------------------------------------------------------------
  function shell(inner, withRain) {
    return '<div class="demo-top"><span class="brandmark">' + esc(S.brand) + '</span><span class="cash">' + money(g.cash) + "</span></div>" +
      '<div class="demo-body">' + inner + "</div>";
  }
  function art(withRain) {
    return '<div class="demo-art"><img src="' + S.art.rain + '" alt="" width="1152" height="768">' + (withRain ? '<div class="rain"></div>' : "") + "</div>";
  }
  function row(label, value, cls, key) {
    return '<div class="row"><span>' + esc(label) + '</span><span class="' + (cls || "") + '"' + (key ? ' data-v="' + key + '"' : "") + ">" + value + "</span></div>";
  }

  function render() {
    if (g.step === "sales" && renderedStep === "sales") { patchSales(); return; }
    var html = "";
    switch (g.step) {
      case "intro":
        html = art(true) + "<h2>" + esc(S.intro_h) + '</h2><p class="sub">' + esc(S.intro_p) + "</p>" +
          '<div class="panel" style="display:flex;gap:12px;align-items:center"><img src="' + S.art.raymond + '" alt="" width="56" height="56" style="border-radius:50%">' +
          "<strong>Raymond Cole</strong></div>" +
          '<button class="btn btn-primary" data-act="begin" style="margin-top:auto">' + esc(S.intro_btn) + "</button>";
        break;
      case "skill":
        html = "<h2>" + esc(S.skill_h) + '</h2><p class="sub">' + esc(S.skill_p) + "</p>" +
          ["bargaining", "selling", "numbers"].map(function (k) {
            return '<button class="skill" data-skill="' + k + '"><strong>' + esc(S.skills[k][0]) + "</strong><span>" +
              esc(S.edge) + " · " + esc(S.skills[k][1]) + "</span></button>";
          }).join("");
        break;
      case "stock":
        var cost = ui.quantity * unitCost();
        html = art(true) + "<h2>" + esc(S.stock_h) + '</h2><p class="sub">' + esc(S.stock_p) + "</p>" +
          '<div class="panel"><div style="display:flex;gap:12px;align-items:center;margin-bottom:8px"><img src="' + S.art.umbrella +
          '" alt="" width="52" height="52" style="border-radius:10px"><strong style="font-size:1.3rem">' + esc(S.umbrellas) + "</strong></div>" +
          row(S.unit_cost, money(unitCost())) +
          '<div class="mid-num" data-qty>' + esc(S.units.replace("{n}", ui.quantity)) + "</div>" +
          '<input class="range" type="range" min="10" max="100" step="10" value="' + ui.quantity + '" data-range="quantity" aria-label="' + esc(S.umbrellas) + '">' +
          row(S.order_cost, money(cost), "", "cost") + row(S.cash_left, money(g.cash - cost), "", "left") + "</div>" +
          '<button class="btn btn-primary" data-act="stock" style="margin-top:auto">' + esc(S.stock_btn) + "</button>";
        break;
      case "price":
        var cents = ui.price * 100;
        html = "<h2>" + esc(S.price_h) + '</h2><p class="sub">' + esc(S.price_p) + "</p>" +
          '<div class="big-num" data-price>' + money(cents) + "</div>" +
          '<input class="range" type="range" min="5" max="30" step="1" value="' + ui.price + '" data-range="price" aria-label="' + esc(S.price_h) + '">' +
          '<div class="panel">' + row(S.unit_cost, money(unitCost())) +
          row(S.unit_margin, money(cents - unitCost()), cents - unitCost() >= 0 ? "pos" : "neg", "margin") + "</div>" +
          '<button class="btn btn-primary" data-act="price" style="margin-top:auto">' + esc(S.price_btn) + "</button>";
        break;
      case "sales":
        var secondsLeft = Math.max(0, 30 - Math.floor(g.elapsed / 2));
        html = '<div class="demo-art demo-art-short"><img src="' + S.art.rain + '" alt="" width="1152" height="768"><div class="rain"></div></div>' +
          "<h2>" + esc(S.sales_h) + '</h2><p class="sub" data-v="secs">' + esc(S.sales_p.replace("{n}", secondsLeft)) + "</p>" +
          '<div class="bar"><i data-v="bar" style="width:' + Math.min(100, g.elapsed * 100 / SALES_HALF_SECONDS) + '%"></i></div>' +
          '<div class="panel"><p class="label" style="margin-bottom:4px">' + esc(S.flow) + '</p><ul class="feed" data-v="feed">' + feedHtml() + "</ul></div>" +
          '<div class="panel">' + row(S.revenue, money(g.revenue), "pos", "rev") + row(S.sold, g.sold, "", "sold") + row(S.remaining, g.stock, "", "left") + "</div>";
        break;
      case "result":
        var profit = netProfit();
        var margin = g.revenue > 0 ? Math.trunc(profit * 100 / Math.max(1, g.revenue)) : 0;
        html = "<h2>" + esc(profit > 0 ? S.win_h : S.loss_h) + '</h2><p class="sub">' + esc(S.result_p) + "</p>" +
          (g.revenue > 0 ? '<div class="panel" style="display:flex;gap:14px;align-items:center"><span class="pct ' + (profit >= 0 ? "pos" : "neg") + '">' + margin + "%</span><div><strong>" +
            esc(S.margin) + '</strong><br><span class="muted" style="font-size:.85rem">' + esc(S.margin_p) + "</span></div></div>" : "") +
          '<div class="panel">' + row(S.revenue, money(g.revenue), "pos") +
          row(S.cogs, "−" + money(g.sold * unitCost()), "neg") +
          '<hr style="border:0;border-top:1px solid var(--line);margin:6px 0">' +
          row(S.net, money(profit), profit >= 0 ? "pos" : "neg") + row(S.inventory, money(g.stock * unitCost())) + "</div>" +
          '<p class="sub" style="font-size:.85rem">' + esc(S.rent_note) + "</p>" +
          '<div class="panel" style="background:var(--green-soft)"><strong>' + esc(S.next_h) + '</strong><p class="sub" style="margin:4px 0 12px">' + esc(S.next_p) + "</p>" +
          '<a class="btn btn-store" href="' + S.store_url + '" rel="noopener" data-track="app_store_click" data-placement="demo-result" style="width:100%"><span><small>' + esc(S.store_small) + "</small>" + esc(S.store_big) + "</span></a>" +
          "</div>" +
          '<div class="share-row"><button class="btn btn-secondary" data-act="share">' + esc(S.share) + '</button><button class="btn btn-secondary" data-act="again">' + esc(S.again) + "</button></div>";
        break;
    }
    root.innerHTML = shell(html);
    renderedStep = g.step;
    shownFeedId = g.feed.length ? g.feed[0].id : -1;
  }

  // While selling, only the numbers and the newest shopper change. Rebuilding the whole box every
  // half second made the text flicker and replayed every row's animation.
  var renderedStep = null;
  var shownFeedId = -1;
  function feedHtml(newestOnly) {
    if (!g.feed.length) return '<li class="muted">' + esc(S.first_customer) + "</li>";
    return g.feed.map(function (f) {
      var cls = newestOnly !== undefined && f.id > newestOnly ? ' class="new"' : "";
      return "<li" + cls + ">" + esc(f.text) + (f.units ? '<span class="amt">' + money(f.amount) + "</span>" : '<span class="missed">' + esc(S.missed) + "</span>") + "</li>";
    }).join("");
  }
  function patchSales() {
    function set(key, text) { var n = root.querySelector('[data-v="' + key + '"]'); if (n) n.textContent = text; }
    set("secs", S.sales_p.replace("{n}", Math.max(0, 30 - Math.floor(g.elapsed / 2))));
    set("rev", money(g.revenue)); set("sold", g.sold); set("left", g.stock);
    var bar = root.querySelector('[data-v="bar"]');
    if (bar) bar.style.width = Math.min(100, g.elapsed * 100 / SALES_HALF_SECONDS) + "%";
    var cash = root.querySelector(".demo-top .cash");
    if (cash) cash.textContent = money(g.cash);
    var newest = g.feed.length ? g.feed[0].id : -1;
    if (newest !== shownFeedId) {
      root.querySelector('[data-v="feed"]').innerHTML = feedHtml(shownFeedId);
      shownFeedId = newest;
    }
  }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function startSales() {
    stop();
    timer = setInterval(function () {
      if (document.hidden) return; // the game pauses in the background too
      tick();
      render();
    }, 500);
  }

  // Slider readouts update in place: re-rendering would swap the slider out from under the finger.
  root.addEventListener("input", function (e) {
    var which = e.target.getAttribute("data-range");
    if (!which) return;
    ui[which] = parseInt(e.target.value, 10);
    function set(key, text, cls) {
      var node = root.querySelector('[data-v="' + key + '"]');
      if (!node) return;
      node.textContent = text;
      if (cls !== undefined) node.className = cls;
    }
    if (which === "quantity") {
      var cost = ui.quantity * unitCost();
      root.querySelector("[data-qty]").textContent = S.units.replace("{n}", ui.quantity);
      set("cost", money(cost));
      set("left", money(g.cash - cost));
    } else {
      var cents = ui.price * 100;
      root.querySelector("[data-price]").textContent = money(cents);
      set("margin", money(cents - unitCost()), cents - unitCost() >= 0 ? "pos" : "neg");
    }
  });

  root.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act],[data-skill]");
    if (!el) return;
    var skill = el.getAttribute("data-skill");
    if (skill) { g.skill = skill; g.step = "stock"; track("demo_skill", { skill: skill }); render(); return; }
    switch (el.getAttribute("data-act")) {
      case "begin": g.step = "skill"; track("demo_start"); break;
      case "stock":
        var cost = ui.quantity * unitCost();
        if (g.cash < cost) return;
        g.cash -= cost; g.purchased = ui.quantity; g.stock = ui.quantity; g.step = "price";
        track("demo_stock", { quantity: ui.quantity });
        break;
      case "price":
        g.price = ui.price * 100; g.elapsed = 0; g.nextCustomer = 1; g.step = "sales";
        track("demo_price", { price_usd: ui.price });
        render(); startSales(); return;
      case "again":
        track("demo_replay");
        var keepSkill = g.skill;
        g = freshGame(); g.skill = keepSkill; g.step = "stock";
        break;
      case "share":
        share(el); return;
    }
    render();
    root.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  function share(button) {
    var profit = netProfit();
    var text = (profit > 0 ? S.share_text : S.share_text_loss).replace("{profit}", money(profit));
    track("demo_share", { method: navigator.share ? "share_sheet" : "copy_link", profit_usd: profit / 100 });
    if (navigator.share) {
      navigator.share({ title: "City Ambitions", text: text, url: S.share_url }).catch(function () {});
      return;
    }
    var full = text + " " + S.share_url;
    var done = function () { button.textContent = S.copied; };
    if (navigator.clipboard) navigator.clipboard.writeText(full).then(done, function () {});
  }

  render();
})();
