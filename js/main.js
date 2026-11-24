(function () {
  "use strict";
  var doc = document.documentElement;
  var root = doc.getAttribute("data-root") || "";
  var pageUrl = doc.getAttribute("data-url") || location.href.split("?")[0];
  var LANGS = ["en", "es"];
  var cache = {};
  var dict = null;
  var current = "en";

  function stored() {
    try { return localStorage.getItem("lang"); } catch (e) { return null; }
  }
  function store(l) {
    try { localStorage.setItem("lang", l); } catch (e) { /* storage blocked: toggle still works for this page */ }
  }
  function initial() {
    var q = new URLSearchParams(location.search).get("lang");
    if (LANGS.indexOf(q) >= 0) { store(q); return q; }
    var s = stored();
    return LANGS.indexOf(s) >= 0 ? s : "en";
  }
  function lookup(d, key) {
    return key.split(".").reduce(function (o, p) { return o == null ? undefined : o[p]; }, d);
  }
  function load(l) {
    if (cache[l]) return Promise.resolve(cache[l]);
    return fetch(root + "i18n/" + l + ".json").then(function (r) {
      if (!r.ok) throw new Error("i18n " + r.status);
      return r.json();
    }).then(function (d) { cache[l] = d; return d; });
  }

  function apply(d, l) {
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = lookup(d, el.getAttribute("data-i18n"));
      if (typeof v === "string") el.textContent = v;
    });
    document.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      var v = lookup(d, el.getAttribute("data-i18n-html"));
      if (typeof v === "string") el.innerHTML = v;
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split(";").forEach(function (pair) {
        var i = pair.indexOf(":");
        var v = lookup(d, pair.slice(i + 1));
        if (typeof v !== "string") return;
        var attr = pair.slice(0, i);
        el.setAttribute(attr, attr === "href" ? root + v : v);
      });
    });
    doc.lang = l;
    var canon = document.querySelector('link[rel="canonical"]');
    if (canon) canon.href = pageUrl + (l === "es" ? "?lang=es" : "");
    var og = document.querySelector('meta[property="og:locale"]');
    var ogAlt = document.querySelector('meta[property="og:locale:alternate"]');
    if (og) og.content = l === "es" ? "es_ES" : "en_US";
    if (ogAlt) ogAlt.content = l === "es" ? "en_US" : "es_ES";
    var btn = document.getElementById("lang-toggle");
    if (btn) {
      btn.textContent = d.meta.toggle_short;
      btn.setAttribute("aria-label", d.meta.toggle_label);
      btn.setAttribute("lang", l === "en" ? "es" : "en");
    }
    dict = d;
    current = l;
    refreshDecks();
  }

  function setLang(l, save) {
    if (save) store(l);
    return load(l).then(function (d) { apply(d, l); }).catch(function () {
      doc.lang = "en";
    }).then(function () { doc.classList.remove("i18n-pending"); });
  }

  var decks = [];
  function progressText(n, total) {
    var t = dict ? lookup(dict, "cs_t.progress") : null;
    if (typeof t !== "string") t = "Slide {n} of {total}";
    return t.replace("{n}", n).replace("{total}", total);
  }
  function refreshDecks() { decks.forEach(function (d) { d.render(); }); }

  function makeDeck(deck) {
    var slides = Array.prototype.slice.call(deck.querySelectorAll(".slide"));
    var idx = 0;
    var bar = document.createElement("div");
    bar.className = "deck-nav";
    bar.innerHTML = '<button type="button" class="deck-btn deck-prev" data-i18n="cs_t.prev">Previous</button>' +
      '<p class="deck-progress" aria-live="polite"></p>' +
      '<button type="button" class="deck-btn deck-next" data-i18n="cs_t.next">Next</button>';
    deck.parentNode.insertBefore(bar, deck.nextSibling);
    var prev = bar.querySelector(".deck-prev");
    var next = bar.querySelector(".deck-next");
    var prog = bar.querySelector(".deck-progress");
    var steps = document.createElement("ol");
    steps.className = "deck-steps";
    var line = document.createElement("div");
    line.className = "deck-bar";
    line.setAttribute("aria-hidden", "true");
    line.innerHTML = "<span></span>";
    slides.forEach(function (s, i) {
      s.setAttribute("role", "group");
      s.setAttribute("aria-roledescription", "slide");
      var name = s.id.slice(s.id.indexOf("-") + 1);
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.type = "button";
      b.innerHTML = '<span aria-hidden="true">0' + (i + 1) + '</span><b data-i18n="cs_t.' + name + '"></b>';
      b.querySelector("b").textContent = (s.querySelector(".slide-title [data-i18n]") || s).textContent;
      b.addEventListener("click", function () { go(i); });
      li.appendChild(b);
      steps.appendChild(li);
    });
    deck.parentNode.insertBefore(steps, deck);
    deck.parentNode.insertBefore(line, deck);
    deck.classList.add("is-js");

    function render() {
      slides.forEach(function (s, i) {
        var on = i === idx;
        s.hidden = !on;
        if (!on) s.classList.remove("is-active");
        else if (!s.classList.contains("is-active")) requestAnimationFrame(function () { requestAnimationFrame(function () { s.classList.add("is-active"); }); });
      });
      Array.prototype.forEach.call(steps.querySelectorAll("button"), function (b, i) {
        if (i === idx) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
      });
      line.firstChild.style.width = (100 * (idx + 1) / slides.length) + "%";
      prev.setAttribute("aria-disabled", String(idx === 0));
      next.setAttribute("aria-disabled", String(idx === slides.length - 1));
      prog.textContent = progressText(idx + 1, slides.length);
    }
    function go(i) {
      if (i < 0 || i >= slides.length || i === idx) return;
      idx = i;
      render();
    }
    function goId(id) {
      for (var i = 0; i < slides.length; i++) if (slides[i].id === id) { idx = i; render(); return true; }
      return false;
    }
    prev.addEventListener("click", function () { go(idx - 1); });
    next.addEventListener("click", function () { go(idx + 1); });
    function onKey(e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowRight") { go(idx + 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { go(idx - 1); e.preventDefault(); }
      else if (e.key === "Home") { go(0); e.preventDefault(); }
      else if (e.key === "End") { go(slides.length - 1); e.preventDefault(); }
    }
    deck.tabIndex = 0;
    deck.addEventListener("keydown", onKey);
    bar.addEventListener("keydown", onKey);
    var x0 = null, y0 = null;
    deck.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    deck.addEventListener("touchend", function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(idx + (dx < 0 ? 1 : -1));
    }, { passive: true });
    var api = { render: render, goId: goId, reset: function () { idx = 0; render(); } };
    render();
    return api;
  }

  function initCases() {
    var tabs = document.querySelectorAll(".case-tab");
    if (!tabs.length) return;
    var panels = {};
    document.querySelectorAll(".case-panel").forEach(function (p) {
      var deckEl = p.querySelector(".deck");
      var d = deckEl ? makeDeck(deckEl) : null;
      if (d) decks.push(d);
      panels[p.id] = { el: p, deck: d };
    });
    document.querySelector(".cases").classList.add("is-tabbed");
    function show(hash, scroll) {
      var h = (hash || "").replace(/^#/, "");
      var id = h.split("-")[0];
      if (!panels[id]) { id = tabs[0].getAttribute("data-case"); h = ""; }
      Object.keys(panels).forEach(function (k) { panels[k].el.hidden = k !== id; });
      tabs.forEach(function (t) {
        if (t.getAttribute("data-case") === id) t.setAttribute("aria-current", "true");
        else t.removeAttribute("aria-current");
      });
      var d = panels[id].deck;
      if (d && !(h.indexOf("-") > 0 && d.goId(h))) d.reset();
      if (scroll) panels[id].el.scrollIntoView({ block: "start" });
    }
    tabs.forEach(function (t) {
      t.addEventListener("click", function (e) {
        e.preventDefault();
        var id = t.getAttribute("data-case");
        history.replaceState(null, "", location.pathname + location.search + "#" + id);
        show(id, false);
      });
    });
    window.addEventListener("hashchange", function () { show(location.hash, true); });
    show(location.hash, false);
    if (location.hash) window.addEventListener("load", function () {
      var p = document.querySelector(".case-panel:not([hidden])");
      if (p) setTimeout(function () { p.scrollIntoView({ block: "start" }); }, 0);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initCases();
    var btn = document.getElementById("lang-toggle");
    if (btn) btn.addEventListener("click", function () {
      if (location.search.indexOf("lang=") >= 0) history.replaceState(null, "", location.pathname + location.hash);
      setLang(current === "en" ? "es" : "en", true);
    });
    var l = initial();
    if (l !== "en") setLang(l, false);
    else { load("en").then(function (d) { dict = d; refreshDecks(); }).catch(function () {}); doc.classList.remove("i18n-pending"); }
  });
  setTimeout(function () { doc.classList.remove("i18n-pending"); }, 1500);
})();
