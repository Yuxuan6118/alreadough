// The look of every letter to users. Email clients ignore most CSS, so this is table layout
// with inline styles only; fonts fall back to the reader's system serif / sans.

const SITE = "https://alreadough.com";
const LOGO = `${SITE}/brand/alreadough-line-mark-mail.png`;

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Blank lines start a new paragraph; single line breaks stay inside it. */
function paragraphs(body: string) {
  return body.trim().split(/\n\s*\n/).map(block =>
    `<p style="margin:0 0 18px;font-size:16px;line-height:1.85;color:#3a312d">${escapeHtml(block.trim()).replace(/\n/g, "<br>")}</p>`,
  ).join("");
}

export function letterHtml(subject: string, body: string, unsubscribeLink: string) {
  const serif = "'Songti SC','Noto Serif SC','Source Han Serif SC',Georgia,'Times New Roman',serif";
  const sans = "-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',Arial,sans-serif";
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject || "AlreaDough")}</title></head>
<body style="margin:0;padding:0;background:#f6efe7">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(body.trim().slice(0, 90))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6efe7">
<tr><td align="center" style="padding:40px 16px 48px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px">
    <tr><td style="background:#fffaf5;border:1px solid #eadccf;border-radius:22px;padding:36px 36px 34px;font-family:${sans}">
      <a href="${SITE}" style="text-decoration:none"><img src="${LOGO}" width="40" height="40" alt="AlreaDough" style="display:block;border:0;width:40px;height:40px;margin:0 0 22px"></a>
      ${subject ? `<h1 style="margin:0 0 26px;font-family:${serif};font-weight:500;font-size:24px;line-height:1.4;color:#2b2420;letter-spacing:.01em">${escapeHtml(subject)}</h1>` : ""}
      ${body.trim() ? paragraphs(body) : ""}
      <p style="margin:28px 0 0;font-family:${serif};font-size:15px;color:#9b625f">AlreaDough</p>
    </td></tr>
    <tr><td align="center" style="padding:24px 12px 0;font-family:${sans};font-size:12px;line-height:1.8;color:#a39890">
      <a href="${SITE}" style="color:#a39890;text-decoration:none">alreadough.com</a><br>
      <a href="${unsubscribeLink}" style="color:#a39890;text-decoration:underline">不想再收到这类邮件 · Unsubscribe</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}
