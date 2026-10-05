(function () {
  "use strict";

  const DAY_MS = 86400000;
  const $ = (id) => document.getElementById(id);

  const pad = (n) => String(n).padStart(2, "0");
  const dayOf = (d) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - EPOCH_UTC) / DAY_MS);
  const dateOf = (day) => new Date(EPOCH_UTC + day * DAY_MS).toISOString().slice(0, 10);
  const today = dayOf(new Date());

  let rows = [];
  let shownDays = 30;

  async function api(url, body) {
    const opts = body === undefined ? { cache: "no-store" } : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
    const r = await fetch(url, opts);
    let data = {};
    try { data = await r.json(); } catch (e) { /* not JSON */ }
    if (r.status === 401 && url !== "/api/admin/login") showLogin();
    return { ok: r.ok, data };
  }

  function say(text, ok) {
    const m = $("msg");
    m.textContent = text || "";
    m.className = ok ? "ok" : "err";
  }

  // ---------- login ----------

  function showLogin() {
    $("login").hidden = false;
    $("panel").hidden = true;
  }

  function showPanel() {
    $("login").hidden = true;
    $("panel").hidden = false;
    $("todayLine").textContent = "Today for players: " + dateOf(today);
    loadSchedule();
  }

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("loginMsg").textContent = "";
    const r = await api("/api/admin/login", { username: $("u").value, password: $("p").value });
    if (!r.ok) { $("loginMsg").textContent = r.data.error || "Login failed."; return; }
    $("p").value = "";
    showPanel();
  });

  $("logout").addEventListener("click", async () => {
    await api("/api/admin/logout", {});
    showLogin();
  });

  // ---------- form ----------

  BOOKS.forEach((b) => {
    const o = document.createElement("option");
    o.value = o.textContent = b.name;
    $("book").appendChild(o);
  });
  VERSES.forEach((v, i) => {
    const o = document.createElement("option");
    o.value = i;
    o.textContent = v.book + " " + v.ch + ":" + v.v;
    $("preset").appendChild(o);
  });

  function fill(row) {
    $("date").value = row.date || $("date").value;
    $("book").value = row.book;
    $("ch").value = row.ch;
    $("v").value = row.v;
    $("text").value = row.text;
    updateWarn();
  }

  function updateWarn() {
    const t = $("date").value === dateOf(today);
    $("warn").hidden = !t;
    $("formTitle").textContent = "Set a verse for " + ($("date").value || "…");
  }

  function clearForm() {
    $("date").value = dateOf(today + 1);
    $("preset").value = "";
    $("book").value = BOOKS[0].name;
    $("ch").value = $("v").value = $("text").value = "";
    say("");
    updateWarn();
  }

  $("preset").addEventListener("change", () => {
    const v = VERSES[$("preset").value];
    if (v) fill({ book: v.book, ch: v.ch, v: v.v, text: v.text });
  });
  $("date").addEventListener("change", updateWarn);
  $("reset").addEventListener("click", clearForm);

  async function save(date) {
    const r = await api("/api/admin/schedule", {
      date, book: $("book").value, ch: $("ch").value, v: $("v").value, text: $("text").value,
    });
    if (!r.ok) return say(r.data.error || "Couldn't save.");
    say("Saved " + r.data.row.book + " " + r.data.row.ch + ":" + r.data.row.v + " for " + date + ".", true);
    loadSchedule();
  }

  $("save").addEventListener("click", () => {
    if (!$("date").value) return say("Pick a date.");
    if ($("date").value === dateOf(today) && !confirm("This changes today's verse for everyone, and resets games already in progress. Continue?")) return;
    save($("date").value);
  });

  $("queue").addEventListener("click", () => {
    const open = rows.find((r) => r.day > today && r.source === "default");
    if (!open) return say("No open day in the list. Show more days first.");
    save(open.date);
  });

  // ---------- schedule ----------

  function cell(tag, text, cls) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function renderSchedule() {
    const t = $("sched");
    t.innerHTML = "";
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.appendChild(cell("td", r.date, "date"));

      const info = cell("td");
      const head = cell("strong", r.book + " " + r.ch + ":" + r.v);
      info.appendChild(head);
      if (r.day === today) info.appendChild(cell("span", "today", "tag t"));
      info.appendChild(cell("span", r.source === "queued" ? "queued" : "default", r.source === "queued" ? "tag q" : "tag"));
      info.appendChild(document.createElement("br"));
      info.appendChild(cell("span", r.text.length > 90 ? r.text.slice(0, 90) + "…" : r.text, "snip"));
      tr.appendChild(info);

      const act = cell("td", undefined, "act");
      const edit = cell("button", r.source === "queued" ? "Edit" : "Override", "small");
      edit.type = "button";
      edit.addEventListener("click", () => { fill(r); window.scrollTo({ top: 0, behavior: "smooth" }); });
      act.appendChild(edit);
      if (r.source === "queued") {
        const clr = cell("button", "Clear", "small");
        clr.type = "button";
        clr.style.marginLeft = "6px";
        clr.addEventListener("click", async () => {
          const res = await api("/api/admin/schedule/clear", { date: r.date });
          if (res.ok) { say("Cleared " + r.date + " (back to the default rotation).", true); loadSchedule(); }
        });
        act.appendChild(clr);
      }
      tr.appendChild(act);
      t.appendChild(tr);
    });
  }

  async function loadSchedule() {
    const r = await api("/api/admin/schedule?from=" + today + "&days=" + shownDays);
    if (!r.ok) return;
    rows = r.data.rows;
    renderSchedule();
  }

  $("more").addEventListener("click", () => { shownDays = Math.min(shownDays + 30, 120); loadSchedule(); });

  // ---------- init ----------

  clearForm();
  api("/api/admin/me").then((r) => {
    if (r.ok && r.data.admin) showPanel();
    else if (r.data.error && /disabled/i.test(r.data.error)) { showLogin(); $("loginMsg").textContent = r.data.error; }
    else showLogin();
  });
})();
