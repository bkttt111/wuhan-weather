// query-ips.js —— 查询访问过网页的所有 IP
const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "output", "access.log");

if (!fs.existsSync(LOG_FILE)) {
  console.log("暂无访问记录（日志文件不存在）。");
  process.exit(0);
}

const content = fs.readFileSync(LOG_FILE, "utf-8").trim();
if (!content) {
  console.log("暂无访问记录（日志为空）。");
  process.exit(0);
}

const lines = content.split("\n").filter(Boolean);
const ipMap = new Map();

for (const line of lines) {
  // 格式: ISO-time IP METHOD URL STATUS
  const parts = line.split(" ");
  if (parts.length < 4) continue;
  const ip = parts[1];
  const method = parts[2];
  const url = parts[3] || "";
  const status = parts[4] || "";

  if (!ipMap.has(ip)) {
    ipMap.set(ip, { count: 0, methods: new Set(), urls: new Set(), statuses: new Set(), first: parts[0], last: parts[0] });
  }
  const rec = ipMap.get(ip);
  rec.count++;
  rec.methods.add(method);
  rec.urls.add(url);
  rec.statuses.add(status);
  rec.last = parts[0];
}

if (ipMap.size === 0) {
  console.log("暂无有效访问记录。");
  process.exit(0);
}

console.log("========================================");
console.log("  访问过此网页的 IP 汇总");
console.log("========================================");
console.log("");

const sorted = [...ipMap.entries()].sort((a, b) => b[1].count - a[1].count);

for (const [ip, rec] of sorted) {
  console.log("  IP:        " + ip);
  console.log("  访问次数:  " + rec.count);
  console.log("  状态码:    " + [...rec.statuses].join(", "));
  console.log("  访问路径:  " + [...rec.urls].join(", "));
  console.log("  首次访问:  " + rec.first);
  console.log("  最近访问:  " + rec.last);
  console.log("  ----------------------------------------");
}

console.log("");
console.log("共 " + ipMap.size + " 个不同 IP，总计 " + lines.length + " 次请求。");
