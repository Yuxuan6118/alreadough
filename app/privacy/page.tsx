import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="legal-brand">AlreaDough</Link>
      <article>
        <p className="eyebrow">PRIVACY</p>
        <h1>隐私说明</h1>
        <p>AlreaDough 公开测试版会先在你的设备上保存愿望卡、练习记录、录音配置和愿景板项目。登录后，愿望资料、记忆、对话、故事和练习记录也会同步到按账户隔离的云端空间。与 AI 对话时，应用只发送生成回复所需的当前愿望摘要、近期对话和你主动输入的内容。</p>
        <h2>录音与上传</h2>
        <p>麦克风只在你主动开始录音后使用。录音和上传的音频在当前版本中于设备端播放与混合，保存在当前浏览器的本机存储中，不会发送给 AI。你可以在制作台移除音轨；清除浏览器的网站数据也会删除本机音频。</p>
        <h2>图片与第三方服务</h2>
        <p>授权图片搜索会向第三方图片服务发送搜索词，并显示图片来源、作者和许可信息。AI 回复由配置的模型服务生成，该服务可能按照其政策处理请求数据。</p>
        <h2>匿名测试统计</h2>
        <p>登录用户的页面可见使用时长、AI 请求次数、Token 用量、功能类别、Coach、界面语言和主动提交的评分会以匿名标识记录。创始人驾驶舱只展示汇总结果，不提供愿望原文、聊天、人名、照片或录音的查看入口；少于三次的分类样本不会单独展示。</p>
        <h2>你的选择</h2>
        <p>你可以在“我的空间”中修改资料、导出结构化练习数据，或使用“清除我的数据”删除当前账户的云端空间及本机记录。导出文件不包含愿景图片和音频本体。音频和用户上传的图片仍保存在当前浏览器本机。</p>
        <hr />
        <p className="legal-en">AlreaDough stores an on-device copy of your space and, after sign-in, syncs structured practice data to an account-isolated cloud space. Microphone access begins only when you choose to record; local audio and uploaded images are not included in cloud sync. Anonymous beta analytics include visible active time, AI usage, feature category, Coach, language, and ratings you choose to submit. The founder dashboard displays aggregates only and has no raw desire, chat, name, photo, or recording viewer. You can export or delete your structured data from My Space.</p>
      </article>
    </main>
  );
}
