# Biblidle

A daily Bible verse guessing game (KJV). Read the verse, guess the book, chapter and verse.

- Book: green = correct, yellow = same testament
- Chapter and verse digits are scored together as one number, Wordle-style (green = right spot, yellow = digit appears elsewhere in the chapter+verse)
- 6 guesses, one verse per day, streak stored in the browser (localStorage)

Static site: open `index.html`, or host the folder anywhere (e.g. GitHub Pages).

## Hosting

The game itself is static (`index.html`, `app.js`, `verses.js`, `style.css`). The optional leaderboard needs the small Node server in `serve.js`, which also serves those files.

- **Run it on a computer:** `node serve.js` (or `node serve.js 3000`), then open http://localhost:8080. Other devices on your network can use `http://<your-computer-ip>:8080`. Needs Node 18+, no install step.
- **Leaderboard data** is stored in `data/db.json` (change the folder with the `DATA_DIR` environment variable). Back that file up and keep it on persistent disk if you deploy to a host.
- **Static-only hosting** (GitHub Pages via `.github/workflows/pages.yml`, Netlify, etc.) still runs the game, with streaks saved on each player's device, but the leaderboard option is hidden because there is no server. To get the leaderboard online, run `serve.js` on a host that runs Node (a VPS, Render, Fly.io, Railway, a home server behind a tunnel) and put HTTPS in front of it.

## Leaderboard

When a game ends, players can post their score. There are no accounts or passwords: they pick a unique username once, and the server gives that browser a random device token in an HttpOnly cookie (1 year, SameSite=Lax, Secure over HTTPS). The server stores only a hash of the token. "Forget this device" clears the cookie. Clearing cookies or switching browsers means picking a new username. This is basic identity, not strong security: anyone who steals the cookie can post as that player.

The server checks each posted game against the real verse for that day (a win must end on the correct guess, a loss needs all 6 guesses) and accepts one score per player per day. Tabs: **Today** (fewest guesses) and **Streaks** (current streak, best, wins, average guesses).

## Admin page (`/admin`)

Set today's verse or queue verses for upcoming days at `/admin`. Pick a date, choose a built-in verse or type your own (book, chapter, verse, KJV text), and save. "Queue on next open day" fills the first day with nothing queued. Days with nothing queued use the built-in rotation, and the page shows what each upcoming day will be. Dates are the players' local calendar dates. Only today's verse is ever sent to browsers, never the queue.

The login is read from the environment, never from the repo. Create a `.env` file next to `serve.js` (it's gitignored; see `.env.example`):

```
ADMIN_USER=your-username
ADMIN_PASSWORD=your-password
```

If those aren't set, `/admin` is disabled. Sessions last 12 hours, use an HttpOnly SameSite=Strict cookie, and logins are limited to 5 failed attempts per 15 minutes per IP. Always reach it over HTTPS (the tunnel does that).

## Running at home behind cloudflared

```
npm start            # or: node serve.js  (port 8080; set PORT in .env to change)
cloudflared tunnel --url http://localhost:8080          # quick test
```

For a permanent `biblidle.nmagic.dev`, create a named tunnel and route it:

```
cloudflared tunnel create biblidle
cloudflared tunnel route dns biblidle biblidle.nmagic.dev
# ~/.cloudflared/config.yml
#   tunnel: biblidle
#   credentials-file: /home/<you>/.cloudflared/<tunnel-id>.json
#   ingress:
#     - hostname: biblidle.nmagic.dev
#       service: http://localhost:8080
#     - service: http_status:404
cloudflared tunnel run biblidle
```

Set `HOST=127.0.0.1` in `.env` so only the tunnel can reach the server. The server uses Cloudflare's `CF-Connecting-IP` header (only when the connection comes from localhost) for rate limits. Keep `data/db.json` (leaderboard and queued verses) backed up, and consider running the server with a process manager such as systemd or pm2 so it restarts after reboots.
