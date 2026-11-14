import Image from "next/image";
import SiteFooter from "./SiteFooter";
import styles from "../home.module.css";

const copy = {
  zh: {
    navigation: "官网导航",
    featuresLink: "功能",
    pricing: "会员与价格",
    headline: ["给一个愿望，", "留出每天练习的空间。"],
    introduction: "AlreaDough 是一个中英文 AI 陪练空间。用对话、写作和声音练习，探索你想过的生活。",
    enter: "进入内测",
    featuresTitle: "你可以在这里做什么",
    features: [
      ["AI 陪练", "围绕一个愿望记录当下的想法，在后续对话里接着聊。"],
      ["故事与重写", "把愿望写成具体的生活场景，也可以把在意的一段经历重新写一遍。"],
      ["声音练习", "写下肯定语，录制自己的声音，并搭配环境音制作练习音轨。"],
      ["愿景板", "用图片和文字，把想象中的生活整理成一张随时能回看的拼贴。"],
    ],
  },
  en: {
    navigation: "Website navigation",
    featuresLink: "Features",
    pricing: "Pricing",
    headline: ["One desire.", "A daily practice."],
    introduction: "Explore the life you want through AI conversations, writing, and audio practices in English or Chinese.",
    enter: "Enter the beta",
    featuresTitle: "What you can do in AlreaDough",
    features: [
      ["AI companion", "Explore a desire in conversation and pick up where you left off."],
      ["Stories and revision", "Write an everyday scene from the life you want, or revisit and rewrite a moment that stayed with you."],
      ["Audio practice", "Write affirmations, record your own voice, and mix it with ambient sounds."],
      ["Vision board", "Bring images and words together in a collage you can return to anytime."],
    ],
  },
};

export default function PublicHome({ lang }: { lang: "zh" | "en" }) {
  const english = lang === "en";
  const base = english ? "/en" : "";
  const t = copy[lang];
  return (
    <div lang={english ? "en" : "zh-CN"}>
      <header className={styles.header}>
        <a href={base || "/"} className={styles.wordmark}>Alrea<span>Dough</span></a>
        <nav aria-label={t.navigation}>
          <a href="#features">{t.featuresLink}</a>
          <a href={`${base}/pricing`}>{t.pricing}</a>
          <a className={styles.language} href={english ? "/" : "/en"} hrefLang={english ? "zh-CN" : "en"} lang={english ? "zh-CN" : "en"}>{english ? "中文" : "English"}</a>
        </nav>
      </header>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div>
            <h1>{t.headline[0]}<br />{t.headline[1]}</h1>
            <p>{t.introduction}</p>
            <a href="/app" className={styles.action}>{t.enter} <span aria-hidden="true">→</span></a>
          </div>
          <div className={styles.art}>
            <Image src="/brand/already-dough-mark.png" width={420} height={420} alt="" priority />
          </div>
        </section>
        <section id="features" className={styles.features} aria-labelledby="features-heading">
          <h2 id="features-heading">{t.featuresTitle}</h2>
          <dl>
            {t.features.map(([name, description]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{description}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
