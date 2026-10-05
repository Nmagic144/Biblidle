# Biblidle

A daily Bible verse guessing game (KJV). Read the verse, guess the book, chapter and verse.

- Book: green = correct, yellow = same testament
- Chapter/verse digits: Wordle-style (green = right spot, yellow = digit is elsewhere); arrows show higher/lower
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
