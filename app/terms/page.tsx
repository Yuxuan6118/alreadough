import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="legal-brand">AlreaDough</Link>
      <article>
        <p className="eyebrow">PRIVATE BETA · TERMS DRAFT</p>
        <h1>测试版使用条款</h1>
        <p>AlreaDough 当前为私人测试产品。本页用于让测试者在使用前理解产品边界，不构成正式公开发行版本的最终法律条款。正式开放注册或收费前，将补充运营主体、联系地址、适用地区、退款及争议处理信息。</p>
        <h2>适用年龄与服务性质</h2>
        <p>测试版仅面向年满 18 岁的用户。AlreaDough 提供 AI 对话、想象练习、故事、Revision、声音练习与愿景板工具，不提供医疗、心理治疗、法律、财务或危机服务，也不承诺任何特定外部结果或发生时间。</p>
        <h2>用户内容与现实行为</h2>
        <p>你保留自己输入、录制和上传内容中依法享有的权利，并确认有权使用这些内容。不得利用 AlreaDough 实施违法、侵权、跟踪、骚扰、冒充、强迫、泄露隐私或伤害行为。AI 对愿望的支持不等于对任何现实手段的授权。</p>
        <h2>AI 与可用性</h2>
        <p>AI 可能出现错误、遗漏或不合适的表达。私人测试期间，功能、模型、限额与存储方式可能变化，服务也可能暂时中断。重要决定不应只依赖模型输出。</p>
        <h2>终止与删除</h2>
        <p>你可以随时在“我的空间”导出或清除设备上的练习数据。正式账户系统上线后，将另行提供账户删除和云端数据处理机制。</p>
        <hr />
        <p className="legal-en">AlreaDough is currently a private beta for adults 18 and over. It offers AI conversation, imaginative practice, stories, Revision, audio practice, and vision-board tools. It is not a medical, therapy, legal, financial, or crisis service, and it does not guarantee any outcome or timing. Users must have the right to use uploaded content and may not use the product for unlawful, infringing, coercive, harassing, privacy-invasive, or harmful conduct. Final operator, billing, refund, jurisdiction, and contact terms will be added before public release.</p>
      </article>
    </main>
  );
}
