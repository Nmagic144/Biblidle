(function () {
  "use strict";

  const MAX_GUESSES = 6;
  const STORE_KEY = "biblidle:v1";
  const DAY_MS = 86400000;

  const $ = (id) => document.getElementById(id);

  // ---------- daily verse ----------

  function localDayNumber(date) {
    return Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - EPOCH_UTC) / DAY_MS);
  }

  const today = localDayNumber(new Date());
  const answer = dailyAnswer(today);
  const puzzleNumber = today + 1;

  // ---------- scoring ----------

  const pad2 = (n) => String(n).padStart(2, "0");
  const bookOf = (name) => BOOKS.find((b) => b.name === name);
  const CH_LEN = String(answer.ch).length;
  const V_LEN = String(answer.v).length;

  // Wordle-style: greens first, then yellows limited by remaining digit counts.
  function scoreDigits(guess, target) {
    const res = Array(guess.length).fill("x");
    const left = {};
    for (let i = 0; i < guess.length; i++) {
      if (guess[i] === target[i]) res[i] = "g";
      else left[target[i]] = (left[target[i]] || 0) + 1;
    }
    for (let i = 0; i < guess.length; i++) {
      if (res[i] === "g") continue;
      if (left[guess[i]] > 0) {
        res[i] = "y";
        left[guess[i]]--;
      }
    }
    return res;
  }

  // Book: green = exact, yellow = same section, orange = same testament, gray = no.
  function scoreBook(name) {
    const g = bookOf(name), a = bookOf(answer.book);
    if (g === a) return "g";
    if (g.chunk === a.chunk) return "y";
    return g.testament === a.testament ? "o" : "x";
  }

  function scoreGuess(g) {
    const book = scoreBook(g.book);
    // Chapter and verse digits share one pool, so a digit can be yellow even if it
    // belongs in the other number.
    const digits = scoreDigits(g.ch + g.v, String(answer.ch) + String(answer.v));
    const ch = digits.slice(0, g.ch.length);
    const v = digits.slice(g.ch.length);
    return { book, ch, v, win: book === "g" && ch.every((c) => c === "g") && v.every((c) => c === "g") };
  }

  // ---------- storage (localStorage, i.e. on the player's device) ----------

  const fresh = () => ({ streak: 0, best: 0, played: 0, won: 0, lastWin: -99, game: null });

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && typeof s === "object") return Object.assign(fresh(), s);
    } catch (e) { /* storage unavailable or corrupt */ }
    return fresh();
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  const state = load();
  if (!state.game || state.game.day !== today) {
    state.game = { day: today, guesses: [], done: false, won: false };
  }
  // Guesses saved by an older version stored numbers; start today fresh.
  if (state.game.guesses.some((g) => typeof g.ch !== "string")) {
    state.game = { day: today, guesses: [], done: false, won: false };
  }

  // A streak only survives if the last win was today or yesterday.
  const liveStreak = () => (state.lastWin >= today - 1 ? state.streak : 0);

  // ---------- rendering ----------

  function renderStats() {
    const s = liveStreak();
    $("stats").textContent =
      (s > 0 ? s + " day streak!" : "No streak yet") +
      (state.best > 0 ? " · best " + state.best : "");
  }

  function tile(cls, text, extra) {
    const d = document.createElement("div");
    d.className = "tile " + cls + (extra ? " " + extra : "");
    d.textContent = text;
    return d;
  }

  function renderBoard() {
    const board = $("board");
    board.innerHTML = "";
    for (let r = 0; r < MAX_GUESSES; r++) {
      const row = document.createElement("div");
      row.className = "row";
      const g = state.game.guesses[r];
      const sc = g && scoreGuess(g);

      row.appendChild(tile(g ? sc.book : "", g ? g.book : "", "book"));

      const chGroup = document.createElement("div");
      chGroup.className = "group";
      for (let i = 0; i < CH_LEN; i++) chGroup.appendChild(tile(g ? sc.ch[i] : "", g ? g.ch[i] : ""));
      row.appendChild(chGroup);

      const sep = document.createElement("span");
      sep.className = "sep";
      sep.textContent = ":";
      row.appendChild(sep);

      const vGroup = document.createElement("div");
      vGroup.className = "group";
      for (let i = 0; i < V_LEN; i++) vGroup.appendChild(tile(g ? sc.v[i] : "", g ? g.v[i] : ""));
      row.appendChild(vGroup);


      board.appendChild(row);
    }
  }

  function refName() {
    return answer.book + " " + answer.ch + ":" + answer.v;
  }

  function renderResult() {
    const done = state.game.done;
    $("input").hidden = done;
    $("result").hidden = !done;
    if (!done) return;
    $("resultTitle").textContent = state.game.won
      ? "You got it in " + state.game.guesses.length + "/" + MAX_GUESSES + "!"
      : "Not today.";
    $("resultRef").textContent = refName() + " (KJV)";
    renderLeaderboard();
    $("resultText").textContent = "“" + answer.text + "”";
    updateCountdown();
  }

  function updateCountdown() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const s = Math.max(0, Math.floor((next - now) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    $("countdown").textContent = pad2(h) + ":" + pad2(m) + ":" + pad2(sec);
    if (next - now <= 1000) setTimeout(() => location.reload(), 1200);
  }

  // ---------- book combobox ----------

  const bookInput = $("book");
  const bookList = $("booklist");
  let selectedBook = null;
  let activeIdx = -1;
  let shown = [];

  const norm = (s) => s.toLowerCase().replace(/[.\s]/g, "");

  function filterBooks(q) {
    const n = norm(q);
    if (!n) return BOOKS;
    const starts = BOOKS.filter((b) => norm(b.name).startsWith(n));
    return starts.length ? starts : BOOKS.filter((b) => norm(b.name).includes(n));
  }

  // Books are listed under a heading for each section of the Bible.
  function showList(list) {
    shown = list;
    activeIdx = -1;
    bookList.innerHTML = "";
    let lastChunk = null;
    list.forEach((b, i) => {
      if (b.chunk !== lastChunk) {
        lastChunk = b.chunk;
        const h = document.createElement("li");
        h.className = "group-head";
        h.setAttribute("role", "presentation");
        h.textContent = CHUNKS.find((c) => c.id === b.chunk).label;
        bookList.appendChild(h);
      }
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.className = "opt";
      li.textContent = b.name;
      li.dataset.i = i;
      bookList.appendChild(li);
    });
    bookList.hidden = list.length === 0;
    bookInput.setAttribute("aria-expanded", String(!bookList.hidden));
  }

  function hideList() {
    bookList.hidden = true;
    bookInput.setAttribute("aria-expanded", "false");
  }

  function setActive(i) {
    const items = bookList.querySelectorAll("li.opt");
    if (!items.length) return;
    activeIdx = (i + items.length) % items.length;
    for (let k = 0; k < items.length; k++) items[k].classList.toggle("active", k === activeIdx);
    items[activeIdx].scrollIntoView({ block: "nearest" });
  }

  function chooseBook(b) {
    selectedBook = b.name;
    bookInput.value = b.name;
    hideList();
    bookInput.blur();
    setField("ch");
  }

  bookInput.addEventListener("input", () => {
    const exact = BOOKS.find((b) => norm(b.name) === norm(bookInput.value));
    selectedBook = exact ? exact.name : null;
    showList(filterBooks(bookInput.value));
  });
  bookInput.addEventListener("focus", () => { bookInput.select(); showList(filterBooks("")); });
  bookInput.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (bookList.hidden) showList(filterBooks(bookInput.value)); setActive(activeIdx + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(activeIdx - 1); }
    else if (e.key === "Enter") {
      e.preventDefault();
      const pick = shown[activeIdx >= 0 ? activeIdx : 0];
      if (pick && !bookList.hidden) chooseBook(pick);
      else if (selectedBook) setField("ch"), bookInput.blur();
    } else if (e.key === "Escape") hideList();
  });
  bookList.addEventListener("pointerdown", (e) => {
    const li = e.target.closest("li.opt");
    if (!li) return;
    e.preventDefault();
    chooseBook(shown[Number(li.dataset.i)]);
  });
  $("bookToggle").addEventListener("click", () => {
    if (!bookList.hidden) return hideList();
    showList(BOOKS);
    const cur = BOOKS.findIndex((b) => b.name === selectedBook);
    if (cur >= 0) setActive(cur);
  });
  document.addEventListener("pointerdown", (e) => {
    if (!$("combo").contains(e.target)) hideList();
  });

  // ---------- number entry ----------

  const fields = { ch: "", v: "" };
  let activeField = "ch";

  function setField(f) {
    activeField = f;
    $("chBox").classList.toggle("active", f === "ch");
    $("vBox").classList.toggle("active", f === "v");
  }

  const blanks = (val, len) => val.padEnd(len, "_").split("").join(" ");

  function renderFields() {
    $("chBox").querySelector("span").textContent = blanks(fields.ch, CH_LEN);
    $("vBox").querySelector("span").textContent = blanks(fields.v, V_LEN);
  }

  function typeKey(k) {
    if (k === "back") {
      if (fields[activeField]) fields[activeField] = fields[activeField].slice(0, -1);
      else if (activeField === "v") setField("ch");
    } else if (k === "enter") {
      if (activeField === "ch" && fields.ch.length === CH_LEN) setField("v");
      else submit();
    } else if (fields[activeField].length < (activeField === "ch" ? CH_LEN : V_LEN)) {
      fields[activeField] += k;
      if (activeField === "ch" && fields.ch.length === CH_LEN) setField("v");
    }
    renderFields();
  }

  $("keypad").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) typeKey(b.dataset.k);
  });
  $("chBox").addEventListener("click", () => setField("ch"));
  $("vBox").addEventListener("click", () => setField("v"));
  $("guess").addEventListener("click", submit);

  document.addEventListener("keydown", (e) => {
    if (e.target === bookInput || e.ctrlKey || e.metaKey || e.altKey) return;
    if (state.game.done) return;
    if (/^[0-9]$/.test(e.key)) typeKey(e.key);
    else if (e.key === "Backspace") typeKey("back");
    else if (e.key === "Enter" && !(e.target instanceof HTMLButtonElement)) typeKey("enter");
  });

  // ---------- guessing ----------

  function message(text) {
    $("msg").textContent = text;
    if (text) {
      $("input").classList.remove("shake");
      void $("input").offsetWidth;
      $("input").classList.add("shake");
    }
  }

  function submit() {
    if (state.game.done) return;
    if (!selectedBook) return message("Pick a book from the list.");
    if (fields.ch.length < CH_LEN || !(parseInt(fields.ch, 10) >= 1)) return message("Fill in all " + CH_LEN + " chapter digit" + (CH_LEN > 1 ? "s" : "") + ".");
    if (fields.v.length < V_LEN || !(parseInt(fields.v, 10) >= 1)) return message("Fill in all " + V_LEN + " verse digit" + (V_LEN > 1 ? "s" : "") + ".");
    message("");

    const guess = { book: selectedBook, ch: fields.ch, v: fields.v };
    state.game.guesses.push(guess);
    const won = scoreGuess(guess).win;
    if (won || state.game.guesses.length >= MAX_GUESSES) finish(won);
    save();

    selectedBook = null;
    bookInput.value = "";
    fields.ch = fields.v = "";
    setField("ch");
    renderFields();
    renderBoard();
    renderStats();
    renderResult();
  }

  function finish(won) {
    state.game.done = true;
    state.game.won = won;
    state.played++;
    if (won) {
      state.won++;
      state.streak = state.lastWin === today - 1 ? state.streak + 1 : 1;
      state.lastWin = today;
      state.best = Math.max(state.best, state.streak);
    } else {
      state.streak = 0;
    }
  }

  // ---------- sharing ----------

  const EMOJI = { g: "🟩", y: "🟨", o: "\uD83D\uDFE7", x: "⬛" };

  function shareText() {
    const rows = state.game.guesses.map((g) => {
      const s = scoreGuess(g);
      return EMOJI[s.book] + " " + s.ch.map((c) => EMOJI[c]).join("") + " " + s.v.map((c) => EMOJI[c]).join("");
    });
    const score = state.game.won ? state.game.guesses.length : "X";
    const streak = liveStreak();
    return "Biblidle #" + puzzleNumber + " " + score + "/" + MAX_GUESSES +
      (streak > 1 ? " 🔥" + streak : "") + "\n\n" + rows.join("\n");
  }

  $("share").addEventListener("click", async () => {
    const text = shareText();
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { ok = document.execCommand("copy"); } catch (e2) { /* ignore */ }
      ta.remove();
    }
    const btn = $("share");
    btn.textContent = ok ? "Copied!" : "Copy failed";
    setTimeout(() => (btn.textContent = "Copy to share"), 1800);
  });

  // ---------- leaderboard (optional; needs the Node server's /api) ----------

  const lb = { available: false, username: null, posted: false, tab: "today" };

  async function api(url, body) {
    const opts = body === undefined ? {} : {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    };
    const r = await fetch(url, opts);
    let data = null;
    try { data = await r.json(); } catch (e) { /* not JSON */ }
    return { ok: r.ok, data: data || {} };
  }

  async function initLeaderboard() {
    try {
      const r = await api("/api/me?day=" + today);
      if (!r.ok || !("username" in r.data)) return; // static hosting: no leaderboard
      lb.available = true;
      lb.username = r.data.username;
      lb.posted = r.data.posted;
      renderLeaderboard();
    } catch (e) { /* offline or static host */ }
  }

  function lbMessage(text) { $("lbMsg").textContent = text || ""; }

  async function renderLeaderboard() {
    if (!lb.available || !state.game.done) return;
    $("lb").hidden = false;
    $("lbJoin").hidden = !!lb.username;
    $("lbPost").hidden = !(lb.username && !lb.posted);
    if (lb.username) $("lbPostBtn").textContent = "Post my score as " + lb.username;
    const who = $("lbWho");
    who.hidden = !lb.username;
    who.textContent = "";
    if (lb.username) {
      who.append("Playing as " + lb.username + " \u00B7 ");
      const out = document.createElement("button");
      out.type = "button";
      out.className = "link";
      out.textContent = "forget this device";
      out.addEventListener("click", async () => {
        await api("/api/logout", {});
        lb.username = null;
        lb.posted = false;
        renderLeaderboard();
      });
      who.appendChild(out);
    }

    let data;
    try {
      const r = await api("/api/leaderboard?day=" + today);
      if (!r.ok) return;
      data = r.data;
    } catch (e) { return; }

    const table = $("lbTable");
    table.innerHTML = "";
    const addRow = (cells, tag, mine) => {
      const tr = document.createElement("tr");
      if (mine) tr.className = "me";
      cells.forEach((c) => {
        const td = document.createElement(tag);
        td.textContent = c;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    };
    if (lb.tab === "today") {
      addRow(["#", "Player", "Result"], "th");
      data.today.forEach((r, i) => addRow([i + 1, r.name, r.won ? r.guesses + "/" + MAX_GUESSES : "X"], "td", r.name === data.me));
      if (!data.today.length) addRow(["", "No scores yet today", ""], "td");
    } else {
      addRow(["#", "Player", "Streak", "Best", "Wins", "Avg"], "th");
      data.all.forEach((r, i) => addRow([i + 1, r.name, r.streak, r.best, r.wins, r.avg ? r.avg.toFixed(1) : "-"], "td", r.name === data.me));
      if (!data.all.length) addRow(["", "No players yet", "", "", "", ""], "td");
    }
  }

  async function postScore() {
    const r = await api("/api/score", { day: today, guesses: state.game.guesses, won: state.game.won });
    if (r.ok || /already posted/i.test(r.data.error || "")) { lb.posted = true; lbMessage(""); }
    else lbMessage(r.data.error || "Couldn't post your score.");
    renderLeaderboard();
  }

  $("lbJoinBtn").addEventListener("click", async () => {
    lbMessage("");
    try {
      const r = await api("/api/register", { username: $("lbName").value });
      if (!r.ok) return lbMessage(r.data.error || "Couldn't sign up.");
      lb.username = r.data.username;
      await postScore();
    } catch (e) { lbMessage("Couldn't reach the server."); }
  });
  $("lbName").addEventListener("keydown", (e) => { if (e.key === "Enter") $("lbJoinBtn").click(); });
  $("lbPostBtn").addEventListener("click", () => postScore().catch(() => lbMessage("Couldn't reach the server.")));
  document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
    lb.tab = b.dataset.tab;
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("on", x === b));
    renderLeaderboard();
  }));

  // ---------- init ----------

  $("quote").textContent = answer.text;
  renderStats();
  renderBoard();
  renderFields();
  renderResult();
  initLeaderboard();
  setInterval(() => { if (!$("result").hidden) updateCountdown(); }, 1000);

  // Exposed for tests.
  window.__biblidle = { scoreDigits, scoreGuess, answer };
})();
