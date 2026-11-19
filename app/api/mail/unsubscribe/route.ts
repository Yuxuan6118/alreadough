import { unsubscribe, verifyUnsubscribe } from "@/lib/mailing";

const page = (title: string, text: string, form = "") => new Response(`<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} · AlreaDough</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f1ea;color:#2b2622;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Helvetica Neue",sans-serif;padding:16px;box-sizing:border-box}main{max-width:420px;text-align:center;line-height:1.7}h1{font-size:22px;font-weight:600}button{margin-top:16px;border:0;border-radius:999px;background:#2b2622;color:#f6f1ea;padding:12px 28px;font-size:16px;cursor:pointer}a{color:#8a817a}
@media (prefers-color-scheme:dark){body{background:#1d1a17;color:#efe7dd}button{background:#efe7dd;color:#1d1a17}}</style></head>
<body><main><h1>${title}</h1><p>${text}</p>${form}<p style="margin-top:32px;font-size:13px"><a href="/">alreadough.com</a></p></main></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

const bad = () => page("链接无效 · Link invalid", "这个退订链接不完整。可以直接回复任意一封邮件，我们会帮你退订。<br>This unsubscribe link is incomplete. Reply to any of our emails and we will take you off the list.");

// GET only shows a button: mail scanners open links, and must not unsubscribe anyone by doing so.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const email = await verifyUnsubscribe(url.searchParams.get("e"), url.searchParams.get("t"));
  if (!email) return bad();
  return page("退订邮件 · Unsubscribe", "确定以后不再收到 AlreaDough 的邮件吗？登录验证码不受影响。<br>Stop receiving emails from AlreaDough? Sign-in codes still arrive.",
    `<form method="post"><button type="submit">确定退订 · Unsubscribe</button></form>`);
}

// The button above, and mail apps' one-click unsubscribe (RFC 8058), both POST to the same signed link.
export async function POST(request: Request) {
  const url = new URL(request.url);
  const email = await verifyUnsubscribe(url.searchParams.get("e"), url.searchParams.get("t"));
  if (!email) return bad();
  await unsubscribe(email);
  return page("已退订 · Unsubscribed", "以后不会再给你发这类邮件了。<br>You will not receive these emails again.");
}
