"use client";

import { useEffect, useRef, useState } from "react";
import DoughHop from "./DoughHop";
import { Coffee, Flag } from "@phosphor-icons/react";
import { SITE_RECORD } from "@/lib/site-info";
import { markActive, newUsageState, tickUsage } from "@/lib/usage-break";

type Lang = "zh" | "en";

export const REPORT_REASONS: Array<{ id: string; zh: string; en: string }> = [
  { id: "illegal", zh: "违法违规内容", en: "Illegal or prohibited content" },
  { id: "sexual", zh: "色情或低俗", en: "Sexual or vulgar content" },
  { id: "violence", zh: "暴力或血腥", en: "Violence or gore" },
  { id: "minors", zh: "涉及未成年人", en: "Involves minors" },
  { id: "harassment", zh: "辱骂或骚扰", en: "Abuse or harassment" },
  { id: "self_harm", zh: "涉及自伤自残", en: "Self-harm related" },
  { id: "other", zh: "其他问题", en: "Something else" },
];

/** The one-line "this is AI" note under the input box, the way ChatGPT and Claude show theirs. Shown once, not per message. */
export function AiNote({ lang }: { lang: Lang }) {
  return <small className="composer-note">{lang === "zh" ? "内容由 AI 生成，可能出错，请仔细甄别" : "AlreaDough is AI and can make mistakes. Check important info."}</small>;
}

/** Report an AI reply (or any content). Posts to /api/report; the founder reads these in the cockpit. */
export function ReportDialog({ lang, sessionId, excerpt, onClose }: { lang: Lang; sessionId: string; excerpt?: string; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const zh = lang === "zh";

  const submit = async () => {
    if (!reason || state === "sending") return;
    setState("sending");
    try {
      const response = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json", "x-already-session-id": sessionId }, body: JSON.stringify({ sessionId, reason, detail, replyExcerpt: excerpt, lang }) });
      setState(response.ok ? "done" : "error");
    } catch { setState("error"); }
  };

  return <div className="memory-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="memory-modal report-modal" role="dialog" aria-modal="true" aria-label={zh ? "举报" : "Report"}>
      {state === "done" ? <>
        <h2>{zh ? "已收到" : "Received"}</h2>
        <p>{zh ? "谢谢你告诉我们。我们会尽快查看并处理。" : "Thank you for telling us. We will look at it as soon as we can."}</p>
        <footer><span /><button className="primary" onClick={onClose}>{zh ? "关闭" : "Close"}</button></footer>
      </> : <>
        <h2>{zh ? "举报内容" : "Report content"}</h2>
        {excerpt && <blockquote className="report-excerpt">{excerpt.slice(0, 200)}{excerpt.length > 200 ? "…" : ""}</blockquote>}
        <div className="report-reasons" role="radiogroup" aria-label={zh ? "举报原因" : "Reason"}>
          {REPORT_REASONS.map((item) => <button type="button" role="radio" aria-checked={reason === item.id} className={reason === item.id ? "selected" : ""} key={item.id} onClick={() => setReason(item.id)}>{zh ? item.zh : item.en}</button>)}
        </div>
        <label><span>{zh ? "补充说明（选填）" : "Details (optional)"}</span><textarea value={detail} maxLength={1000} onChange={(event) => setDetail(event.target.value)} /></label>
        {state === "error" && <p className="field-error" role="alert">{zh ? "没有发送成功，请稍后再试。" : "It did not send. Please try again shortly."}</p>}
        <footer><button className="outline-button" onClick={onClose}>{zh ? "取消" : "Cancel"}</button><button className="primary" disabled={!reason || state === "sending"} onClick={submit}>{state === "sending" ? <span className="dough-loading"><DoughHop size="xs"/>{zh ? "发送中…" : "Sending…"}</span> : (zh ? "提交举报" : "Submit report")}</button></footer>
      </>}
    </section>
  </div>;
}

/** Every 2 hours of continuous chatting, a gentle note. It never blocks anything. */
export function BreakReminder({ lang, activity }: { lang: Lang; activity: number }) {
  const [show, setShow] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const stateRef = useRef(newUsageState(startedAt));

  useEffect(() => { stateRef.current = markActive(stateRef.current, Date.now()); }, [activity]);
  useEffect(() => {
    const TICK = 30_000;
    const timer = window.setInterval(() => {
      const result = tickUsage(stateRef.current, Date.now(), document.visibilityState === "visible", TICK);
      stateRef.current = result.state;
      if (result.remind) setShow(true);
    }, TICK);
    return () => window.clearInterval(timer);
  }, []);

  if (!show) return null;
  const zh = lang === "zh";
  return <aside className="install-tip break-tip" role="status">
    <span className="install-tip-icon" aria-hidden="true"><Coffee size={20}/></span>
    <div><strong>{zh ? "你已经聊了很久" : "You have been chatting for a while"}</strong><small>{zh ? "已连续使用约 2 小时。起来动一动、喝口水，休息一下吧。" : "About 2 hours in a row. Stretch, have some water, and rest a little."}</small></div>
    <button className="install-tip-action" onClick={() => setShow(false)}>{zh ? "知道了" : "OK"}</button>
  </aside>;
}

/** Filing numbers and the filed model's name, once they exist (see lib/site-info.ts). Renders nothing while they are empty. */
export function SiteRecord({ lang }: { lang: Lang }) {
  const r = SITE_RECORD;
  if (!r.icp && !r.police && !r.model && !r.contactEmail) return null;
  return <footer className="site-record">
    {r.icp && <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">{r.icp}</a>}
    {r.police && <a href={`https://beian.mps.gov.cn/#/query/webSearch${r.policeCode ? `?code=${encodeURIComponent(r.policeCode)}` : ""}`} target="_blank" rel="noreferrer">{r.police}</a>}
    {r.model && <span>{lang === "zh" ? "本服务使用的大模型：" : "Model used: "}{r.model}{r.modelFiling ? ` ${r.modelFiling}` : ""}</span>}
    {r.contactEmail && <a href={`mailto:${r.contactEmail}`}>{lang === "zh" ? "联系与举报：" : "Contact and reports: "}{r.contactEmail}</a>}
  </footer>;
}

/** A "report" button shaped like the other reply actions. */
export function ReportButton({ lang, onClick }: { lang: Lang; onClick: () => void }) {
  return <button onClick={onClick} aria-label={lang === "zh" ? "举报" : "Report"}><Flag size={15}/><span>{lang === "zh" ? "举报" : "Report"}</span></button>;
}
