/* DriveX Ad Builder (admin). Ported from the owner's standalone Ad Builder page.
   Builds Dubizzle / Instagram / Facebook / Website / Auto.ae ad text in the browser.
   Open with ?vehicle=ID to start from a car saved in the admin. */
(function () {
  var $ = function (s) { return document.querySelector(s); };

  var DEF = {
    year: 2024, name: "Opel Zafira Life", price: 99000, specs: "GCC", mileage: 73000, fuel: "Diesel",
    engine: "2.0-liter 4-cylinder diesel engine", hp: 180, accel: "10.4", trans: "8-Speed Automatic", drive: "Front-Wheel Drive (FWD)",
    ext: "Black", int: "Black",
    service: "Fully Serviced", warranty: "1 Year Warranty Unlimited KM",
    scontract: "", svcOn: true, warrOn: true, freeSvc: true, contractOn: false,
    features: [
      "Dual Power Sliding Side Doors", "7-inch Touchscreen", "Panoramic Sunroof", "Premium Leather Upholstery",
      "Multi-Zone Automatic Climate Control", "Cruise Control", "LED Daytime Running Lights (DRLs)",
      "180° Rear-View Camera", "Hands-Free Tailgate Access"
    ].join("\n"),
    rate: 3.5, dp: 20,
    dealer: "DriveX Motors", reg: 1000, ins: 3, bank: 500,
    wa: "", nfeat: 6, platform: "dubizzle",
    tags: "#abudhabi #uaecars #usedcarsuae #carsforsaleuae #drivexmotors",
    cname2: "Khaled", cphone2: "050 673 0006", clang2: "Arabic & English", cname: "Ahmad", cphone: "055 102 7710", clang: "Arabic & English", land: "02 442 0896",
    addr: "Abu Dhabi Industrial City - ICAD V - Abu Dhabi | مدينة رحايل - ابوظبي",
    maps: "https://maps.app.goo.gl/VCpffr8hDoaZb9e89",
    hours: "Saturday – Thursday: 10:00 AM – 9:00 PM\nFriday: 4:00 PM – 9:00 PM",
    links: [
      "Browse Full Dubizzle Inventory → https://abudhabi.dubizzle.com/motors/used-cars/?dealer_name=27072",
      "Browse Our Website Inventory → https://drivex-motors.com/inventory",
      "Google Maps → https://maps.app.goo.gl/VCpffr8hDoaZb9e89",
      "Instagram @drivex_motors.ae → https://www.instagram.com/drivex_motors.ae/",
      "Facebook → https://www.facebook.com/drivexmotorsae"
    ].join("\n")
  };
  var CAR_KEYS = ["year","name","price","specs","mileage","fuel","engine","hp","accel","trans","drive","ext","int","service","warranty","scontract","features"];

  var S = Object.assign({}, DEF);
  var cars = [];
  var armed = -1;

  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var saved = lsGet("drivex.ad.v1");
  if (saved && typeof saved === "object") S = Object.assign(S, saved);
  var savedCars = lsGet("drivex.cars.v1");
  if (Array.isArray(savedCars)) cars = savedCars;

  var fmt = function (n) { return Math.round(n).toLocaleString("en-US"); };

  /* Finance: flat rate, matching the template (99,000 AED, 20% DP, 3.5%, 60 months = 1,551/month). */
  function termMonths(year) {
    if (!year || year <= 2015) return 0;
    if (year === 2016) return 12;
    if (year === 2017) return 24;
    if (year === 2018) return 36;
    if (year === 2019) return 48;
    return 60;
  }
  function finance(s) {
    var year = parseInt(s.year, 10), price = parseFloat(s.price), dp = parseFloat(s.dp) || 0, rate = parseFloat(s.rate) || 0;
    var months = termMonths(year);
    if (!months || !(price > 0)) return null;
    var down = price * dp / 100;
    var financed = price - down;
    var interest = financed * (rate / 100) * (months / 12);
    var total = financed + interest;
    return { months: months, down: down, financed: financed, interest: interest, total: total, monthly: total / months };
  }
  window.__finance = finance;

  function lines(txt) {
    return String(txt || "").split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
  }
  function bullets(arr) { return arr.map(function (t) { return "• " + t; }); }
  function put(label, val, suffix) {
    val = String(val == null ? "" : val).trim();
    return val ? label + ": " + val + (suffix || "") : null;
  }

  /* ---------- Instagram & Facebook ---------- */
  function pick(arr) { return arr.filter(function (x) { return x && String(x).trim(); }); }
  function driveShort(d) { var m = String(d || "").match(/\(([^)]+)\)/); return m ? m[1] : String(d || "").trim(); }
  function colorsText(s) {
    var e = String(s.ext || "").trim(), i = String(s.int || "").trim();
    if (e && i) return e.toLowerCase() === i.toLowerCase() ? e + " inside & out" : e + " / " + i;
    return e || i;
  }
  function hashtags(s) {
    var parts = String(s.name || "").trim().split(/\s+/).filter(Boolean);
    var clean = function (t) { return t.replace(/[^A-Za-z0-9]/g, "").toLowerCase(); };
    var tags = [];
    if (parts[0]) tags.push("#" + clean(parts[0]));
    if (parts.length > 1) tags.push("#" + clean(parts.join("")));
    String(s.tags || "").split(/\s+/).forEach(function (t) { if (t) tags.push(t.charAt(0) === "#" ? t : "#" + t); });
    var seen = {};
    return tags.filter(function (t) { if (t.length < 2 || seen[t]) return false; seen[t] = 1; return true; });
  }
  function ctx(s) {
    var f = finance(s);
    var price = parseFloat(s.price), mil = parseFloat(s.mileage), hp = parseFloat(s.hp);
    var str = function (v) { return String(v == null ? "" : v).trim(); };
    var contact = [];
    if (str(s.cphone2)) contact.push("📞 Call " + (str(s.cname2) ? str(s.cname2) + ": " : "") + str(s.cphone2) + (str(s.clang2) ? " (" + str(s.clang2) + ")" : ""));
    if (str(s.cphone)) contact.push("📞 Call " + (str(s.cname) ? str(s.cname) + ": " : "") + str(s.cphone) + (str(s.clang) ? " (" + str(s.clang) + ")" : ""));
    if (str(s.wa)) contact.push("💬 WhatsApp: " + str(s.wa));
    if (str(s.land)) contact.push("☎️ " + str(s.land));
    return {
      f: f,
      title: (str(s.year) + " " + str(s.name)).trim(),
      priceTxt: price > 0 ? fmt(price) + " AED" : "",
      pm: f ? "~" + fmt(f.monthly) + " AED x " + f.months + " Month • " + (parseFloat(s.dp) || 0) + "% Downpayment • Bank Finance" : "",
      mil: mil > 0 ? fmt(mil) : "",
      hp: hp > 0 ? String(hp) : "",
      specLine: pick([mil > 0 ? fmt(mil) + " KM" : "", s.specs, s.fuel, colorsText(s)]).join(" • "),
      techLine: pick([s.engine, hp > 0 ? hp + " HP" : "", s.trans, driveShort(s.drive), str(s.accel) ? "0-100 in " + str(s.accel) + "s" : ""]).join(" • "),
      trust: trustItems(s).join(" • "),
      dealer: str(s.dealer),
      contact: contact,
      addr: str(s.addr),
      hours: lines(s.hours)
    };
  }
  function tidy(arr) { return arr.join("\n").replace(/\n{3,}/g, "\n\n").trim(); }

  function buildInstagram(s) {
    var c = ctx(s), n = parseInt(s.nfeat, 10), o = [];
    if (isNaN(n) || n < 0) n = 6;
    if (c.title) o.push("🔥 " + c.title);
    var pl = pick([c.priceTxt, c.pm]).join("  |  ");
    if (pl) o.push("💰 " + pl);
    o.push("");
    if (c.specLine) o.push("🚗 " + c.specLine);
    if (c.techLine) o.push("⚙️ " + c.techLine);
    var feats = lines(s.features).slice(0, n);
    if (feats.length) { o.push(""); feats.forEach(function (x) { o.push("✅ " + x); }); }
    o.push("");
    if (c.trust) o.push("🛡️ " + c.trust);
    o.push("💵 " + (c.f ? "Cash or Bank Finance" : "Cash"));
    if (c.dealer) o.push("🔄 Buy-back guarantee • We buy your car in 30 minutes");
    o.push("");
    c.contact.forEach(function (l) { o.push(l); });
    if (c.addr) o.push("📍 " + c.addr);
    if (c.hours.length) o.push("⏰ " + c.hours.join(" | "));
    o.push("🔗 Full inventory & map → link in bio");
    var tags = hashtags(s);
    if (tags.length) { o.push(""); o.push(tags.join(" ")); }
    return tidy(o);
  }

  function buildFacebook(s) {
    var c = ctx(s), o = [];
    var head = pick([c.title, c.priceTxt]).join(" — ");
    if (head) o.push("🚗 " + head);
    if (c.pm) o.push("💳 " + c.pm);
    o.push("");
    var spec = pick([
      put("Model", s.year), put("Specs", s.specs), put("Mileage", c.mil, " KM"), put("Engine", s.engine),
      put("Power", c.hp, " HP"), put("Transmission", s.trans), put("Drivetrain", s.drive),
      put("0-100 KM/H", String(s.accel || "").trim(), " seconds"), put("Fuel", s.fuel), put("Colors", colorsText(s))
    ].map(function (x) { return x && /:\s*$/.test(x) ? null : x; }));
    if (spec.length) { o.push("📋 Highlights"); bullets(spec).forEach(function (l) { o.push(l); }); o.push(""); }
    var feats = lines(s.features);
    if (feats.length) { o.push("🌟 Key Features"); feats.forEach(function (x) { o.push("✅ " + x); }); o.push(""); }
    if (c.trust) o.push("🛡️ " + c.trust);
    o.push("💵 " + (c.f ? "Cash or Bank Finance" : "Cash"));
    var reg = parseFloat(s.reg), ins = parseFloat(s.ins), bank = parseFloat(s.bank);
    var fees = pick([
      reg > 0 ? "Registration ~" + fmt(reg) + " AED" : "",
      ins > 0 ? "Insurance " + ins + "% of car price" : "",
      (c.f && bank > 0) ? "Bank evaluation " + fmt(bank) + " AED (bank finance only)" : ""
    ]).join(" • ");
    if (fees) o.push("📋 " + fees);
    if (c.dealer) o.push("🔄 Buy-back guarantee at " + c.dealer + " • We buy your car in 30 minutes");
    o.push("");
    c.contact.forEach(function (l) { o.push(l); });
    if (c.addr) o.push("📍 " + c.addr);
    if (String(s.maps || "").trim()) o.push("🗺️ " + String(s.maps).trim());
    if (c.hours.length) o.push("⏰ " + c.hours.join(" | "));
    var links = lines(s.links);
    if (links.length) { o.push(""); o.push("🔗 Explore & connect"); links.forEach(function (l) { o.push("• " + l); }); }
    var tags = hashtags(s).slice(0, 5);
    if (tags.length) { o.push(""); o.push(tags.join(" ")); }
    return tidy(o);
  }

  function buildAd(s) {
    if (s.platform === "instagram") return buildInstagram(s);
    if (s.platform === "facebook") return buildFacebook(s);
    if (s.platform === "website") return buildWebsite(s);
    if (s.platform === "autoae") return buildDubizzle(s, true);
    return buildDubizzle(s);
  }

  /* drivex-motors.com listing description: plain-text layout used on the vehicle pages */
  function buildWebsite(s) {
    var f = finance(s);
    var num = function (v) { var n = parseFloat(v); return isNaN(n) ? "" : fmt(n); };
    var bold = function (t) {
      return Array.from(t).map(function (ch) {
        var c = ch.charCodeAt(0);
        if (c >= 65 && c <= 90) return String.fromCodePoint(0x1D400 + c - 65);
        if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D41A + c - 97);
        return ch;
      }).join("");
    };
    var head = (String(s.year || "").trim() + " " + String(s.name || "").trim()).trim();
    if (f) head += "\n\n~" + fmt(f.monthly) + " AED x " + f.months + " Month • " + (parseFloat(s.dp) || 0) + "% Downpayment • Bank Finance";
    var o = [head, ""];
    var pr = pick([put("Price", num(s.price), " AED"), put("Model", s.year), put("Specs", s.specs), put("Mileage", num(s.mileage), " KM")]);
    if (pr.length) { o.push("💰 " + bold("Pricing & Overview:"), ""); pr.forEach(function (l) { o.push("- " + l); }); o.push(""); }
    o.push("⚙️ " + bold("Key Specs:"), "");
    pick([
      put("Exterior Color", s.ext),
      put("Interior Color", s.int),
      put("Engine", s.engine),
      put("Fuel Type", s.fuel),
      put("Horsepower", s.hp ? s.hp + " Horsepower" : ""),
      put("Acceleration", s.accel ? s.accel + " Seconds 0 - 100 KM/H" : ""),
      put("Transmission", s.trans),
      put("Drivetrain", s.drive)
    ].concat(histItems(s))).forEach(function (l) { o.push("- " + l); });
    o.push("", "✨ " + bold("Finance Options:"), "");
    (f ? ["Cash 💵", "Bank Finance 🏦"] : ["Cash 💵"]).forEach(function (l) { o.push(l); });
    var reg = parseFloat(s.reg), ins = parseFloat(s.ins), bank = parseFloat(s.bank);
    var fees = [
      reg > 0 ? "Car Registration: ~" + fmt(reg) + " AED (Applicable for " + (f ? "Cash & Bank Finance" : "Cash") + ")" : null,
      ins > 0 ? "Insurance: " + ins + "% of car price (Paid to the insurance company)" : null,
      (f && bank > 0) ? "Bank Evaluation: " + fmt(bank) + " AED (Applicable for Bank Finance only)" : null
    ].filter(Boolean);
    if (fees.length) { o.push("", "📋 " + bold("Additional Fees & Charges:"), ""); fees.forEach(function (l) { o.push(l); }); }
    var cl = function (n, p, l) {
      n = String(n || "").trim(); p = String(p || "").trim(); l = String(l || "").trim();
      return (n && p) ? n + " - " + p + (l ? " (" + l + ")" : "") : null;
    };
    var calls = pick([cl(s.cname2, s.cphone2, s.clang2), cl(s.cname, s.cphone, s.clang), String(s.land || "").trim() ? "LandLine - " + String(s.land).trim() : null]);
    if (calls.length) { o.push("", "📞 " + bold("Call Us:"), ""); calls.forEach(function (l) { o.push(l); }); }
    o.push("", "🔄 Buy-Back Guarantee:", "",
      "At " + (String(s.dealer || "").trim() || "DriveX Motors") + ", we promise to buy back any vehicle you purchase from us. Whether you’ve had a change of plans or you’re upgrading to a newer model, enjoy a hassle-free process and peace of mind.",
      "Instant Payment ⚡", "Loans Cleared 🏦", "",
      "⏱️ Sell Your Car in 30 Minutes:", "We’ll buy your car quickly and securely — with instant payment and loan clearance.");
    return tidy(o);
  }

  function buildDubizzle(s, auto) {
    var f = finance(s);
    var num = function (v) { var n = parseFloat(v); return isNaN(n) ? "" : fmt(n); };

    var head = (String(s.year || "").trim() + " " + String(s.name || "").trim()).trim();
    if (f) head += "\n\n~" + fmt(f.monthly) + " AED x " + f.months + " Month • " + (parseFloat(s.dp) || 0) + "% Downpayment • Bank Finance";

    var blocks = [];
    function block(title, items) {
      items = items.filter(Boolean);
      if (items.length) blocks.push(title + "\n\n" + bullets(items).join("\n"));
    }

    block("💰 Pricing & Overview", [
      put("Price", num(s.price), " AED"),
      put("Model", s.year),
      put("Specs", s.specs),
      put("Mileage", num(s.mileage), " KM")
    ]);
    block("⚙️ Performance & Engineering", [
      put("Engine", s.engine),
      put("Horsepower", s.hp ? s.hp + " Horsepower" : ""),
      put("Transmission", s.trans),
      put("Drivetrain", s.drive),
      put("Acceleration", s.accel ? s.accel + " Seconds 0 - 100 KM/H" : ""),
      put("Fuel Type", s.fuel)
    ]);
    block("🎨 Exterior & Interior Colors", [
      put("Exterior Color", s.ext),
      put("Interior Color", s.int)
    ]);
    block("🌟 Key Features", lines(s.features));
    block("🛡️ Vehicle History & Warranty", histItems(s));
    block("✨ Finance Options", f ? ["Cash 💵", "Bank Finance 🏦"] : ["Cash 💵"]);
    block("⏱️ Sell Your Car in 30 Minutes", ["We’ll buy your car quickly and securely — with instant payment and loan clearance."]);

    var reg = parseFloat(s.reg), ins = parseFloat(s.ins), bank = parseFloat(s.bank);
    block("📋 Additional Fees & Charges:", [
      reg > 0 ? "Car Registration: ~" + fmt(reg) + " AED (Applicable for " + (f ? "Cash & Bank Finance" : "Cash") + ")" : null,
      ins > 0 ? "Insurance: " + ins + "% of car price (Paid to the insurance company)" : null,
      (f && bank > 0) ? "Bank Evaluation: " + fmt(bank) + " AED (Applicable for Bank Finance only)" : null
    ]);

    var dealer = String(s.dealer || "").trim();
    if (dealer) {
      blocks.push(
        "🔄 Buy-Back Guarantee\nAt " + dealer + ", we promise to buy back any vehicle you purchase from us. Whether you’ve had a change of plans or you’re upgrading to a newer model, enjoy a hassle-free process and complete peace of mind.\n\n" +
        bullets(["Instant Payment ⚡", "Loans Cleared 🏦"]).join("\n")
      );
    }

    var call = function (n, p, l) {
      n = String(n || "").trim(); p = String(p || "").trim(); l = String(l || "").trim();
      return (n && p) ? n + " - " + p + (l ? " (" + l + ")" : "") : null;
    };
    var c1 = call(s.cname2, s.cphone2, s.clang2), c2 = call(s.cname, s.cphone, s.clang);
    block("📞 Call Us", [auto ? c1 : c2, auto ? c2 : c1, String(s.land || "").trim() ? "LandLine - " + s.land.trim() : null]);

    block("📍 Location & Working Hours", [
      String(s.addr || "").trim(),
      String(s.maps || "").trim() ? "Google Maps : " + s.maps.trim() : null
    ].concat(lines(s.hours)));

    block("🔗 Explore & Connect", auto ? lines(s.links).filter(function (l) { return !/dubizzle/i.test(l); }) : lines(s.links));

    return head + "\n\n" + blocks.join("\n\n\n");
  }

  /* ---------- UI ---------- */
  var out = $("#out");

  function renderCalc() {
    var f = finance(S), box = $("#calc");
    var year = parseInt(S.year, 10);
    if (!f) {
      box.className = "calc none";
      box.innerHTML = "";
      var p = document.createElement("div");
      p.textContent = (year && year <= 2015)
        ? year + " and older: no financing. The monthly line, Bank Finance and the bank evaluation fee are left out of the ad."
        : "Enter a model year and a price to see the monthly payment.";
      box.appendChild(p);
      return;
    }
    box.className = "calc";
    box.innerHTML =
      '<div class="big">~' + fmt(f.monthly) + ' <em>AED x ' + f.months + '</em></div>' +
      '<dl>' +
      '<dt>Down payment</dt><dd>' + fmt(f.down) + '</dd>' +
      '<dt>Financed amount</dt><dd>' + fmt(f.financed) + '</dd>' +
      '<dt>Total interest</dt><dd>' + fmt(f.interest) + '</dd>' +
      '<dt>Total to repay</dt><dd>' + fmt(f.total) + '</dd>' +
      '</dl>';
  }

  function renderTerms() {
    var year = parseInt(S.year, 10);
    var rows = [
      ["2015 and older", "No financing", !!year && year <= 2015],
      ["2016", "1 year", year === 2016],
      ["2017", "2 years", year === 2017],
      ["2018", "3 years", year === 2018],
      ["2019", "4 years", year === 2019],
      ["2020 and newer", "5 years", year >= 2020]
    ];
    var t = $("#terms");
    t.innerHTML = "";
    rows.forEach(function (r) {
      var tr = document.createElement("tr");
      if (r[2]) tr.className = "on";
      var a = document.createElement("td"); a.textContent = r[0];
      var b = document.createElement("td"); b.textContent = r[1];
      tr.appendChild(a); tr.appendChild(b); t.appendChild(tr);
    });
  }

  function renderCars() {
    if (typeof showDl === "function") setTimeout(showDl, 0);
    var box = $("#cars");
    box.innerHTML = "";
    if (!cars.length) {
      var p = document.createElement("p");
      p.className = "hint";
      p.textContent = "No saved cars yet. Fill in a car and press Save this car to reuse it later.";
      box.appendChild(p);
      return;
    }
    cars.forEach(function (c, i) {
      var chip = document.createElement("span");
      chip.className = "chip";
      var load = document.createElement("button");
      load.type = "button";
      load.textContent = ((c.year || "") + " " + (c.name || "")).trim() || "Untitled car";
      load.addEventListener("click", function () {
        $("#fromCar").textContent = "";
        CAR_KEYS.forEach(function (k) { S[k] = c[k] == null ? "" : c[k]; });
        armed = -1; syncFields(); update(); renderCars();
      });
      var x = document.createElement("button");
      x.type = "button";
      x.className = "x" + (armed === i ? " armed" : "");
      x.textContent = armed === i ? "Delete?" : "×";
      x.setAttribute("aria-label", "Delete saved car " + load.textContent);
      x.addEventListener("click", function () {
        if (armed === i) { cars.splice(i, 1); armed = -1; lsSet("drivex.cars.v1", cars); }
        else armed = i;
        renderCars();
      });
      chip.appendChild(load); chip.appendChild(x); box.appendChild(chip);
    });
  }

  (function () {
    var b = $("#clearCars"), t;
    b.addEventListener("click", function () {
      if (b.dataset.armed !== "1") {
        b.dataset.armed = "1"; b.textContent = "Click again to delete all";
        t = setTimeout(function () { b.dataset.armed = ""; b.textContent = "Clear all saved cars"; }, 4000);
        return;
      }
      clearTimeout(t); b.dataset.armed = ""; b.textContent = "Clear all saved cars";
      cars.length = 0; armed = -1; lsSet("drivex.cars.v1", cars); renderCars();
    });
  })();

  function histItems(s) {
    return [
      s.svcOn ? put("Service History", s.service) : null,
      s.contractOn ? put("Service Contract", s.scontract) : null,
      s.warrOn ? put("Warranty", s.warranty) : null,
      s.freeSvc ? "1 Free Service" : null
    ].filter(Boolean);
  }
  function trustItems(s) {
    return pick([
      s.warrOn ? s.warranty : "",
      s.svcOn ? s.service : "",
      (s.contractOn && String(s.scontract || "").trim()) ? "Service Contract: " + String(s.scontract).trim() : "",
      s.freeSvc ? "1 Free Service" : ""
    ]);
  }
  function syncToggles() {
    document.querySelectorAll("[data-t]").forEach(function (el) { el.checked = !!S[el.dataset.t]; });
  }
  document.querySelectorAll("[data-t]").forEach(function (el) {
    el.addEventListener("change", function () { S[el.dataset.t] = el.checked; update(); });
  });
  function renderFeat() {
    var box = $("#featBox");
    if (!box) return;
    var on = S.platform === "website";
    box.hidden = !on;
    $("#featOut").value = on ? lines(S.features).join("\n") : "";
  }
  $("#copyFeat").addEventListener("click", function () {
    var b = $("#copyFeat"), t = $("#featOut"), o = b.textContent;
    function done(ok) { b.textContent = ok ? "Copied" : "Press Ctrl+C"; setTimeout(function () { b.textContent = o; }, 1600); }
    function fb() { t.focus(); t.select(); var k = false; try { k = document.execCommand("copy"); } catch (e) {} done(k); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t.value).then(function () { done(true); }, fb);
    else fb();
  });

  function update() {
    lsSet("drivex.ad.v1", S);
    out.value = buildAd(S);
    renderFeat();
    syncToggles();
    counts();
    renderCalc(); renderTerms();
  }

  function syncFields() {
    document.querySelectorAll("[data-k]").forEach(function (el) { el.value = S[el.dataset.k] == null ? "" : S[el.dataset.k]; });
  }

  document.querySelectorAll("[data-k]").forEach(function (el) {
    el.addEventListener("input", function () { S[el.dataset.k] = el.value; update(); });
  });

  $("#saveCar").addEventListener("click", function () {
    var c = {};
    CAR_KEYS.forEach(function (k) { c[k] = S[k]; });
    upsertCar(c);
    var b = $("#saveCar"); b.textContent = "Saved"; setTimeout(function () { b.textContent = "Save this car"; }, 1400);
  });

  $("#blankCar").addEventListener("click", function () {
    $("#fromCar").textContent = "";
    CAR_KEYS.forEach(function (k) { S[k] = ""; });
    S.specs = "GCC"; S.fuel = "";
    syncFields(); update();
    $("#year").focus();
  });

  function copy(btn) {
    var text = out.value, orig = btn.textContent;
    function done(ok) {
      btn.textContent = ok ? "Copied" : "Press Ctrl+C";
      setTimeout(function () { btn.textContent = orig; }, 1600);
    }
    function fallback() {
      out.focus(); out.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    } else fallback();
  }
  $("#copy").addEventListener("click", function () { copy($("#copy")); });
  $("#copy2").addEventListener("click", function () { copy($("#copy2")); });

  function upsertCar(c) {
    var key = (c.year + " " + c.name).trim().toLowerCase();
    var idx = -1;
    cars.forEach(function (o, i) { if ((o.year + " " + o.name).trim().toLowerCase() === key) idx = i; });
    if (idx >= 0) cars[idx] = c; else cars.push(c);
    lsSet("drivex.cars.v1", cars);
    renderCars();
  }

  function counts() {
    var len = out.value.length, over = false, txt = len.toLocaleString("en-US") + " characters";
    if (S.platform === "instagram") {
      over = len > 2200;
      txt = len.toLocaleString("en-US") + " / 2,200" + (over ? " (too long)" : "");
    }
    ["#count", "#count2"].forEach(function (id) { var el = $(id); el.textContent = txt; el.classList.toggle("over", over); });
  }
  out.addEventListener("input", counts);

  /* ---------- platform tabs ---------- */
  function setPlatform(p) {
    S.platform = p;
    document.querySelectorAll(".tab").forEach(function (b) {
      var on = b.dataset.p === p;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    update();
  }
  document.querySelectorAll(".tab").forEach(function (b) {
    b.addEventListener("click", function () { setPlatform(b.dataset.p); });
  });

  /* ---------- text file import ---------- */
  var ALIAS = {
    year: ["year", "modelyear", "model"], name: ["name", "car", "makemodel", "vehicle", "title", "carname"],
    price: ["price", "askingprice"], specs: ["specs", "spec", "regionalspecs"],
    mileage: ["mileage", "km", "kilometers", "kilometres", "odometer"], fuel: ["fuel", "fueltype"],
    engine: ["engine"], hp: ["horsepower", "hp", "power"], accel: ["acceleration", "accel", "0100"],
    trans: ["transmission", "gearbox"], drive: ["drivetrain", "drive", "driveline"],
    ext: ["exteriorcolor", "exterior", "color", "colour"], int: ["interiorcolor", "interior"],
    service: ["servicehistory", "service"], warranty: ["warranty"], scontract: ["servicecontract", "servicescontract"], features: ["keyfeatures", "features", "feature", "keyfeature", "featureslist", "featurelist", "carfeatures"]
  };
  var LABELS = {
    year: "Model year", name: "Make & model", price: "Price", specs: "Specs", mileage: "Mileage", fuel: "Fuel type",
    engine: "Engine", hp: "Horsepower", accel: "0–100 time", trans: "Transmission", drive: "Drivetrain",
    ext: "Exterior color", int: "Interior color", service: "Service history", warranty: "Warranty", scontract: "Service contract", features: "Key features"
  };
  var HEADERS = { pricingoverview: 1, performanceengineering: 1, exteriorinteriorcolors: 1, vehiclehistorywarranty: 1, financeoptions: 1 };
  var KEYMAP = {};
  Object.keys(ALIAS).forEach(function (k) { ALIAS[k].forEach(function (a) { KEYMAP[a] = k; }); });
  var norm = function (t) { return String(t).toLowerCase().replace(/[^a-z0-9]/g, ""); };
  var BULLET = /^[•\-*–·▪●✅✔✓☑➤➜]\s*/;

  function parseCar(text) {
    var car = {}, feats = [], mode = null, title = "", fBullet = false;
    String(text).replace(/^﻿/, "").normalize("NFKC").split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) { if (mode === "f" && feats.length && !fBullet) mode = null; return; }
      var hasBullet = BULLET.test(line);
      var body = line.replace(BULLET, "");
      if (!body) return;
      var m = body.match(/^([^:：]{1,40})[:：]\s*(.*)$/);
      var key = m ? KEYMAP[norm(m[1])] : null;
      if (key) {
        var val = m[2].trim();
        if (key === "features") {
          mode = "f";
          if (val) val.split(/\s*[;|•·،]\s*|\s*,\s*/).forEach(function (x) { if (x) feats.push(x); });
        } else { mode = null; if (val) car[key] = val; }
        return;
      }
      var n = norm(body);
      if (KEYMAP[n] === "features") { mode = "f"; return; }
      if (HEADERS[n]) { mode = null; return; }
      if (mode === "f") {
        if (fBullet && !hasBullet) mode = null;
        else { if (!feats.length) fBullet = hasBullet; feats.push(body); return; }
      }
      if (!title && !hasBullet && /^\d{4}\s+\S/.test(body)) title = body;
    });
    if (title) {
      var t = title.match(/^(\d{4})\s+(.*)$/);
      if (t) { if (!car.year) car.year = t[1]; if (!car.name) car.name = t[2]; }
    }
    if (car.year && !/(19|20)\d{2}/.test(car.year)) { if (!car.name) car.name = car.year; delete car.year; }
    if (car.year) car.year = car.year.match(/(19|20)\d{2}/)[0];
    ["price", "mileage"].forEach(function (k) { if (car[k]) { var d = car[k].replace(/[^\d.]/g, ""); if (d) car[k] = d; else delete car[k]; } });
    ["hp", "accel"].forEach(function (k) { if (car[k]) { var d = car[k].match(/\d+(\.\d+)?/); if (d) car[k] = d[0]; else delete car[k]; } });
    if (feats.length) car.features = feats.join("\n");
    var found = [], missing = [];
    CAR_KEYS.forEach(function (k) { if (k === "scontract" && !car[k]) return; (car[k] ? found : missing).push(LABELS[k]); });
    return { car: car, found: found, missing: missing };
  }

  function setStatus(msg, kind) {
    var el = $("#status");
    el.textContent = msg;
    el.className = "status" + (kind ? " " + kind : "");
  }
  function applyCar(car) {
    $("#fromCar").textContent = "";
    CAR_KEYS.forEach(function (k) { S[k] = car[k] != null ? car[k] : ""; });
    armed = -1; syncFields(); update();
  }
  function carTitle(c) { return ((c.year || "") + " " + (c.name || "")).trim() || "Untitled car"; }

  function importTexts(items) {
    var results = items.map(function (it) { var r = parseCar(it.text); r.file = it.name; return r; });
    var usable = results.filter(function (r) { return r.found.length > 0; });
    if (!usable.length) { setStatus("No car fields found. Each line should look like “Price: 99000”, and the first line should be the year and model.", "bad"); return; }
    var msg = [];
    lastBatch = usable.map(function (r) { return Object.assign({}, blankCar(), r.car); });
    showDl();
    if (usable.length > 1) usable.forEach(function (r) { upsertCar(Object.assign({}, blankCar(), r.car)); });
    applyCar(usable[usable.length - 1].car);
    if (usable.length > 1) msg.push("Loaded " + usable.length + " cars into Saved cars. Showing " + carTitle(usable[usable.length - 1].car) + ".");
    usable.forEach(function (r) {
      var head = usable.length > 1 ? carTitle(r.car) + ": " : "Filled " + r.found.length + " of " + CAR_KEYS.length + " fields. ";
      msg.push(head + (r.missing.length ? "Not found: " + r.missing.join(", ") + "." : (usable.length > 1 ? "All fields found." : "All fields found.")));
    });
    if (results.length > usable.length) msg.push((results.length - usable.length) + " file(s) skipped because no car fields were found.");
    setStatus(msg.join("\n"), usable.every(function (r) { return !r.missing.length; }) ? "ok" : "bad");
  }
  function blankCar() { var c = {}; CAR_KEYS.forEach(function (k) { c[k] = ""; }); return c; }

  function readText(file) {
    return new Promise(function (resolve) {
      var r = new FileReader();
      r.onload = function () { resolve({ name: file.name, text: String(r.result || "") }); };
      r.onerror = function () { resolve({ name: file.name, text: "" }); };
      r.readAsText(file);
    });
  }
  function handleFiles(list) {
    var files = Array.prototype.slice.call(list || []);
    if (!files.length) return;
    Promise.all(files.map(readText)).then(importTexts);
  }
  $("#pick").addEventListener("click", function () { $("#file").click(); });
  $("#file").addEventListener("change", function (e) { handleFiles(e.target.files); e.target.value = ""; });
  var drop = $("#drop");
  ["dragenter", "dragover"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); });
  });
  drop.addEventListener("drop", function (e) { handleFiles(e.dataTransfer && e.dataTransfer.files); });

  $("#fillPaste").addEventListener("click", function () {
    var t = $("#paste").value;
    if (!t.trim()) { setStatus("Paste the car text first.", "bad"); return; }
    importTexts([{ name: "pasted text", text: t }]);
  });


  /* ---------- Dubizzle downloads ---------- */
  var lastBatch = [];
  // Plain browser download (the original page used Claude's download helper).
  var dlApi = {
    save: function (req) {
      return new Promise(function (resolve, reject) {
        try {
          var blob = req.data instanceof Blob ? req.data : new Blob([req.data], { type: "text/plain;charset=utf-8" });
          var url = URL.createObjectURL(blob);
          var a = document.createElement("a");
          a.href = url; a.download = req.filename;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
          resolve();
        } catch (e) { reject(e); }
      });
    }
  };
  function showDl() {
    var row = $("#dlrow");
    row.hidden = !dlApi || !(lastBatch.length || cars.length);
    $("#dlBatch").hidden = !lastBatch.length;
    $("#dlBatch").textContent = lastBatch.length > 1 ? "Download " + lastBatch.length + " Dubizzle ads (.zip)" : "Download Dubizzle ad (.txt)";
    $("#dlAll").hidden = !cars.length || (cars.length === lastBatch.length && lastBatch.length > 0);
    $("#dlAll").textContent = "Download all " + cars.length + " saved cars (.zip)";
  }
  function safeName(c, used) {
    var n = carTitle(c).replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, "_").replace(/^_+|_+$/g, "") || "car";
    var base = n, i = 2; while (used[n]) n = base + "_" + i++;
    used[n] = 1; return n;
  }
  var CRC = (function () { var t = [], c, n, k; for (n = 0; n < 256; n++) { c = n; for (k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function makeZip(files) {
    var enc = new TextEncoder(), parts = [], cen = [], off = 0;
    function u16(v) { return [v & 255, (v >>> 8) & 255]; }
    function u32(v) { return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.text), crc = crc32(data);
      var h = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(h), name, data);
      cen.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off))), name);
      off += h.length + name.length + data.length;
    });
    var csize = 0; cen.forEach(function (x) { csize += x.length; });
    var end = new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(csize), u32(off), u16(0)));
    return new Blob(parts.concat(cen, [end]), { type: "application/zip" });
  }
  function dubizzleFor(c) { return buildDubizzle(Object.assign({}, S, c, { platform: "dubizzle" })); }
  function download(list, label) {
    var msg = $("#dlmsg");
    if (!dlApi || !list.length) return;
    var used = {}, files = list.map(function (c) { return { name: safeName(c, used) + "_Dubizzle.txt", text: dubizzleFor(c) }; });
    var req = files.length === 1 ? { filename: files[0].name, data: files[0].text }
      : { filename: "DriveX_Dubizzle_ads_" + files.length + "_cars.zip", data: makeZip(files) };
    msg.className = "status"; msg.textContent = "";
    dlApi.save(req).then(function () {
      msg.className = "status ok"; msg.textContent = "Saved " + files.length + " Dubizzle ad" + (files.length > 1 ? "s" : "") + ".";
    }, function (e) {
      msg.className = "status bad";
      msg.textContent = e && e.code === "declined" ? "Download cancelled." : "Download isn’t available here. Open each car and use Copy instead.";
    });
  }
  $("#dlBatch").addEventListener("click", function () { download(lastBatch); });
  $("#dlAll").addEventListener("click", function () { download(cars); });

  /* ---------- start from a car saved in the admin (?vehicle=ID) ---------- */
  function loadVehicle(id) {
    var box = $("#fromCar");
    box.textContent = "Loading car…";
    fetch("/admin/api/vehicles/" + encodeURIComponent(id), { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (v) {
        var str = function (x) { return x == null ? "" : String(x).trim(); };
        var year = str(v.year);
        var title = str(v.title).replace(/^(19|20)\d{2}\s+/, "");
        var car = blankCar();
        car.year = year;
        car.name = title || (str(v.make) + " " + str(v.model)).trim();
        car.price = str(v.price);
        car.mileage = str(v.mileage);
        car.engine = str(v.engine);
        car.trans = str(v.transmission);
        car.fuel = str(v.fuel_type);
        car.ext = str(v.color);
        car.specs = "GCC";
        car.service = S.service || DEF.service;
        car.warranty = S.warranty || DEF.warranty;
        car.features = (Array.isArray(v.features) ? v.features : []).map(str).filter(Boolean).join("\n");
        applyCar(car);
        var empty = ["hp", "accel", "drive", "int"].map(function (k) { return LABELS[k]; });
        box.textContent = "Filled from " + carTitle(car) + ". Specs is set to GCC. Please check it and fill in: " + empty.join(", ") + ".";
      })
      .catch(function () { box.textContent = "Couldn’t load that car. You can still fill the form in by hand."; });
  }
  var vid = new URLSearchParams(location.search).get("vehicle");
  if (vid && /^\d+$/.test(vid)) loadVehicle(vid);

  var SAMPLE = [
    "2024 Opel Zafira Life",
    "Price: 99000",
    "Specs: GCC",
    "Mileage: 73000",
    "Engine: 2.0-liter 4-cylinder diesel engine",
    "Horsepower: 180",
    "Transmission: 8-Speed Automatic",
    "Drivetrain: Front-Wheel Drive (FWD)",
    "Acceleration: 10.4",
    "Fuel: Diesel",
    "Exterior Color: Black",
    "Interior Color: Black",
    "Service History: Fully Serviced",
    "Warranty: 1 Year Warranty Unlimited KM",
    "Key Features:",
    "- Dual Power Sliding Side Doors",
    "- 7-inch Touchscreen",
    "- Panoramic Sunroof",
    "- Premium Leather Upholstery"
  ].join("\n");
  var TEMPLATE = [
    "Model year:", "Make & model:", "Price:", "Specs: GCC", "Mileage:", "Fuel type:", "Engine:", "Horsepower:",
    "Acceleration:", "Transmission:", "Drivetrain:", "Exterior color:", "Interior color:",
    "Service history: Fully Serviced", "Warranty: 1 Year Warranty Unlimited KM", "",
    "Key Features:", "-", "-", "-", "-", "-", "-", "-", "-", "-"
  ].join("\n");
  $("#copyTpl").addEventListener("click", function () {
    var b = $("#copyTpl"), orig = b.textContent;
    var done = function (ok) {
      b.textContent = ok ? "Copied" : "Copy failed";
      setStatus(ok ? "Blank template copied. Paste it into a new .txt file, fill it in, and upload it here." : "Your browser blocked copying. Use the sample under “Paste text instead” and edit it.", ok ? "ok" : "bad");
      setTimeout(function () { b.textContent = orig; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(TEMPLATE).then(function () { done(true); }, function () { done(false); });
    else done(false);
  });
  $("#sample").textContent = SAMPLE;
  $("#copySample").addEventListener("click", function () {
    var b = $("#copySample"), orig = b.textContent;
    var done = function (ok) { b.textContent = ok ? "Copied" : "Select and copy manually"; setTimeout(function () { b.textContent = orig; }, 1600); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(SAMPLE).then(function () { done(true); }, function () { done(false); });
    else done(false);
  });

  syncFields(); renderCars(); setPlatform(S.platform || "dubizzle");
})();
