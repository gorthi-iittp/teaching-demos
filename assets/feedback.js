/*
 * Demo feedback: predict-then-check question, "did this help?", optional comment.
 *
 * A page opts in with two empty mount points and a config object, then loads this file:
 *
 *   <div id="fb-predict"></div>          (near the top, optional)
 *   ...demo...
 *   <div id="fb-reflect"></div>          (near the end)
 *   <script>window.DEMO_FEEDBACK = { demo: "pca1", ... };</script>
 *   <link rel="stylesheet" href="../assets/feedback.css">
 *   <script src="../assets/feedback.js" defer></script>
 *
 * Where answers go (both optional; with neither, the widget still works and sends nothing):
 *   goatcounter : "https://CODE.goatcounter.com/count"  -> anonymous counts of each answer
 *   form        : Google Form "formResponse" URL + entry ids -> one row per submission
 * Set debug: true to log every would-be submission to the browser console.
 */
(function () {
  "use strict";
  var cfg = window.DEMO_FEEDBACK;
  if (!cfg || !cfg.demo) return;

  var Q = cfg.question || null;
  var KEY = "fb:" + cfg.demo;

  // ------------------------------------------------------------ per-viewer memory
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} }
  var st = load();

  // ------------------------------------------------------------ sinks
  var gcQueue = [];
  if (cfg.goatcounter && !window.goatcounter) {
    var gs = document.createElement("script");
    gs.async = true;
    gs.src = "//gc.zgo.at/count.js";
    gs.setAttribute("data-goatcounter", cfg.goatcounter);
    document.head.appendChild(gs);
  }
  function flushGC() {
    if (!window.goatcounter || !window.goatcounter.count) return false;
    while (gcQueue.length) window.goatcounter.count(gcQueue.shift());
    return true;
  }
  function event(name, title) {
    var ev = { path: "fb/" + cfg.demo + "/" + name, title: title || name, event: true };
    if (cfg.debug) console.log("[feedback] event", ev.path);
    if (!cfg.goatcounter) return;
    gcQueue.push(ev);
    if (!flushGC()) {
      var tries = 0, t = setInterval(function () { if (flushGC() || ++tries > 50) clearInterval(t); }, 200);
    }
  }
  function formRow(extra) {
    var f = cfg.form || {}, e = f.fields || {};
    var row = {
      demo: cfg.demo, pre: st.pre == null ? "" : letter(st.pre), post: st.post == null ? "" : letter(st.post),
      helpful: st.helpful || "", comment: (extra && extra.comment) || ""
    };
    if (cfg.debug) console.log("[feedback] form row", row);
    if (!f.action) return;
    var body = new URLSearchParams();                 // url-encoded: what Google Forms expects
    Object.keys(row).forEach(function (k) { if (e[k]) body.append(e[k], row[k]); });
    try { fetch(f.action, { method: "POST", mode: "no-cors", body: body }); } catch (err) {}
  }

  // ------------------------------------------------------------ helpers
  function letter(i) { return String.fromCharCode(65 + i); }
  function h(tag, attrs, html) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "on") Object.keys(attrs.on).forEach(function (ev) { el.addEventListener(ev, attrs.on[ev]); });
      else el.setAttribute(k, attrs[k]);
    });
    if (html != null) el.innerHTML = html;
    return el;
  }
  function options(onPick, chosen, lockAll) {
    var list = h("div", { "class": "fb-opts", role: "radiogroup" });
    Q.options.forEach(function (text, i) {
      var b = h("button", { type: "button", "class": "fb-opt" + (chosen === i ? " on" : ""), role: "radio",
        "aria-checked": chosen === i ? "true" : "false" },
        "<span class=\"fb-letter\">" + letter(i) + "</span><span>" + text + "</span>");
      if (lockAll) b.disabled = true;
      else b.addEventListener("click", function () { onPick(i); });
      list.appendChild(b);
    });
    return list;
  }

  // ------------------------------------------------------------ top card: predict
  var predictBox = document.getElementById("fb-predict");
  function renderPredict() {
    if (!predictBox || !Q) return;
    predictBox.innerHTML = "";
    var card = h("section", { "class": "fb-card fb-predict", "aria-label": "Predict before you try" });
    card.appendChild(h("p", { "class": "fb-kicker" }, "Before you start &middot; predict"));
    if (st.pre == null) {
      var pick = null;
      card.appendChild(h("p", { "class": "fb-q" }, Q.text));
      var lockBtn = h("button", { type: "button", "class": "fb-btn primary", disabled: "disabled" }, "Lock in my prediction");
      var opts = options(function (i) {
        pick = i;
        Array.prototype.forEach.call(opts.children, function (c, k) {
          c.classList.toggle("on", k === i); c.setAttribute("aria-checked", k === i ? "true" : "false");
        });
        lockBtn.disabled = false;
      }, null, false);
      card.appendChild(opts);
      lockBtn.addEventListener("click", function () {
        if (pick == null) return;
        st.pre = pick; save(st);
        event("pre/" + letter(pick), "prediction " + letter(pick));
        renderPredict(); renderReflect();
      });
      var row = h("div", { "class": "fb-row" });
      row.appendChild(lockBtn);
      row.appendChild(h("span", { "class": "fb-note" }, "Anonymous. You will check it at the end of the page."));
      card.appendChild(row);
    } else {
      card.classList.add("done");
      card.appendChild(h("p", { "class": "fb-done" },
        "Prediction locked in: <b>" + letter(st.pre) + "</b>. Now try the demo, then " +
        "<a href=\"#fb-reflect\">check your answer at the end</a>."));
    }
    predictBox.appendChild(card);
  }

  // ------------------------------------------------------------ bottom card: check, helpful, comment
  var reflectBox = document.getElementById("fb-reflect");
  function renderReflect() {
    if (!reflectBox) return;
    reflectBox.innerHTML = "";
    var card = h("section", { "class": "fb-card fb-reflect", "aria-label": "Check your understanding and give feedback" });

    // 1. check
    if (Q) {
      card.appendChild(h("p", { "class": "fb-kicker" }, "Check your understanding"));
      card.appendChild(h("p", { "class": "fb-q" }, Q.text));
      if (st.pre != null && st.post == null)
        card.appendChild(h("p", { "class": "fb-note" }, "You predicted <b>" + letter(st.pre) + "</b>. Having tried the demo, what do you say now?"));
      card.appendChild(options(function (i) {
        if (st.post != null) return;
        st.post = i; save(st);
        event("post/" + letter(i), "answer " + letter(i));
        event("post/" + (i === Q.correct ? "right" : "wrong"));
        if (st.pre != null) event("change/" + letter(st.pre) + "-" + letter(i));
        renderReflect();
      }, st.post, st.post != null));
      if (st.post != null) {
        var right = st.post === Q.correct;
        var msg = (right ? "<b class=\"fb-right\">Right.</b> " : "<b class=\"fb-wrong\">Not quite &mdash; the answer is " + letter(Q.correct) + ".</b> ") + Q.explain;
        if (st.pre != null && st.pre !== st.post) msg += " <span class=\"fb-note\">You changed your answer after trying the demo.</span>";
        card.appendChild(h("p", { "class": "fb-explain", "aria-live": "polite" }, msg));
      }
      card.appendChild(h("hr", { "class": "fb-rule" }));
    }

    // 2. helpful
    card.appendChild(h("p", { "class": "fb-kicker" }, "Your feedback"));
    card.appendChild(h("p", { "class": "fb-q" }, cfg.helpfulText || "Did this demo help you?"));
    var hrow = h("div", { "class": "fb-row" });
    [["yes", "&#128077; Yes, it helped"], ["no", "&#128078; Not really"]].forEach(function (p) {
      var b = h("button", { type: "button", "class": "fb-btn" + (st.helpful === p[0] ? " on" : "") }, p[1]);
      if (st.helpful) b.disabled = true;
      else b.addEventListener("click", function () {
        st.helpful = p[0]; save(st);
        event("helpful/" + p[0], "helpful " + p[0]);
        renderReflect();
      });
      hrow.appendChild(b);
    });
    card.appendChild(hrow);

    // 3. comment
    if (st.helpful && !st.sent) {
      var ta = h("textarea", { "class": "fb-text", rows: "3", maxlength: "1000",
        placeholder: st.helpful === "yes" ? "What helped most, or what would you add? (optional)" : "What was confusing, or what would have helped? (optional)",
        "aria-label": "Optional comment" });
      card.appendChild(ta);
      var srow = h("div", { "class": "fb-row" });
      var send = h("button", { type: "button", "class": "fb-btn primary" }, "Send");
      var skip = h("button", { type: "button", "class": "fb-link" }, "Skip");
      function finish(comment) {
        st.sent = true; save(st);
        formRow({ comment: comment });
        if (comment) event("comment", "left a comment");
        renderReflect();
      }
      send.addEventListener("click", function () { finish(ta.value.trim()); });
      skip.addEventListener("click", function () { finish(""); });
      srow.appendChild(send); srow.appendChild(skip);
      srow.appendChild(h("span", { "class": "fb-note" }, "Anonymous: no name, email or login is recorded."));
      card.appendChild(srow);
    } else if (st.sent) {
      card.appendChild(h("p", { "class": "fb-done" }, "Thank you &mdash; your feedback has been sent."));
    }

    // reset (for the same viewer trying again, e.g. in class)
    var reset = h("button", { type: "button", "class": "fb-link fb-reset" }, "Start again");
    reset.addEventListener("click", function () { st = {}; save(st); renderPredict(); renderReflect(); });
    if (st.pre != null || st.post != null || st.helpful) card.appendChild(reset);

    reflectBox.appendChild(card);
  }

  renderPredict();
  renderReflect();
})();
