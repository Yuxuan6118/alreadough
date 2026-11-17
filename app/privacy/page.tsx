import { SITE_RECORD } from "@/lib/site-info";
import SiteFooter from "../components/SiteFooter";

export default function PrivacyPage() {
  return (
    <><main className="legal-page">
      <a href="/" className="legal-brand">AlreaDough</a>
      <article>
        <p><a href="#english" lang="en">Read in English</a></p>
        <p className="eyebrow">PRIVACY</p>
        <h1>隐私说明</h1>
        <h2>练习记录与 AI</h2>
        <p>你的空间数据保存在设备上，并由托管服务商备份用于跨设备同步。你的输入及生成回复所需的练习和对话信息会由 AI 服务商处理。测试期间，我们保存 AI 对话和回复评价。经授权人员可为评估和改进服务查阅对话。</p>
        <h2>服务使用</h2>
        <p>我们处理大致地区、设备与语言信息、使用及反馈记录，用于运行和改进服务。访问日志可能包含 IP 地址。提交举报时，我们会处理举报内容及相关回复。</p>
        <h2>媒体与付款</h2>
        <p>普通练习录音和导入的音频保存在设备上。使用自定义声音时，你同意提交的录音会发送给语音服务商以生成声音。使用素材搜索时，搜索词会发送给素材服务商。</p>
        <p>预约时，我们记录你选择的套餐、联系方式和所在国家，用于预约和通知。付款功能开放时，支付服务商处理付款信息，我们保留办理订阅所需的记录。</p>
        <h2>数据保留与删除</h2>
        <p>在「我的空间」清除练习数据时，你可以同时清除同步备份和测试对话。自定义声音可在声音设置中单独删除。</p>
        <p>预约联系方式用于管理预约和发送开放通知，你可以发邮件申请删除。付费开放后，订阅与付款记录按管理订阅、对账、处理付款争议及履行适用义务所需保留。</p>
        <h2>隐私联系渠道</h2>
        <p>服务以 AlreaDough 名义运营。如有隐私问题或要申请删除预约联系方式，请联系<a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a>。</p>
        <h2>你的选择</h2>
        <p>你可以在「我的空间」导出练习数据。</p>
        <hr />
        <section id="english" lang="en" aria-labelledby="english-title">
          <h2 id="english-title">Privacy Notice</h2>
          <p className="legal-en"><strong>Practice data and AI.</strong> Your space is saved on your device and backed up through a hosting provider for syncing. AI providers process your input and the practice and conversation context needed to generate a reply. During the beta, we retain AI conversations and reply ratings. Authorized personnel may review conversations to evaluate and improve the service.</p>
          <p className="legal-en"><strong>Service use.</strong> We process approximate location, device and language information, usage records, and feedback to operate and improve the service. Access logs may contain IP addresses. If you submit a report, we process it and the related reply.</p>
          <p className="legal-en"><strong>Media and payments.</strong> Regular practice recordings and imported audio are saved on your device. When you opt to create a custom voice, the recording you submit is sent to a voice provider for that purpose. Media search sends search terms to media providers.</p>
          <p className="legal-en">If you reserve a plan, we record your selection, contact information, and country to manage your reservation and notify you. When payments are available, a payment provider processes payment information. We retain records needed to manage subscriptions.</p>
          <p className="legal-en"><strong>Retention and deletion.</strong> When clearing practice data in My Space, you can also clear synced backups and beta conversations. Delete custom voices separately from the voice settings. We retain reservation contact details to manage reservations and send launch notices. Once payments are available, we retain subscription and payment records as needed to manage subscriptions, reconcile transactions, handle payment disputes, and comply with applicable obligations.</p>
          <p className="legal-en"><strong>Your choices.</strong> You can export practice data in My Space.</p>
          <p className="legal-en"><strong>Privacy contact.</strong> The service operates under the name AlreaDough. For privacy questions or to request deletion of your reservation contact details, email <a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a>.</p>
          <p><a href="/en">Back to the English homepage</a></p>
        </section>
      </article>
    </main><SiteFooter /></>
  );
}
