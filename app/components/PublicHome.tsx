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
    enter: "开始练习",
    featuresTitle: "你可以在这里做什么",
    features: [
      ["显化陪练", "围绕你的显化目标展开对话。遇到动摇时，从当下的处境里找到具体的练习。"],
      ["转念重写", "把在意的 3D 片段，写成目标落地时你想看到的样子。"],
      ["自制 Sub", "自由搭配场景音效和肯定语，DIY 你的专属 subliminal。"],
      ["愿景板", "用图片和文字自制愿景板，把目标落地后的生活变成看得见的画面。"],
    ],
  },
  en: {
    navigation: "Website navigation",
    featuresLink: "Features",
    pricing: "Pricing",
    headline: ["One desire.", "A daily practice."],
    introduction: "Explore the life you want through AI conversations, writing, and audio practices in English or Chinese.",
    enter: "Start practicing",
    featuresTitle: "What you can do in AlreaDough",
    features: [
      ["Manifestation coaching", "Practice toward your goal in conversation and find a concrete exercise for what you are facing today."],
      ["Revision", "Rewrite a moment you keep replaying as a scene from the life you want to experience."],
      ["DIY subliminals", "Mix your own affirmations with ambient sounds to make a subliminal that fits your practice."],
      ["Vision board", "Build a vision board with images and words that show what life looks like when your goal is realized."],
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
            <a href={`/app?lang=${lang}`} className={styles.action}>{t.enter} <span aria-hidden="true">→</span></a>
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
