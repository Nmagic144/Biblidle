(function () {
  "use strict";

  const MAX_GUESSES = 6;
  const EPOCH = Date.UTC(2026, 9, 5); // puzzle #1 is 5 Oct 2026
  const STORE_KEY = "biblidle:v1";
  const DAY_MS = 86400000;

  const $ = (id) => document.getElementById(id);

  // ---------- daily verse ----------

  function localDayNumber(date) {
    return Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - EPOCH) / DAY_MS);
  }

  // Fixed-seed shuffle so the order is the same for everyone and never repeats within a cycle.
  function shuffledIndexes(n) {
    let seed = 912;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const a = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const today = localDayNumber(new Date());
  const order = shuffledIndexes(VERSES.length);
  const answer = VERSES[order[((today % order.length) + order.length) % order.length]];
  const puzzleNumber = today + 1;

  // ---------- scoring ----------

  const pad2 = (n) => String(n).padStart(2, "0");
  const testamentOf = (name) => BOOKS.find((b) => b.name === name).testament;

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

  function scoreGuess(g) {
    const book = g.book === answer.book ? "g" : testamentOf(g.book) === testamentOf(answer.book) ? "y" : "x";
    const ch = scoreDigits(pad2(g.ch), pad2(answer.ch));
    const v = scoreDigits(pad2(g.v), pad2(answer.v));
    return { book, ch, v, win: book === "g" && ch.every((c) => c === "g") && v.every((c) => c === "g") };
  }

  const arrow = (guess, target) => (guess < target ? "↑" : guess > target ? "↓" : "");

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
      const chDigits = g ? pad2(g.ch) : "  ";
      const vDigits = g ? pad2(g.v) : "  ";

      row.appendChild(tile(g ? sc.book : "", g ? g.book : "", "book"));

      const chGroup = document.createElement("div");
      chGroup.className = "group";
      for (let i = 0; i < 2; i++) chGroup.appendChild(tile(g ? sc.ch[i] : "", g ? chDigits[i] : ""));
      const chArrow = document.createElement("span");
      chArrow.className = "arrow";
      chArrow.textContent = g && !sc.win ? arrow(g.ch, answer.ch) : "";
      chGroup.appendChild(chArrow);
      row.appendChild(chGroup);

      const sep = document.createElement("span");
      sep.className = "sep";
      sep.textContent = ":";
      row.appendChild(sep);

      const vGroup = document.createElement("div");
      vGroup.className = "group";
      for (let i = 0; i < 2; i++) vGroup.appendChild(tile(g ? sc.v[i] : "", g ? vDigits[i] : ""));
      const vArrow = document.createElement("span");
      vArrow.className = "arrow";
      vArrow.textContent = g && !sc.win ? arrow(g.v, answer.v) : "";
      vGroup.appendChild(vArrow);
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
    const rest = BOOKS.filter((b) => !starts.includes(b) && norm(b.name).includes(n));
    return starts.concat(rest);
  }

  function showList(list) {
    shown = list;
    activeIdx = -1;
    bookList.innerHTML = "";
    list.forEach((b, i) => {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
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
    const items = bookList.children;
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
    const li = e.target.closest("li");
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

  function renderFields() {
    $("chBox").querySelector("span").textContent = fields.ch;
    $("vBox").querySelector("span").textContent = fields.v;
  }

  function typeKey(k) {
    if (k === "back") {
      if (fields[activeField]) fields[activeField] = fields[activeField].slice(0, -1);
      else if (activeField === "v") setField("ch");
    } else if (k === "enter") {
      if (activeField === "ch" && fields.ch) setField("v");
      else submit();
    } else if (fields[activeField].length < 2) {
      fields[activeField] += k;
      if (activeField === "ch" && fields.ch.length === 2) setField("v");
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
    const ch = parseInt(fields.ch, 10), v = parseInt(fields.v, 10);
    if (!selectedBook) return message("Pick a book from the list.");
    if (!(ch >= 1)) return message("Enter a chapter.");
    if (!(v >= 1)) return message("Enter a verse.");
    message("");

    const guess = { book: selectedBook, ch, v };
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

  const EMOJI = { g: "🟩", y: "🟨", x: "⬛" };

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

  // ---------- init ----------

  $("quote").textContent = answer.text;
  renderStats();
  renderBoard();
  renderFields();
  renderResult();
  setInterval(() => { if (!$("result").hidden) updateCountdown(); }, 1000);

  // Exposed for tests.
  window.__biblidle = { scoreDigits, scoreGuess, answer };
})();
