// Biblidle server (no dependencies): `node serve.js [port]` then open http://localhost:8080
//
// - Serves the static site.
// - Runs the optional leaderboard API. Players pick a username once; the browser then holds a
//   random device token in an HttpOnly cookie. There are no passwords or accounts. Only a hash
//   of the token is stored, in data/db.json (override the folder with DATA_DIR).
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { BOOKS, EPOCH_UTC, dailyAnswer } = require("./verses.js");

// Settings may live in a .env file next to this script (gitignored): ADMIN_USER, ADMIN_PASSWORD, PORT, HOST, DATA_DIR.
try {
  for (const line of fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
} catch (e) { /* no .env */ }

const host = process.env.HOST || "0.0.0.0";
const ADMIN_USER = process.env.ADMIN_USER || "";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ADMIN_COOKIE = "biblidle_admin";
const port = Number(process.argv[2] || process.env.PORT) || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const COOKIE = "biblidle_device";
const DAY_MS = 86400000;
const MAX_GUESSES = 6;

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const site = new Set(["index.html", "app.js", "verses.js", "style.css", "admin.html", "admin.js"]);

// ---------- storage ----------

let db = { users: {}, schedule: {} }; // id -> { name, tokenHash, created, results: { [day]: { guesses, won } } }
try { db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch (e) { /* first run */ }
db.users = db.users || {};
db.schedule = db.schedule || {}; // day number -> { book, ch, v, text } set from /admin
const byToken = new Map(Object.entries(db.users).map(([id, u]) => [u.tokenHash, id]));

function saveDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const serverDay = () => Math.floor((Date.now() - EPOCH_UTC) / DAY_MS);
// The verse for a day: one queued by the admin, otherwise the built-in rotation.
const answerFor = (day) => db.schedule[day] || dailyAnswer(day);

// Behind cloudflared every connection comes from localhost, so trust Cloudflare's header then.
function clientIp(req) {
  const a = req.socket.remoteAddress || "";
  const local = a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
  return (local && req.headers["cf-connecting-ip"]) || a;
}

// ---------- helpers ----------

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({ "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }, headers));
  res.end(JSON.stringify(body));
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = p.slice(i + 1).trim();
  });
  return out;
}

function currentUser(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  const id = byToken.get(sha256(token));
  return id ? { id, user: db.users[id] } : null;
}

function cookieHeader(req, value, maxAge, name, sameSite) {
  const secure = req.socket.encrypted || req.headers["x-forwarded-proto"] === "https";
  return (name || COOKIE) + "=" + value + "; Path=/; HttpOnly; SameSite=" + (sameSite || "Lax") + "; Max-Age=" + maxAge + (secure ? "; Secure" : "");
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    // Requiring JSON blocks cross-site form posts (they can't set this content type).
    if (!/^application\/json/i.test(req.headers["content-type"] || "")) return reject(new Error("Expected JSON"));
    let size = 0, data = "";
    req.on("data", (c) => {
      size += c.length;
      if (size > 10000) { reject(new Error("Too large")); req.destroy(); } else data += c;
    });
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch (e) { reject(new Error("Bad JSON")); } });
  });
}

const registerHits = new Map(); // ip -> timestamps
function registerAllowed(ip) {
  const now = Date.now();
  const hits = (registerHits.get(ip) || []).filter((t) => now - t < 3600000);
  if (hits.length >= 5) return false;
  hits.push(now);
  registerHits.set(ip, hits);
  return true;
}

// ---------- leaderboard logic ----------

function stats(user, today) {
  const days = Object.keys(user.results).map(Number).sort((a, b) => a - b);
  let wins = 0, guessSum = 0, best = 0, run = 0, prev = null;
  for (const d of days) {
    const r = user.results[d];
    if (r.won) {
      wins++;
      guessSum += r.guesses;
      run = prev !== null && d === prev + 1 ? run + 1 : 1;
      prev = d;
      best = Math.max(best, run);
    } else { run = 0; prev = null; }
  }
  const streak = run > 0 && prev >= today - 1 ? run : 0;
  return { streak, best, wins, played: days.length, avg: wins ? guessSum / wins : null };
}

function leaderboard(day, me) {
  const users = Object.values(db.users);
  const all = users
    .map((u) => Object.assign({ name: u.name }, stats(u, day)))
    .filter((s) => s.played > 0)
    .sort((a, b) => b.streak - a.streak || b.wins - a.wins || (a.avg || 9) - (b.avg || 9) || a.name.localeCompare(b.name))
    .slice(0, 50);
  const todayRows = users
    .filter((u) => u.results[day])
    .map((u) => ({ name: u.name, won: u.results[day].won, guesses: u.results[day].guesses }))
    .sort((a, b) => b.won - a.won || a.guesses - b.guesses || a.name.localeCompare(b.name))
    .slice(0, 50);
  return { me: me ? me.user.name : null, today: todayRows, all };
}

