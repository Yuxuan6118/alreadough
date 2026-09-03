import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="legal-brand">AlreaDough</Link>
      <article>
        <p className="eyebrow">PRIVACY</p>
        <h1>隐私说明</h1>
        <p>AlreaDough 当前测试版默认将愿望卡、练习记录、录音配置和愿景板项目保存在你的设备上。与 AI 对话时，应用只会发送生成回复所需的当前愿望摘要、近期对话和你主动输入的内容。</p>
        <h2>录音与上传</h2>
        <p>麦克风只在你主动开始录音后使用。录音和上传的音频在当前版本中于设备端播放与混合，保存在当前浏览器的本机存储中，不会发送给 AI。你可以在制作台移除音轨；清除浏览器的网站数据也会删除本机音频。</p>
        <h2>图片与第三方服务</h2>
        <p>授权图片搜索会向第三方图片服务发送搜索词，并显示图片来源、作者和许可信息。AI 回复由配置的模型服务生成，该服务可能按照其政策处理请求数据。</p>
        <h2>你的选择</h2>
        <p>你可以在“我的空间”中修改愿望资料、导出结构化练习数据或清除本机记录。导出文件不包含愿景图片和音频本体。正式公开测试前，本页会补充运营主体、联系邮箱、数据保留期限和账户删除方式。</p>
        <hr />
        <p className="legal-en">AlreaDough stores desire cards, practice history, audio settings, and vision-board items on your device by default. Microphone access begins only when you choose to record. AI requests include the limited context needed to generate your response. Before public release, this notice will be completed with operator contact details, retention periods, and account-deletion instructions.</p>
      </article>
    </main>
  );
}
