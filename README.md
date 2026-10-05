# Biblidle

A daily Bible verse guessing game (KJV). Read the verse, guess the book, chapter and verse.

- Book: green = correct, yellow = same testament
- Chapter/verse digits: Wordle-style (green = right spot, yellow = digit is elsewhere); arrows show higher/lower
- 6 guesses, one verse per day, streak stored in the browser (localStorage)

Static site: open `index.html`, or host the folder anywhere (e.g. GitHub Pages).

## Hosting

It's a static site (four files: `index.html`, `app.js`, `verses.js`, `style.css`), so any web server can host it.

- **Run on your own computer:** `node serve.js` (or `node serve.js 3000`), then open http://localhost:8080. Other devices on your network can use `http://<your-computer-ip>:8080`. No install step needed.
- **Python alternative:** `python3 -m http.server 8080`
- **GitHub Pages (free, public URL):** the workflow in `.github/workflows/pages.yml` deploys on every push to `master`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**. The site will be at `https://<user>.github.io/Biblidle/`.
- **Any other host** (Netlify, Cloudflare Pages, nginx, etc.): upload the four files.