function sameGuess(g, answer) {
  return g.book === answer.book && parseInt(g.ch, 10) === answer.ch && parseInt(g.v, 10) === answer.v;
}

function validGuess(g) {
  return g && typeof g.book === "string" && BOOKS.some((b) => b.name === g.book) &&
    /^\d{1,3}$/.test(String(g.ch)) && /^\d{1,3}$/.test(String(g.v));
}

// ---------- API ----------

async function api(req, res, url) {
  const day = Number(url.searchParams.get("day"));
  const me = currentUser(req);

  if (req.method === "GET" && url.pathname === "/api/me") {
    return send(res, 200, { username: me ? me.user.name : null, posted: !!(me && Number.isInteger(day) && me.user.results[day]) });
  }

  if (req.method === "GET" && url.pathname === "/api/today") {
    // Only today's verse (give or take a timezone) is ever revealed, never the queue.
    if (!Number.isInteger(day) || Math.abs(day - serverDay()) > 1) return send(res, 400, { error: "That puzzle isn't current." });
    const a = answerFor(day);
    return send(res, 200, { book: a.book, ch: a.ch, v: a.v, text: a.text });
  }

  if (req.method === "GET" && url.pathname === "/api/leaderboard") {
    return send(res, 200, leaderboard(Number.isInteger(day) ? day : serverDay(), me));
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    if (me) return send(res, 409, { error: "This device already has the username " + me.user.name + "." });
    if (!registerAllowed(clientIp(req))) return send(res, 429, { error: "Too many sign-ups, try again later." });
    const body = await readJson(req);
    const name = String(body.username || "").trim().replace(/\s+/g, " ");
    if (!/^[A-Za-z0-9_][A-Za-z0-9_ .-]{1,19}$/.test(name)) {
      return send(res, 400, { error: "Usernames are 2-20 characters: letters, numbers, spaces, _ . -" });
    }
    if (Object.values(db.users).some((u) => u.name.toLowerCase() === name.toLowerCase())) {
      return send(res, 409, { error: "That username is taken." });
    }
    const token = crypto.randomBytes(32).toString("hex");
    const id = crypto.randomBytes(8).toString("hex");
    db.users[id] = { name, tokenHash: sha256(token), created: Date.now(), results: {} };
    byToken.set(sha256(token), id);
    saveDb();
    return send(res, 200, { username: name }, { "Set-Cookie": cookieHeader(req, token, 31536000) });
  }

  if (req.method === "POST" && url.pathname === "/api/score") {
    if (!me) return send(res, 401, { error: "Pick a username first." });
    const body = await readJson(req);
    const d = body.day;
    if (!Number.isInteger(d) || Math.abs(d - serverDay()) > 1) return send(res, 400, { error: "That puzzle isn't current." });
    if (me.user.results[d]) return send(res, 409, { error: "Score already posted for today." });
    const guesses = body.guesses;
    if (!Array.isArray(guesses) || guesses.length < 1 || guesses.length > MAX_GUESSES || !guesses.every(validGuess)) {
      return send(res, 400, { error: "Invalid guesses." });
    }
    const answer = answerFor(d);
    const hit = guesses.findIndex((g) => sameGuess(g, answer));
    const won = hit === guesses.length - 1;
    // A real game ends on the first correct guess, and a loss needs all six guesses used.
    if ((hit !== -1 && !won) || (!won && guesses.length !== MAX_GUESSES)) return send(res, 400, { error: "Those guesses don't add up." });
    me.user.results[d] = { guesses: guesses.length, won };
    saveDb();
    return send(res, 200, { ok: true });
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    return send(res, 200, { ok: true }, { "Set-Cookie": cookieHeader(req, "", 0) });
  }

  return send(res, 404, { error: "Not found" });
}

// ---------- admin ----------

const sessions = new Map(); // sha256(session token) -> expiry
const loginFails = new Map(); // ip -> timestamps
const safeEqual = (a, b) => crypto.timingSafeEqual(
  crypto.createHash("sha256").update(String(a)).digest(),
  crypto.createHash("sha256").update(String(b)).digest());

function isAdmin(req) {
  const t = parseCookies(req)[ADMIN_COOKIE];
  if (!t) return false;
  const key = sha256(t), exp = sessions.get(key);
  if (!exp || exp < Date.now()) { sessions.delete(key); return false; }
  return true;
}

const dateToDay = (str) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str));
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const dt = new Date(t);
  if (dt.getUTCFullYear() !== +m[1] || dt.getUTCMonth() !== +m[2] - 1 || dt.getUTCDate() !== +m[3]) return null;
  return Math.round((t - EPOCH_UTC) / DAY_MS);
};
const dayToDate = (day) => new Date(EPOCH_UTC + day * DAY_MS).toISOString().slice(0, 10);

