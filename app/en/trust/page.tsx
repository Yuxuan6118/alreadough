import type { Metadata } from "next";
import SiteFooter from "../../components/SiteFooter";
import styles from "../../trust/trust.module.css";

export const metadata: Metadata = {
  title: "AI & Safety · AlreaDough",
  description: "How AlreaDough uses AI, protects your privacy, and handles harmful requests.",
};

const sections = [
  {
    id: "ai-use",
    title: "How AI is used",
    paragraphs: [
      "AlreaDough uses AI for ongoing conversations, reflection on limiting beliefs, revision, and stories that imagine a desired outcome. You interact with an AI system.",
      "AI can misunderstand context, miss details, or produce inappropriate content. Its responses do not provide medical, psychological, legal, financial, or crisis services. Individual replies may be generated without human review.",
    ],
  },
  {
    id: "desire",
    title: "Your choice of desire",
    paragraphs: [
      "The service lets you explore your chosen desire through imagination, storytelling, inner conversations, affirmations, and revision. It does not automatically rewrite a desire because it is difficult, involves a particular person, or differs from others’ expectations.",
      "AlreaDough may refuse requests involving unauthorized account access, stalking, covert recordings, blackmail, harassment, impersonation, disclosure of private information, coercion, harm, or other unlawful acts. It can still help you imagine situations that respect everyone’s consent and safety.",
    ],
  },
  {
    id: "outcomes",
    title: "Outcomes and responsibility",
    paragraphs: [
      "AlreaDough provides structured imagination and personal practice. It makes no guarantees about wishes, relationships, messages, money, physical changes, timing, or other external outcomes.",
      "AI cannot verify another person’s private thoughts or feelings. You remain responsible for your decisions, communication, spending, and actions.",
    ],
  },
  {
    id: "wellbeing",
    title: "Wellbeing and emergencies",
    paragraphs: [
      "AlreaDough does not provide therapy, medical care, or a crisis hotline. Ordinary doubt or uncertainty during a practice does not trigger repeated reminders.",
      "When your message indicates an immediate risk of self-harm, harm to others, or another emergency, the service may pause the practice and suggest contacting someone you trust, local emergency services, or crisis support. It may miss some emergencies.",
    ],
  },
  {
    id: "memory",
    title: "Memory and privacy",
    paragraphs: [
      "AlreaDough stores your practice data on your device and backs up your space for syncing. During the beta, the founder can review a separate copy of AI conversations to improve the product. We also log approximate location, device type, and usage. Our database does not record IP addresses.",
      "AI requests may include the current desire card, limiting beliefs, practice summary, a few recent messages, and the current prompt. Vision board images are not sent automatically. Requests go through the AlreaDough server. We disable storage for model responses in the API request, and the provider’s security processing, logs, and data policies may still apply. Please avoid entering passwords, card details, identity documents, medical records, or private information you are not authorized to share.",
    ],
  },
  {
    id: "subscription",
    title: "Subscription and beta",
    paragraphs: [
      "The application is currently in private beta. Before public subscriptions open, AlreaDough will explain pricing, usage, cancellation, refunds, data deletion, and how to get support before you pay.",
      "AlreaDough is intended for adults aged 18 and older. This safety notice is a draft for the beta.",
    ],
  },
];

export default function EnglishTrustPage() {
  return (
    <div lang="en">
      <main className={styles.page}>
        <header className={styles.header}>
          <a href="/en" className={styles.back}>← Back to AlreaDough</a>
          <a href="/trust" className={styles.back} lang="zh-CN" hrefLang="zh-CN">中文</a>
        </header>
        <section className={styles.hero}>
          <h1>AI, Desire &amp; Safety Notice</h1>
        </section>
        <nav className={styles.nav} aria-label="Notice sections">
          {sections.map((section, index) => <a key={section.id} href={`#${section.id}`} aria-label={section.title}>{index + 1}</a>)}
        </nav>
        <div className={styles.content}>
          {sections.map((section, index) => (
            <section id={section.id} key={section.id} className={styles.section}>
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <div><h2>{section.title}</h2>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter lang="en" />
    </div>
  );
}
