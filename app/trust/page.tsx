import type { Metadata } from "next";
import SiteFooter from "../components/SiteFooter";
import styles from "./trust.module.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI & Safety · AlreaDough",
  description: "How AlreaDough uses AI, preserves user desires, handles memory, and limits harmful real-world methods.",
};

const sections = [
  {
    id: "ai-use",
    number: "01",
    title: "AI 的使用 · How AI is used",
    paragraphs: [
      "AlreaDough 使用人工智能生成连续对话、限制性信念反思、Revision 和完成态 Storytelling。用户正在与 AI 系统互动，而不是人类教练。",
      "AI 可能误解上下文、遗漏细节或生成不合适的内容。AlreaDough 不把模型回复描述为医学、心理、法律、财务或危机服务，也不保证每条回复都经过人工审阅。",
    ],
  },
  {
    id: "desire",
    number: "02",
    title: "愿望保留式 AI · Desire-preserving AI",
    paragraphs: [
      "AlreaDough 不会仅仅因为一个愿望困难、涉及特定对象或不符合普通人的预期，就羞辱、说教或自动改写用户的愿望。想象、完成态故事、inner conversation、肯定语和 Revision 可以围绕用户选择的愿望进行。",
      "保留愿望不等于协助任何现实手段。若请求涉及盗号、跟踪、偷拍、勒索、骚扰、冒充、散布隐私、强迫、伤害或其他违法行为，AlreaDough 可以拒绝该具体手段，同时继续支持用户回到双方自愿、公开、安心的愿望场景。",
    ],
  },
  {
    id: "content-standards",
    number: "03",
    title: "禁止内容与举报 · Prohibited content and reports",
    paragraphs: [
      "用户不得提交、录制、上传（包括用于生成定制声音的录音）或要求 AI 生成色情或 NSFW 内容、暴力或血腥内容、仇恨或歧视内容，以及任何涉及未成年人的性化或危害内容。对儿童性剥削与性虐待内容（CSAM）零容忍：一经发现立即删除、永久封禁账户，并依法向有关机构报告。完整定义见《服务条款》“禁止内容”一节。",
      "每条 AI 回复下方都有“举报”按钮，所有举报均由人工审核。涉及未成年人、儿童性剥削或人身安全紧迫威胁的举报在 24 小时内处理，其他举报在 3 个工作日内审核。处理措施包括删除内容、限制功能、暂停或终止账户，以及依法报告。完整流程见《服务条款》“举报与处理”一节。",
    ],
  },
  {
    id: "outcomes",
    number: "04",
    title: "结果与责任 · Outcomes and responsibility",
    paragraphs: [
      "AlreaDough 是一项结构化的想象与自我练习工具，不承诺某个愿望、关系、信息、金钱、身体变化、时间点或其他外部结果一定发生。",
      "AI 不会被呈现为已经验证另一位现实人物的私人思想或感受。用户仍对自己的现实决定、沟通、消费和行为负责。",
    ],
  },
  {
    id: "wellbeing",
    number: "05",
    title: "安全与紧急情况 · Wellbeing and emergencies",
    paragraphs: [
      "AlreaDough 不是心理治疗、医疗服务或危机热线。普通的怀疑、动摇和显化练习不会触发反复的现实提醒。",
      "当内容明确表示可能立即自伤、伤害他人或处于紧急危险时，产品可以短暂暂停沉浸，引导用户联系身边可信任的人、当地急救或危机支持。AlreaDough 不保证能够检测或介入所有紧急情况。",
    ],
  },
  {
    id: "memory",
    number: "06",
    title: "记忆与隐私 · Memory and privacy",
    paragraphs: [
      "AI 服务商处理生成回复所需的信息。请避免输入密码、支付卡号、证件号码或无权分享的他人信息。",
    ],
  },
  {
    id: "subscription",
    number: "07",
    title: "订阅与测试版 · Subscription and beta",
    paragraphs: [
      "付款前会显示价格、续费与取消条件。",
      "测试版仅面向年满 18 岁的用户。",
    ],
  },
];

export default function TrustPage() {
  return (
    <><main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>← Back to AlreaDough</Link>
        <a href="/en/trust" className={styles.back} lang="en" hrefLang="en">English</a>
      </header>
      <section className={styles.hero}>
        <p>ALREADOUGH · TRUST CENTER</p>
        <h1>AI、愿望与安全说明</h1>
        <h2>AI, Desire &amp; Safety Notice</h2>
        <div className={styles.promise}>
          <span>OUR CORE PROMISE</span>
          <strong>你的愿望不会在这里被说教、羞辱或自动改写。</strong>
          <em>We don&apos;t debate the desire. We help you stay with the state you chose.</em>
        </div>
      </section>
      <nav className={styles.nav} aria-label="Notice sections">
        {sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.number}</a>)}
      </nav>
      <div className={styles.content}>
        {sections.map((section) => (
          <section id={section.id} key={section.id} className={styles.section}>
            <span>{section.number}</span>
            <div><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.id === "memory" && <p><a href="/privacy">隐私说明</a></p>}{section.id === "content-standards" && <p><a href="/terms#prohibited-content">禁止内容</a> · <a href="/terms#reporting">举报与处理</a></p>}</div>
          </section>
        ))}
      </div>
    </main><SiteFooter /></>
  );
}