function scheduleRow(day) {
  const queued = db.schedule[day];
  const a = queued || dailyAnswer(day);
  return { day, date: dayToDate(day), source: queued ? "queued" : "default", book: a.book, ch: a.ch, v: a.v, text: a.text };
}

async function adminApi(req, res, url) {
  if (!ADMIN_USER || !ADMIN_PASSWORD) {
    return send(res, 503, { error: "Admin is disabled. Set ADMIN_USER and ADMIN_PASSWORD (see README)." });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/login") {
    const ip = clientIp(req), now = Date.now();
    const fails = (loginFails.get(ip) || []).filter((t) => now - t < 900000);
    if (fails.length >= 5) return send(res, 429, { error: "Too many attempts. Try again in 15 minutes." });
    const body = await readJson(req);
    const ok = safeEqual(body.username || "", ADMIN_USER) & safeEqual(body.password || "", ADMIN_PASSWORD);
    if (!ok) {
      fails.push(now);
      loginFails.set(ip, fails);
      return send(res, 401, { error: "Wrong username or password." });
    }
    loginFails.delete(ip);
    const token = crypto.randomBytes(32).toString("hex");
    sessions.set(sha256(token), now + 12 * 3600000);
    return send(res, 200, { ok: true }, { "Set-Cookie": cookieHeader(req, token, 43200, ADMIN_COOKIE, "Strict") });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/me") return send(res, 200, { admin: isAdmin(req) });
  if (!isAdmin(req)) return send(res, 401, { error: "Please log in." });

  if (req.method === "POST" && url.pathname === "/api/admin/logout") {
    sessions.delete(sha256(parseCookies(req)[ADMIN_COOKIE]));
    return send(res, 200, { ok: true }, { "Set-Cookie": cookieHeader(req, "", 0, ADMIN_COOKIE, "Strict") });
  }

  if (req.method === "GET" && url.pathname === "/api/admin/schedule") {
    const from = Number(url.searchParams.get("from"));
    const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 120);
    if (!Number.isInteger(from)) return send(res, 400, { error: "Bad start day." });
    return send(res, 200, { rows: Array.from({ length: days }, (_, i) => scheduleRow(from + i)) });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/schedule") {
    const b = await readJson(req);
    const day = dateToDay(b.date);
    const ch = Number(b.ch), v = Number(b.v);
    const text = String(b.text || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
    if (day === null || day < 0 || day > 3650) return send(res, 400, { error: "Pick a valid date." });
    if (!BOOKS.some((x) => x.name === b.book)) return send(res, 400, { error: "Pick a book from the list." });
    if (!Number.isInteger(ch) || ch < 1 || ch > 150) return send(res, 400, { error: "Chapter must be 1-150." });
    if (!Number.isInteger(v) || v < 1 || v > 176) return send(res, 400, { error: "Verse must be 1-176." });
    if (text.length < 3 || text.length > 1200) return send(res, 400, { error: "Verse text must be 3-1200 characters." });
    db.schedule[day] = { book: b.book, ch, v, text };
    saveDb();
    return send(res, 200, { row: scheduleRow(day) });
  }

  if (req.method === "POST" && url.pathname === "/api/admin/schedule/clear") {
    const b = await readJson(req);
    const day = dateToDay(b.date);
    if (day === null) return send(res, 400, { error: "Pick a valid date." });
    delete db.schedule[day];
    saveDb();
    return send(res, 200, { row: scheduleRow(day) });
  }

  return send(res, 404, { error: "Not found" });
}

// ---------- server ----------

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/admin/")) {
    return adminApi(req, res, url).catch((e) => send(res, 400, { error: e.message }));
  }
  if (url.pathname.startsWith("/api/")) {
    return api(req, res, url).catch((e) => send(res, 400, { error: e.message }));
  }
  let name;
  if (url.pathname === "/admin" || url.pathname === "/admin/") url.pathname = "/admin.html";
  try { name = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html"; } catch (e) { name = ""; }
  if (!site.has(name)) { res.writeHead(404); return res.end("Not found"); }
  fs.readFile(path.join(__dirname, name), (err, data) => {
    if (err) { res.writeHead(500); return res.end("Error"); }
    const headers = { "Content-Type": types[path.extname(name)], "X-Content-Type-Options": "nosniff" };
    if (name === "admin.html" || name === "admin.js") {
      headers["Cache-Control"] = "no-store";
      headers["X-Robots-Tag"] = "noindex";
      headers["X-Frame-Options"] = "DENY";
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}).listen(port, host, () => {
  console.log("Biblidle running at http://localhost:" + port);
  if (!ADMIN_USER || !ADMIN_PASSWORD) console.log("Admin page disabled: set ADMIN_USER and ADMIN_PASSWORD in .env to enable /admin");
});
