import Link from "next/link";

export default function CopyrightPage() {
  return (
    <main className="legal-page">
      <Link href="/" className="legal-brand">Already</Link>
      <article>
        <p className="eyebrow">CONTENT &amp; COPYRIGHT</p>
        <h1>素材与版权说明</h1>
        <p>Already 的愿景板坚持使用真实素材。自动找图只应呈现许可允许相应使用的来源，并展示作者、原始页面和许可信息。图片版权仍属于原作者；图片出现在搜索结果或愿景板中不代表作者为 Already 或用户背书。</p>
        <h2>授权素材</h2>
        <p>使用自动找图时，请保留页面展示的作者与来源信息。许可可能随来源或具体素材变化；在广告、商品、公开社交内容或其他商业场景发布前，应重新查看原始页面的最新许可与限制。</p>
        <h2>用户上传</h2>
        <p>你可以上传自己拍摄、已获授权，或仅在法律允许的私人范围内使用的图片与音频。上传功能不会自动把第三方作品变成可商用素材。未经允许，请勿把他人的作品用于广告、转售、公开模板或商业宣传。</p>
        <h2>本机处理</h2>
        <p>自制愿景板和声音练习在当前版本中于浏览器本机处理。保存到本机、排版或混音可以减少平台对素材的再传播，但不会消除原作品可能存在的版权、肖像权、商标或隐私权问题。</p>
        <hr />
        <p className="legal-en">Already uses real imagery for vision boards. Licensed search should display the creator, source page, and license, but copyright remains with the creator and licenses may vary by asset. Uploading, arranging, saving, or privately mixing a third-party work does not make it commercially reusable. Re-check the original license before publishing, advertising, reselling, or using an asset commercially.</p>
      </article>
    </main>
  );
}
