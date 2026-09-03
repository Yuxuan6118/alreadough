import type { Metadata } from "next";
import Link from "next/link";
import styles from "./trust.module.css";

export const metadata: Metadata = {
  title: "AI & Safety · Already",
  description: "How Already uses AI, preserves user desires, handles memory, and limits harmful real-world methods.",
};

const sections = [
  {
    id: "ai-use",
    number: "01",
    title: "AI 的使用 · How AI is used",
    paragraphs: [
      "Already 使用人工智能生成连续对话、限制性信念反思、Revision 和完成态 Storytelling。用户正在与 AI 系统互动，而不是人类教练。",
      "AI 可能误解上下文、遗漏细节或生成不合适的内容。Already 不把模型回复描述为医学、心理、法律、财务或危机服务，也不保证每条回复都经过人工审阅。",
    ],
  },
  {
    id: "desire",
    number: "02",
    title: "愿望保留式 AI · Desire-preserving AI",
    paragraphs: [
      "Already 不会仅仅因为一个愿望困难、涉及特定对象或不符合普通人的预期，就羞辱、说教或自动改写用户的愿望。想象、完成态故事、inner conversation、肯定语和 Revision 可以围绕用户选择的愿望进行。",
      "保留愿望不等于协助任何现实手段。若请求涉及盗号、跟踪、偷拍、勒索、骚扰、冒充、散布隐私、强迫、伤害或其他违法行为，Already 可以拒绝该具体手段，同时继续支持用户回到双方自愿、公开、安心的愿望场景。",
    ],
  },
  {
    id: "outcomes",
    number: "03",
    title: "结果与责任 · Outcomes and responsibility",
    paragraphs: [
      "Already 是一项结构化的想象与自我练习工具，不承诺某个愿望、关系、信息、金钱、身体变化、时间点或其他外部结果一定发生。",
      "AI 不会被呈现为已经验证另一位现实人物的私人思想或感受。用户仍对自己的现实决定、沟通、消费和行为负责。",
    ],
  },
  {
    id: "wellbeing",
    number: "04",
    title: "安全与紧急情况 · Wellbeing and emergencies",
    paragraphs: [
      "Already 不是心理治疗、医疗服务或危机热线。普通的怀疑、动摇和显化练习不会触发反复的现实提醒。",
      "当内容明确表示可能立即自伤、伤害他人或处于紧急危险时，产品可以短暂暂停沉浸，引导用户联系身边可信任的人、当地急救或危机支持。Already 不保证能够检测或介入所有紧急情况。",
    ],
  },
  {
    id: "memory",
    number: "05",
    title: "记忆与隐私 · Memory and privacy",
    paragraphs: [
      "当前私人测试版把愿望卡、聊天、Revision、旅程摘要和愿景板保存在用户自己的设备上。调用 AI 时，只发送当前愿望卡、限制性信念、旅程摘要、少量最近消息和当前请求。愿景板图片不会自动发送给 AI。",
      "AI 请求通过 Already 的服务端发送，API 密钥不会暴露在浏览器里。测试版请求设置为不在模型响应接口中保存，但第三方模型供应商的数据政策、必要的安全处理及服务日志仍可能适用。请勿输入密码、支付卡、证件、医疗记录或无权分享的第三方隐私。",
    ],
  },
  {
    id: "subscription",
    number: "06",
    title: "订阅与测试版 · Subscription and beta",
    paragraphs: [
      "当前版本是创始人私人测试版，尚未开放公开订阅。正式收费前，Already 将公布定价、用量、取消、退款、数据删除和联系渠道，并在用户付款前明确展示。",
      "正式对外测试拟仅面向年满 18 岁的用户。此页面是产品声明草案，上线前仍需根据实际公司主体、模型供应商、支付方式和服务地区完成法律审核。",
    ],
  },
];

export default function TrustPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>← Back to Already</Link>
        <span className={styles.draft}>PRIVATE BETA · PRODUCT DRAFT</span>
      </header>
      <section className={styles.hero}>
        <p>ALREADY · TRUST CENTER</p>
        <h1>AI、愿望与安全说明</h1>
        <h2>AI, Desire &amp; Safety Notice</h2>
        <div className={styles.promise}>
          <span>OUR CORE PROMISE</span>
          <strong>你的愿望不会在这里被说教、羞辱或自动改写。</strong>
          <em>We don&apos;t debate the desire. We help you stay with the state you chose.</em>
        </div>
        <small>Version 0.1 · Updated September 1, 2026</small>
      </section>
      <nav className={styles.nav} aria-label="Notice sections">
        {sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.number}</a>)}
      </nav>
      <div className={styles.content}>
        {sections.map((section) => (
          <section id={section.id} key={section.id} className={styles.section}>
            <span>{section.number}</span>
            <div><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
          </section>
        ))}
      </div>
      <footer className={styles.footer}>
        <strong>Already</strong>
        <span>One desire. Deep belief. A steady return.</span>
        <Link href="/">Return to your space →</Link>
      </footer>
    </main>
  );
}
