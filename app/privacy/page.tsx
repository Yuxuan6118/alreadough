import { SITE_RECORD } from "@/lib/site-info";
import SiteFooter from "../components/SiteFooter";
import Link from "next/link";

export default function PrivacyPage() {
  return (
    <><main className="legal-page">
      <Link href="/" className="legal-brand">AlreaDough</Link>
      <article>
        <p><a href="#english" lang="en">Read in English</a></p>
        <p className="eyebrow">PRIVACY</p>
        <h1>隐私说明</h1>
        <p>最后更新：2026 年 11 月 20 日</p>
        <h2>服务使用</h2>
        <p>我们处理大致地区（国家、地区和城市）、时区、设备、操作系统、浏览器与语言信息，以及使用和反馈记录，用于运行和改进服务。访问日志可能包含 IP 地址。提交举报时，我们会处理举报内容及相关回复。</p>
        <h2 id="conversations">练习记录、对话与 AI</h2>
        <p>你的空间数据保存在设备上，并由托管服务商备份用于跨设备同步。你的输入及生成回复所需的练习和对话信息会由 AI 服务商处理。</p>
        <p>测试期间，你和 AI 的对话（你的输入、AI 的回复和最近几条上下文）也会保存在我们的服务器上，用于排查问题、处理举报、保障安全和改进回复质量。AlreaDough 团队的少数成员可以查看这些记录和同步备份中的对话，查看时以随机编号区分用户，不显示你的邮箱。我们只在上述目的所需的期间内保留这些记录；你可以随时在“我的空间”清除，并选择把服务器上的对话记录和同步备份一并删除。</p>
        <p>请不要在对话中输入密码、支付卡号、证件号码，或你无权分享的他人信息。</p>
        <h2 id="voice">声音信息</h2>
        <p>普通练习录音、导入的音频和你逐句朗读的录音只保存在你的设备上。</p>
        <p>定制声音来自你提交的声音样本，可能属于生物识别信息或敏感个人信息。我们只在你单独勾选同意后处理它，目的仅是生成你的定制声音。声音样本发送给语音服务商（阿里云百炼）生成声音后，不在我们的服务器上保存；我们只保存声音编号和你同意的时间。你删除定制声音或注销账户时，我们会删除声音编号，并删除语音服务商处的对应声音；在任何情况下，最长不超过你最后一次使用定制声音后 3 年。我们不出售、不出租、不交换你的声音信息。</p>
        <h2 id="providers">我们使用的服务商与数据所在地</h2>
        <p>为提供服务，我们会把完成相应功能所需的信息交给以下服务商处理：</p>
        <ul>
          <li><strong>Cloudflare：</strong>网站托管、数据库与同步备份。</li>
          <li><strong>阿里云百炼（中国大陆）：</strong>AI 对话与生成内容、语音合成、定制声音。</li>
          <li><strong>Supabase、Google：</strong>邮箱验证码登录、Google 账号登录。</li>
          <li><strong>Resend：</strong>发送验证码、通知和来信邮件。</li>
          <li><strong>支付宝（经 ZPay）、Waffo：</strong>处理付款。我们不接触你的完整卡号或支付密码。</li>
          <li><strong>Openverse、Freesound、Unsplash、Pexels：</strong>素材搜索时接收你的搜索词。</li>
        </ul>
        <p>因此，你的信息可能在你所在国家或地区以外处理，包括中国大陆和美国。我们只向服务商提供完成相应功能所需的信息，并要求其按适用法律保护这些信息。</p>
        <h2>付款与预约</h2>
        <p>预约时，我们记录你选择的套餐、联系方式和所在国家，用于预约和通知。支付服务商处理付款信息，我们保留办理会员所需的订单记录。</p>
        <h2 id="email">邮件</h2>
        <p>你用邮箱登录或订阅后，我们会发送验证码等账户邮件；订阅后还会发送产品通知和创始人来信。每封非账户邮件都可以一键退订，退订不影响验证码等账户邮件。</p>
        <h2 id="storage">本地存储与 Cookie</h2>
        <p>我们使用必要的 Cookie 保持你的登录状态，并在浏览器本地存储（localStorage、IndexedDB）中保存你的设置、练习内容、生成过的语音和你朗读的录音，让它们在这台设备上可以离线使用、不必重复生成。我们不使用这些技术做广告追踪。清除浏览器的网站数据会删除这些本地内容。</p>
        <h2>数据保留与删除</h2>
        <p>在“我的空间”清除练习数据时，你可以同时清除同步备份和服务器上的对话记录。定制声音可在声音设置中单独删除。</p>
        <p>预约联系方式用于管理预约和发送开放通知，你可以发邮件申请删除。订单与付款记录按管理会员、对账、处理付款争议及履行法定义务所需保留。</p>
        <h2 id="rights">你的权利</h2>
        <p>你可以查阅、更正、导出和删除你的个人信息，撤回你此前给出的同意，或注销账户。导出和清除练习数据可在“我的空间”完成；其他请求（包括注销账户）请发邮件至<a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a>，我们会在核实身份后 15 个工作日内处理。撤回同意不影响撤回前已进行的处理。</p>
        <h2>未成年人</h2>
        <p>AlreaDough 仅面向年满 18 周岁的用户。我们发现未满 18 周岁的人提供了个人信息时，会删除相关信息并停用账户。</p>
        <h2>本说明的更新</h2>
        <p>我们可能更新本说明。重大变更会在生效前通过应用内通知或邮件告诉你，并更新页面顶部的日期。</p>
        <h2>隐私联系渠道</h2>
        <p>服务以 AlreaDough 名义运营。如有隐私问题或要行使上述权利，请联系<a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a>。</p>
        <hr />
        <section id="english" lang="en" aria-labelledby="english-title">
          <h2 id="english-title">Privacy Notice</h2>
          <p className="legal-en">Last updated: November 20, 2026</p>
          <p className="legal-en"><strong>Service use.</strong> We process approximate location (country, region, and city), time zone, device, operating system, browser and language information, plus usage records and feedback, to operate and improve the service. Access logs may contain IP addresses. If you submit a report, we process it and the related reply.</p>
          <p className="legal-en"><strong>Practice data, conversations and AI.</strong> Your space is saved on your device and backed up through a hosting provider for syncing. AI providers process your input and the practice and conversation context needed to generate a reply. During the beta, your conversations with the AI (your input, the AI&apos;s reply, and the last few messages of context) are also stored on our servers to troubleshoot, handle reports, keep people safe, and improve replies. A small number of AlreaDough team members can view these records and the conversations in synced backups; users are shown by a random ID, not by email. We keep these records only as long as those purposes require, and you can clear them at any time in My Space, choosing to delete the server-side conversation records and synced backup too. Please do not enter passwords, card numbers, ID numbers, or other people&apos;s information you have no right to share.</p>
          <p className="legal-en"><strong>Voice information.</strong> Regular practice recordings, imported audio, and the lines you read aloud yourself stay on your device. A custom voice is created from a voice sample you submit, which may be biometric or sensitive personal information. We process it only after you give separate consent, and only to create your custom voice. The sample is sent to a voice provider (Alibaba Cloud Model Studio) and is not kept on our servers; we keep only the voice ID and when you consented. When you delete the custom voice or close your account, we delete the voice ID and the matching voice at the provider, and in any case no later than 3 years after you last used the custom voice. We do not sell, rent, or trade your voice information.</p>
          <p className="legal-en"><strong>Service providers and where data is processed.</strong> We share what each feature needs with: Cloudflare (hosting, database, sync backup); Alibaba Cloud Model Studio, mainland China (AI conversation and generated content, speech, custom voices); Supabase and Google (email code and Google sign-in); Resend (account, notice and letter emails); Alipay via ZPay, and Waffo (payments; we never see your full card number or payment password); Openverse, Freesound, Unsplash and Pexels (they receive your media search terms). Your information may therefore be processed outside your country or region, including in mainland China and the United States. We give providers only what the feature needs and require them to protect it under applicable law.</p>
          <p className="legal-en"><strong>Payments and reservations.</strong> If you reserve a plan, we record your selection, contact information, and country to manage your reservation and notify you. Payment providers process payment information; we keep the order records needed to manage memberships.</p>
          <p className="legal-en"><strong>Email.</strong> When you sign in with email or subscribe, we send account emails such as sign-in codes; subscribers also receive product notices and letters from the founder. Every non-account email has a one-click unsubscribe, which does not stop account emails.</p>
          <p className="legal-en"><strong>Local storage and cookies.</strong> We use necessary cookies to keep you signed in, and browser storage (localStorage, IndexedDB) to keep your settings, practice content, generated speech, and your own readings on this device so they work offline and are not generated twice. We do not use them for advertising or tracking. Clearing the site&apos;s data in your browser removes them.</p>
          <p className="legal-en"><strong>Retention and deletion.</strong> When clearing practice data in My Space, you can also clear synced backups and server-side conversation records. Delete custom voices separately from the voice settings. We retain reservation contact details to manage reservations and send launch notices; you can email us to have them deleted. We retain order and payment records as needed to manage memberships, reconcile transactions, handle payment disputes, and meet legal obligations.</p>
          <p className="legal-en"><strong>Your rights.</strong> You can access, correct, export, and delete your personal information, withdraw consent you gave earlier, or close your account. Export and clearing are in My Space; for anything else, including closing your account, email <a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a> and we will act within 15 business days of verifying your identity. Withdrawing consent does not affect processing that happened before.</p>
          <p className="legal-en"><strong>Minors.</strong> AlreaDough is only for people 18 and over. If we learn that someone under 18 has given us personal information, we delete it and close the account.</p>
          <p className="legal-en"><strong>Changes.</strong> We may update this notice. We tell you about material changes in the app or by email before they take effect and update the date at the top.</p>
          <p className="legal-en"><strong>Privacy contact.</strong> The service operates under the name AlreaDough. For privacy questions or to exercise these rights, email <a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a>.</p>
          <p><a href="/en">Back to the English homepage</a></p>
        </section>
      </article>
    </main><SiteFooter /></>
  );
}
