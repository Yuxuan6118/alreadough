import { ArrowsClockwise, BookOpenText, ChatCircleDots, Desktop, ImagesSquare, UserCircle, Waveform } from "@phosphor-icons/react/dist/ssr";
import type { ComponentType } from "react";
import { MEMBER_PLANS } from "@/lib/member-client";
import SiteFooter from "./SiteFooter";
import ModuleIndex from "./ModuleIndex";
import PetPreview from "./PetPreview";
import PlanPicker from "./PlanPicker";
import styles from "./product.module.css";

type Lang = "zh" | "en";
type Module = { id: string; icon: ComponentType<{ size?: number; weight?: "light" | "regular" | "duotone" }>; name: string; title: string; body: string; details: string[] };

// Every claim below describes something the app does today (see app/app/page.tsx and the feature components).
const copy = {
  zh: {
    nav: { features: "功能", philosophy: "理念", pricing: "会员", start: "开始练习", language: "English", navigation: "产品页导航" },
    download: { mac: "下载 Mac 版", win: "下载 Windows 版" },
    tag: "中英文 AI 显化陪练",
    headline: "愿望已经成立，",
    headlineAccent: "每天回来练习。",
    intro: "AlreaDough 用对话、剧本、转念、愿景板和声音，陪你每天回到愿望已经实现的样子。",
    modulesTitle: "一个愿望，几种练习方式。",
    modulesIntro: "每个功能都围绕你当前的愿望卡展开，练习记录会彼此连起来。",
    modules: [
      { id: "coach", icon: ChatCircleDots, name: "显化陪练", title: "说出此刻的念头，得到一个具体的练习。", body: "陪练围绕你选定的愿望和你对话。它用愿望已经实现的现在时回应，不分析可能性，也不替你定义感受。你动摇的时候，它给你一句此刻就能想、能说的话，或一个能马上做的小动作。", details: ["三种引导方式可选：释放、假设法则、潜意识语言", "记得你告诉过它的人、事和偏好，你可以在记忆库里查看和修改", "回复不合适可以一键举报；出现危险信号时，它会先陪你联系身边的人或当地的支持"] },
      { id: "stories", icon: BookOpenText, name: "剧本", title: "把愿望写成一个可以反复进入的场景。", body: "每个剧本都是一段愿望实现后的场景。你写下几个关键词，AI 把它扩写成有真实地点、声音和气味的完整剧本，之后随时修改。", details: ["最多保存 30 个剧本", "对话里喜欢的回复可以一键存成剧本", "剧本可以带进潜音，用你自己的声音听"] },
      { id: "revision", icon: ArrowsClockwise, name: "转念", title: "把挡在愿望前面的那句话，换成一句新念头。", body: "写下那句让你动摇的旧念头。AI 会结合你的当前愿望，把它转成一句你念得出口的新念头。", details: ["反复出现的旧念头会列成清单，点「转念」就能带过去", "接纳新念头后，那一句旧念头会从清单里拿掉", "新念头可以带进潜音，睡前反复听"] },
      { id: "board", icon: ImagesSquare, name: "愿景板", title: "把愿望实现后的生活，排成一张看得见的图。", body: "选 2 到 12 张你自己的照片，AlreaDough 先排出一个可用的版本，你再拖动换位、单独调整每一张。", details: ["多种模板，拖动照片就能交换位置", "支持 JPG、PNG、WebP，单张不超过 10 MB", "导出 PNG，可以设成手机壁纸或打印出来"] },
      { id: "sound", icon: Waveform, name: "潜音", title: "用自己的声音，听愿望已经实现的生活。", body: "朗读一段约 45 秒的稿子，经你同意后生成你的专属声音，用它读你的剧本和肯定语，适合睡前听。声音只属于你，可以随时删除。", details: ["多轨制作台：人声、音乐和环境声自由搭配，导出 WAV 反复播放", "可以上传你有权使用的音乐和白噪音，音频只在你的设备上处理", "持续听到设定的时长，自动完成当天的打卡"] },
      { id: "space", icon: UserCircle, name: "我的空间", title: "愿望、记忆和练习记录，都在你手里。", body: "可以同时放好几个愿望，按想要的程度排序，每个愿望有自己的记忆和对话。", details: ["愿望、记忆、对话和练习记录可以跨设备同步", "一键导出全部数据，解压后在浏览器里就能查看、搜索", "愿望实现后可以归档，再开一张新的愿望卡"] },
      { id: "pet", icon: Desktop, name: "桌宠", title: "让面团住在你的电脑桌面上。", body: "它会呼吸，轻点会弹一下，拉一拉会拉长再弹回去，连点三下会开一场醒发派对。没有打卡，也不打扰你。", details: ["Mac 版和 Windows 版，免费下载", "右键可以换大小、让它躲一会儿，或者让它下班"] },
    ] as Module[],
    philosophyTitle: "名字里的两个词。",
    philosophyBody: "AlreaDough 由 Already 和 Dough 组成。Already 是练习的立场：你想要的已经成立，所以我们用现在时谈论它。Dough 是练习的方式：像揉面一样，每天揉一点，再等它慢慢醒发。会员的名字「轻揉」「醒发」「丰盛工坊」也来自这里。",
    principles: [
      ["陪练，不是咨询", "不分析愿望可不可能，不复述缺少的东西，也不用旧故事反驳你的新选择。"],
      ["每天一点点", "练习不需要很长。一句话、一个画面、一段声音，就够今天用。"],
      ["你的东西归你", "练习用的音频默认留在你的设备上；愿望和记录可以随时导出，也可以删除。"],
    ],
    safety: "显化陪伴可以帮你稳住心态，但不代替看医生、吃药和专业帮助。",
    pricingTitle: "会员与价格",
    pricingIntro: "按用量计算。一次购买 30 天，到期不会自动扣款。",
    free: "免费",
    perMonth: "/ 30 天",
    session: (n: number) => `每 5 小时约 ${n} 次对话`,
    week: (n: number) => `每周约 ${n} 次对话`,
    stories: (n: number) => n >= 70 ? "剧本几乎不限（每周 70 篇）" : `每周 ${n} 篇 AI 剧本`,
    planNotes: { soft: "登录即可使用", deep: "适合每天练习", atelier: "用量是醒发的 3 倍以上；新用户注册后免费体验 7 天" },
    estimate: "次数是估算，较长的对话会多算一些。",
    pricingCta: "查看会员详情",
  },
  en: {
    nav: { features: "Features", philosophy: "Philosophy", pricing: "Pricing", start: "Start practicing", language: "中文", navigation: "Product page navigation" },
    download: { mac: "Download for Mac", win: "Download for Windows" },
    tag: "AI manifestation practice in English and Chinese",
    headline: "Your wish is already real.",
    headlineAccent: "Practice it every day.",
    intro: "AlreaDough uses conversation, stories, revision, vision boards and sound to bring you back, every day, to the life where your wish has come true.",
    modulesTitle: "One wish, several ways to practice.",
    modulesIntro: "Every feature works from your current wish card, and your practice connects across them.",
    modules: [
      { id: "coach", icon: ChatCircleDots, name: "Manifestation coaching", title: "Say what you are thinking. Get one concrete practice.", body: "Your coach talks with you about the wish you chose. It answers in the present tense of a wish already fulfilled, does not debate whether it is possible, and does not define your feelings for you. When you waver, it gives you one line to think or say right now, or one small thing to do.", details: ["Three guidance methods: Release, Assumption, and Subconscious language", "Remembers the people, events and preferences you share; view and edit them in your memory library", "Report any reply in one tap; if there are signs of danger, it first helps you reach someone near you or local support"] },
      { id: "stories", icon: BookOpenText, name: "Stories", title: "Turn your wish into a scene you can step into again and again.", body: "Each story is a scene from the life where your wish has come true. Write it yourself or let the AI write it from your wish, then edit it whenever you like.", details: ["Keep up to 30 stories", "Save any reply you love from a conversation as a story", "Take a story into Dreamscape and hear it in your own voice"] },
      { id: "revision", icon: ArrowsClockwise, name: "Reframe", title: "Swap the line standing in front of your wish for a new thought.", body: "Write down the old thought that shakes you. The AI works from your current wish to turn it into a new thought you can say as your own.", details: ["Recurring old thoughts are kept in a list; tap Reframe to take one over", "Once you accept the new thought, the old one leaves the list", "Take new thoughts into Dreamscape and hear them before sleep"] },
      { id: "board", icon: ImagesSquare, name: "Vision board", title: "Lay out the life after your wish, as one picture you can see.", body: "Choose 2 to 12 of your own photos. AlreaDough arranges a first version, then you drag to reorder and adjust each photo.", details: ["Several templates; drag a photo to swap places", "JPG, PNG or WebP, up to 10 MB each", "Export a PNG for your phone wallpaper or to print"] },
      { id: "sound", icon: Waveform, name: "Dreamscape", title: "Hear the life where your wish came true, in your own voice.", body: "Read a script of about 45 seconds and, with your consent, create your own voice. It reads your stories and affirmations, made for listening before sleep. The voice belongs to you and you can delete it at any time.", details: ["Multitrack studio: mix voice, music and ambient sound, then export a WAV to replay", "Upload music and white noise you have the right to use; audio is processed only on your device", "Listening for the length you set completes that day's check-in"] },
      { id: "space", icon: UserCircle, name: "My space", title: "Your wishes, memory and practice stay in your hands.", body: "Keep several wishes at once, ordered by how much you want each one. Every wish has its own memory and conversations.", details: ["Sync wishes, memory, conversations and practice across devices", "Export everything in one tap; unzip it and browse or search it in a browser", "Archive a wish once it has happened and open a new wish card"] },
      { id: "pet", icon: Desktop, name: "Desktop pet", title: "Let the dough live on your desktop.", body: "It breathes, bounces when you tap it, stretches when you pull it and springs back, and throws a rising party when you tap three times. No check-ins, and it never interrupts you.", details: ["Free for Mac and Windows", "Right-click to resize it, let it hide for a while, or send it home"] },
    ] as Module[],
    philosophyTitle: "Two words in one name.",
    philosophyBody: "AlreaDough is Already plus Dough. Already is where the practice stands: what you want is already real, so we speak of it in the present tense. Dough is how the practice works: knead a little every day, then let it rise. The plan names Soft Start, Deep Practice and Dough Atelier come from the same idea.",
    principles: [
      ["A practice partner, not a counselor", "We do not debate whether your wish is possible, repeat what is missing, or use an old story to argue with your new choice."],
      ["A little every day", "Practice does not need to be long. One line, one picture, one piece of sound is enough for today."],
      ["What is yours stays yours", "Practice audio stays on your device by default, and you can export or delete your wishes and records at any time."],
    ],
    safety: "Manifestation practice can help you stay steady, but it does not replace a doctor, medicine or professional help.",
    pricingTitle: "Membership and pricing",
    pricingIntro: "Usage-based allowances. Each purchase lasts 30 days and never renews on its own.",
    free: "Free",
    perMonth: "/ 30 days",
    session: (n: number) => `About ${n} conversations per 5 hours`,
    week: (n: number) => `About ${n} conversations per week`,
    stories: (n: number) => n >= 70 ? "Scripts almost unlimited (70 a week)" : `${n} AI scripts a week`,
    planNotes: { soft: "Available as soon as you sign in", deep: "Made for daily practice", atelier: "More than three times Deep Practice; free for your first 7 days after signing up" },
    estimate: "Counts are estimates; longer conversations count a little more.",
    pricingCta: "Membership details",
  },
};

