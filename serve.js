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

const port = Number(process.argv[2] || process.env.PORT) || 8080;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const COOKIE = "biblidle_device";
const DAY_MS = 86400000;
const MAX_GUESSES = 6;

const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const site = new Set(["index.html", "app.js", "verses.js", "style.css"]);

// ---------- storage ----------

let db = { users: {} }; // id -> { name, tokenHash, created, results: { [day]: { guesses, won } } }
try { db = JSON.parse(fs.readFileSync(DB_FILE, "utf8")); } catch (e) { /* first run */ }
const byToken = new Map(Object.entries(db.users).map(([id, u]) => [u.tokenHash, id]));

function saveDb() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, DB_FILE);
}

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const serverDay = () => Math.floor((Date.now() - EPOCH_UTC) / DAY_MS);

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

function cookieHeader(req, value, maxAge) {
  const secure = req.socket.encrypted || req.headers["x-forwarded-proto"] === "https";
  return COOKIE + "=" + value + "; Path=/; HttpOnly; SameSite=Lax; Max-Age=" + maxAge + (secure ? "; Secure" : "");
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

  if (req.method === "GET" && url.pathname === "/api/leaderboard") {
    return send(res, 200, leaderboard(Number.isInteger(day) ? day : serverDay(), me));
  }

  if (req.method === "POST" && url.pathname === "/api/register") {
    if (me) return send(res, 409, { error: "This device already has the username " + me.user.name + "." });
    if (!registerAllowed(req.socket.remoteAddress)) return send(res, 429, { error: "Too many sign-ups, try again later." });
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
    const answer = dailyAnswer(d);
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

// ---------- server ----------

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/")) {
    return api(req, res, url).catch((e) => send(res, 400, { error: e.message }));
  }
  let name;
  try { name = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html"; } catch (e) { name = ""; }
  if (!site.has(name)) { res.writeHead(404); return res.end("Not found"); }
  fs.readFile(path.join(__dirname, name), (err, data) => {
    if (err) { res.writeHead(500); return res.end("Error"); }
    res.writeHead(200, { "Content-Type": types[path.extname(name)], "X-Content-Type-Options": "nosniff" });
    res.end(data);
  });
}).listen(port, "0.0.0.0", () => console.log("Biblidle running at http://localhost:" + port));
