import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="legal-brand">AlreaDough</Link>
      <article>
        <p className="eyebrow">PRIVACY</p>
        <h1>隐私说明</h1>
        <p>AlreaDough 当前测试版会把你的愿望卡、练习记录和愿景板条目保存在你的设备上，同时自动备份一份到服务器，这样你才能在手机和电脑之间同步（见下面的“跨设备同步”）。与 AI 对话时，应用只会发送生成回复所需的当前愿望摘要、近期对话和你主动输入的内容。内测期间，你与 AI 的对话（你发送的内容、AI 的回复和你对回复的评价）会另外保存在服务端，创始人会阅读这些对话，用于评估和改进 AlreaDough，这份供阅读的对话记录不包含你的愿望卡和昵称。同时会记录你的大致地区（国家、地区或城市）、设备类型（手机/电脑、系统、浏览器）、语言和使用情况（打开次数、聊天天数、点评）（我们的数据库不记录 IP 地址；托管服务商 Cloudflare 的访问日志可能短期包含 IP）。如需删除，请联系创始人。</p>
        <h2>跨设备同步</h2>
        <p>你的“空间”包括愿望卡、其他愿望、对话与重写记录、故事库、打卡记录、愿景板条目，以及你在“自我觉察”里写下的回答。它会自动保存到我们的服务器（托管在 Cloudflare），用同步码关联到这台设备。同步码就是打开这份空间的钥匙，任何拿到同步码的人都能打开它，所以请不要告诉别人。创始人的后台页面不展示这部分内容。你在“我的空间”里点击清除，会同时删除服务器上的这份备份。录音和你上传的音频不会同步，只保留在这台设备上。</p>
        <h2>自我觉察</h2>
        <p>“自我觉察”里重复出现的词，是在你的设备上统计的，不会发送给 AI。你写下的回答会作为空间的一部分被保存和同步，规则同上。</p>
        <h2>预约与付款</h2>
        <p>你在定价页点击“保留创始价格”时，我们会保存你选择的套餐和周期、你留下的联系方式（邮箱或微信号）和你所在的国家，仅用于在开放时通知你，并帮我们了解大家想要什么。目前不收款，也不会收集银行卡号。如果将来开放付款，付款会由第三方支付服务商（例如 Stripe）处理，我们不会看到或保存你的银行卡号，只会记录你当前的套餐和到期时间。如需删除你留下的联系方式，请联系创始人。</p>
        <h2>录音与上传</h2>
        <p>麦克风只在你主动开始录音后使用。录音和上传的音频在当前版本中于设备端播放与混合，保存在当前浏览器的本机存储中，不会发送给 AI。你可以在制作台移除音轨；清除浏览器的网站数据也会删除本机音频。</p>
        <h2>图片与第三方服务</h2>
        <p>授权图片搜索会向第三方图片服务发送搜索词，并显示图片来源、作者和许可信息。AI 回复由配置的模型服务生成，该服务可能按照其政策处理请求数据。</p>
        <h2>你的选择</h2>
        <p>你可以在“我的空间”中修改愿望资料、导出结构化练习数据，或清除本机和服务器上的记录。导出文件不包含愿景图片和音频本体。正式公开测试前，本页会补充运营主体、联系邮箱、数据保留期限和账户删除方式。</p>
        <hr />
        <p className="legal-en">AlreaDough keeps your desire cards, practice history, and vision-board entries on your device and also backs them up automatically to our server, so your space can sync between phone and computer (see Cross-device sync below). AI requests include the limited context needed to generate your response. Microphone access begins only when you choose to record. During this beta, your conversations with the AI (what you send, the replies, and your ratings) are additionally saved on the server and read by the founder to evaluate and improve AlreaDough; that reading copy does not include your desire card or nickname. We also record approximate location (country, region, or city), device type (phone or computer, OS, browser), language, and usage (visits, chat days, ratings) (our database does not record your IP address; our hosting provider, Cloudflare, may keep IPs in short-lived access logs). Contact the founder to have these deleted.</p>
        <p className="legal-en"><strong>Cross-device sync.</strong> Your space (desire cards, other desires, conversations and rewrites, story library, check-ins, vision-board entries, and the answers you write in Self-reflection) is saved to our server, hosted on Cloudflare, and tied to this device by a sync code. The sync code is the key to the space: anyone who has it can open it, so do not share it. The founder dashboard does not display this content. Choosing Clear in My Space also deletes the server copy. Recordings and audio you upload are not synced and stay on this device.</p>
        <p className="legal-en"><strong>Self-reflection.</strong> The repeated-word summary is computed on your device and is not sent to the AI. Your answers are saved and synced as part of your space, as above.</p>
        <p className="legal-en"><strong>Reservations and payment.</strong> When you tap Reserve on the pricing page, we save the plan and billing period you chose, the contact you leave (email or WeChat), and your country, only to notify you when payment opens and to understand what people want. We do not take payment or collect card numbers today. If payment opens later, it will be handled by a third-party payment provider such as Stripe; we will not see or store your card number, only your current plan and its end date. Contact the founder to have your contact removed.</p>
        <p className="legal-en">Before public release, this notice will be completed with operator contact details, retention periods, and account-deletion instructions.</p>
      </article>
    </main>
  );
}