export default function ProductPage({ lang }: { lang: Lang }) {
  const t = copy[lang];
  const zh = lang === "zh";
  const appHref = `/app?lang=${lang}`;
  return (
    <div className={styles.page} lang={zh ? "zh-CN" : "en"}>
      <header className={styles.navWrap}>
        <nav className={styles.nav} aria-label={t.nav.navigation}>
          <a href={zh ? "/about" : "/en/about"} className={styles.brand} aria-label="AlreaDough">
            <img src="/brand/already-dough-mark.png" alt="" aria-hidden="true" />
            <span>Alrea<span>Dough</span></span>
          </a>
          <div className={styles.links}>
            <a href="#features">{t.nav.features}</a>
            <a href="#philosophy">{t.nav.philosophy}</a>
            <a href="#pricing">{t.nav.pricing}</a>
          </div>
          <div className={styles.actions}>
            <a href={zh ? "/en/about" : "/about"} className={styles.language} hrefLang={zh ? "en" : "zh-CN"} lang={zh ? "en" : "zh-CN"}>{t.nav.language}</a>
          </div>
        </nav>
      </header>

      <main>
        <section className={styles.hero}>
          <span className={styles.tag}>{t.tag}</span>
          <h1>{t.headline}<br /><span>{t.headlineAccent}</span></h1>
          <p>{t.intro}</p>
          <a href={appHref} className={styles.heroCta}>{t.nav.start}</a>
          <img className={styles.dough} src="/brand/already-dough-mark.png" width={360} height={360} alt="" />
        </section>

        <section id="features" className={styles.modules} aria-labelledby="features-title">
          <div className={styles.sectionHead}>
            <h2 id="features-title">{t.modulesTitle}</h2>
            <p>{t.modulesIntro}</p>
          </div>
          <div className={styles.moduleGrid}>
            <ModuleIndex items={t.modules.map(({ id, name }) => ({ id, name }))} label={t.nav.features} />
            <div className={styles.moduleList}>
              {t.modules.map((item, index) => {
                const Icon = item.icon;
                return (
                  <article key={item.id} id={item.id} className={styles.module} data-pet={item.id === "pet" ? "true" : undefined}>
                    {item.id === "pet"
                      ? <div className={styles.visual}><PetPreview lang={lang} /></div>
                      : <div className={styles.visual} aria-hidden="true"><span className={styles.iconBadge}><Icon size={56} weight="light" /></span><span className={styles.visualIndex}>{String(index + 1).padStart(2, "0")}</span></div>}
                    <div className={styles.text}>
                      <span className={styles.moduleName}>{item.name}</span>
                      <h3>{item.title}</h3>
                      <p>{item.body}</p>
                      <ul>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
                      {item.id === "pet" && <div className={styles.downloads}>
                        <a href="/downloads/AlreaDough-Pet-mac.zip" download className={styles.primary}>{t.download.mac}</a>
                        <a href="/downloads/AlreaDough-Pet-windows.zip" download className={styles.primary}>{t.download.win}</a>
                      </div>}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="philosophy" className={styles.philosophy} aria-labelledby="philosophy-title">
          <div className={styles.philosophyInner}>
            <h2 id="philosophy-title">{t.philosophyTitle}</h2>
            <p className={styles.philosophyBody}>{t.philosophyBody}</p>
            <dl>
              {t.principles.map(([name, text]) => <div key={name}><dt>{name}</dt><dd>{text}</dd></div>)}
            </dl>
            <p className={styles.safety}>{t.safety}</p>
          </div>
        </section>

        <section id="pricing" className={styles.pricing} aria-labelledby="pricing-title">
          <div className={styles.sectionHead}>
            <h2 id="pricing-title">{t.pricingTitle}</h2>
            <p>{t.pricingIntro}</p>
          </div>
          <PlanPicker
            initial="deep"
            label={t.pricingTitle}
            items={MEMBER_PLANS.map((plan) => ({
              id: plan.id,
              title: plan.name[lang],
              price: plan.price === 0 ? t.free : <>¥{plan.price}<small> {t.perMonth}</small></>,
              lines: [t.session(plan.session), t.week(plan.week), t.stories(plan.stories), t.planNotes[plan.id]],
            }))}
          />
          <p className={styles.estimate}>{t.estimate}</p>
          <a href={zh ? "/pricing" : "/en/pricing"} className={styles.secondary}>{t.pricingCta}</a>
        </section>

      </main>
      <SiteFooter lang={lang} />
    </div>
  );
}
