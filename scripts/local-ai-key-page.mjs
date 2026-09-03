import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { chmod, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const projectDir = dirname(dirname(fileURLToPath(import.meta.url)));
const envFile = join(projectDir, ".env.local");
const token = randomBytes(24).toString("hex");

const page = (message = "") => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Already · 本地 AI 设置</title><style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#eee7df;color:#302725;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}.card{width:min(92vw,560px);padding:42px;background:#fffdf9;border:1px solid #dfd1c7;box-shadow:0 30px 80px #4f39331a}.brand{font:28px Georgia,serif}.eyebrow{margin:28px 0 8px;font-size:10px;letter-spacing:2px;color:#956f65}h1{font:32px Georgia,"Songti SC",serif;margin:0 0 14px}p{font-size:14px;line-height:1.8;color:#75645e}label{display:block;margin:26px 0 8px;font-size:11px;font-weight:700}input{width:100%;height:52px;border:1px solid #ccb7ad;background:#fff;padding:0 14px;font:14px monospace;outline:none}input:focus{border-color:#654a43}button{width:100%;height:52px;margin-top:12px;border:0;background:#513b35;color:#fff;font-weight:700}.note{margin-top:18px;padding:12px;background:#f8eee8;font-size:11px;color:#765b53}.error{color:#a33d31}.lock{display:inline-block;margin-right:6px}</style></head>
<body><main class="card"><div class="brand">✶ Already</div><div class="eyebrow">LOCAL SECRET SETUP</div><h1>连接真实 AI</h1><p>此页面只运行在你的电脑上。密钥将写入本机的 <code>.env.local</code>，不会进入聊天、浏览器存储或产品前端。</p>${message ? `<p class="error">${message}</p>` : ""}<form method="post"><label for="key">OpenAI API key</label><input id="key" name="key" type="password" autocomplete="off" placeholder="sk-..." required autofocus><button type="submit"><span class="lock">▣</span>安全保存到本机</button></form><div class="note">保存成功后，这个临时页面会自动关闭连接。请勿在其他网站或聊天窗口粘贴密钥。</div></main></body></html>`;

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", "http://127.0.0.1");
  if (url.searchParams.get("token") !== token) {
    response.writeHead(404).end("Not found");
    return;
  }
  if (request.method === "GET") {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(page());
    return;
  }
  if (request.method !== "POST") {
    response.writeHead(405).end("Method not allowed");
    return;
  }
  let body = "";
  request.on("data", (chunk) => {
    body += chunk;
    if (body.length > 12_000) request.destroy();
  });
  request.on("end", async () => {
    const secret = new URLSearchParams(body).get("key")?.trim() || "";
    if (!secret.startsWith("sk-") || secret.length < 20) {
      response.writeHead(400, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(page("这不像有效的 OpenAI API key，请重新粘贴完整密钥。"));
      return;
    }
    await writeFile(envFile, `OPENAI_API_KEY=${secret}\nOPENAI_CHAT_MODEL=gpt-5.6-luna\nOPENAI_CREATIVE_MODEL=gpt-5.6-terra\n`, { mode: 0o600 });
    await chmod(envFile, 0o600);
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(`<!doctype html><meta charset="utf-8"><style>body{display:grid;place-items:center;height:100vh;margin:0;background:#f4ede7;color:#4f3933;font-family:-apple-system,sans-serif;text-align:center}h1{font:36px Georgia,serif}</style><div><h1>✓ 已安全保存</h1><p>现在可以回到 Already。不要刷新此页面。</p></div>`);
    setTimeout(() => server.close(), 600);
  });
});

server.listen(0, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start local setup page");
  process.stdout.write(`http://127.0.0.1:${address.port}/?token=${token}\n`);
});
