// Zero-dependency static server: `node serve.js [port]` then open http://localhost:8080
const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.argv[2] || process.env.PORT) || 8080;
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const site = new Set(["index.html", "app.js", "verses.js", "style.css"]);

http.createServer((req, res) => {
  let name = decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
  if (!site.has(name)) { res.writeHead(404); return res.end("Not found"); }
  fs.readFile(path.join(__dirname, name), (err, data) => {
    if (err) { res.writeHead(500); return res.end("Error"); }
    res.writeHead(200, { "Content-Type": types[path.extname(name)] });
    res.end(data);
  });
}).listen(port, "0.0.0.0", () => console.log("Biblidle running at http://localhost:" + port));
