const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const LOG_FILE = path.join(__dirname, "output", "access.log");
let logStream = null;

function ensureLogStream() {
  if (!logStream) {
    const dir = path.dirname(LOG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
  }
  return logStream;
}

function getClientIP(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function logAccess(clientIP, method, url, status) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("zh-CN");
  const logLine = "[" + timeStr + "] " + clientIP + " " + method + " " + url + " - " + status;
  console.log(logLine);
  try {
    const stream = ensureLogStream();
    stream.write(now.toISOString() + " " + clientIP + " " + method + " " + url + " " + status + "\n");
  } catch (_) {}
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer((req, res) => {
  let filePath = path.join(ROOT, req.url === "/" ? "index.html" : req.url);
  const clientIP = getClientIP(req);

  // 安全：防止目录穿越
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    logAccess(clientIP, req.method, req.url, 403);
    return;
  }

  const ext = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
      logAccess(clientIP, req.method, req.url, 404);
      return;
    }
    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
    logAccess(clientIP, req.method, req.url, 200);
  });
});

server.listen(PORT, () => {
  const nets = require("os").networkInterfaces();
  console.log("");
  console.log("  ==========================================");
  console.log("    武汉天气服务已启动");
  console.log("  ==========================================");
  console.log("    本机访问：");
  console.log("    http://localhost:" + PORT);

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === "IPv4" && !net.internal) {
        const addr = "http://" + net.address + ":" + PORT;
        console.log("");
        console.log("    局域网访问：");
        console.log("    " + addr);
      }
    }
  }

  console.log("");
  console.log("    按 Ctrl+C 停止服务");
  console.log("");
});
