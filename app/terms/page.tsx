import { SITE_RECORD } from "@/lib/site-info";
import SiteFooter from "../components/SiteFooter";

export default function TermsPage() {
  return (
    <><main className="legal-page">
      <a href="/" className="legal-brand">AlreaDough</a>
      <article>
        <p><a href="#english" lang="en">Read in English</a></p>
        <p className="eyebrow">TERMS OF SERVICE</p>
        <h1>服务条款</h1>
        <p>本条款适用于 AlreaDough 提供的服务。AlreaDough 目前处于内测阶段。个人信息如何处理见《隐私说明》。</p>
        <h2>适用年龄与服务性质</h2>
        <p>测试版仅面向年满 18 岁的用户。AlreaDough 提供 AI 对话、想象练习、故事、Revision、声音练习与愿景板工具，不提供医疗、心理治疗、法律、财务或危机服务，也不承诺任何特定外部结果或发生时间。</p>
        <h2>用户内容与现实行为</h2>
        <p>你保留自己输入、录制和上传内容中依法享有的权利，并确认有权使用这些内容。不得利用 AlreaDough 实施违法、侵权、跟踪、骚扰、冒充、强迫、泄露隐私或伤害行为。AI 对愿望的支持不等于对任何现实手段的授权。</p>
        <h2 id="prohibited-content">禁止内容</h2>
        <p>无论是你输入、录制、上传的内容（包括用于生成定制声音的录音），还是你要求 AI 生成的内容，都不得包含以下类别：</p>
        <ul>
          <li><strong>色情或 NSFW 内容：</strong>露骨的性描写、色情内容，以及以性满足为目的的内容。</li>
          <li><strong>暴力或血腥内容：</strong>美化、宣扬或煽动暴力的内容，详细描写血腥、虐待或酷刑的内容，以及威胁他人的内容。</li>
          <li><strong>仇恨或歧视内容：</strong>基于种族、民族、国籍、宗教、性别、性取向、性别认同、残障、年龄或其他受保护特征，攻击、贬低、骚扰或煽动排斥他人的内容。</li>
          <li><strong>涉及未成年人的内容：</strong>任何将未满 18 岁的人性化的内容，以及诱导、引诱或危害未成年人的内容。</li>
        </ul>
        <p><strong>对儿童性剥削与性虐待内容（CSAM）零容忍。</strong>任何描绘、宣扬或请求儿童性剥削的内容，一经发现立即删除，相关账户永久封禁，并依法向有关机构报告，例如美国国家失踪与受虐儿童中心（NCMEC）及执法部门。</p>
        <p>你也不得上传未经本人同意的他人声音、图像或个人信息，用于生成定制声音或任何内容。系统会拒绝生成上述内容，但无法拦截所有情况。违反本条的内容将按下文“举报与处理”进行处理。</p>
        <h2>AI 与可用性</h2>
        <p>AI 可能出现错误、遗漏或不合适的表达。测试期间，功能可能调整，服务可能暂时中断。重要决定不应只依赖模型输出。有关允许的用途及违法请求的处理方式，见<a href="/trust">AI 与安全说明</a>。</p>
        <h2 id="reporting">举报与处理</h2>
        <p><strong>如何举报：</strong>每条 AI 回复下方都有“举报”按钮，“我的空间”中也有“举报内容或反馈问题”入口。你也可以发邮件至<a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a>，说明相关内容和原因。</p>
        <p><strong>处理流程：</strong>举报提交后进入待处理队列，由 AlreaDough 团队人工审核。我们会查看被举报的内容及必要的上下文，判断是否违反本条款或<a href="/trust">AI 与安全说明</a>，并记录处理结果。邮件举报会收到处理结果回复。</p>
        <p><strong>处理时限：</strong>涉及未成年人、儿童性剥削，或对人身安全构成紧迫威胁的举报，我们会在收到后 24 小时内处理。其他举报会在 3 个工作日内完成审核。</p>
        <p><strong>处理措施：</strong>根据严重程度和是否重复违规，可能采取以下一项或多项措施：删除相关内容；限制相关功能（例如停用定制声音或上传功能）；暂停账户；永久终止账户；依法向有关机构报告。涉及儿童性剥削的内容一律删除、永久封禁并报告。若被举报的是 AI 生成的不当回复，我们也会据此调整模型的安全设置。</p>
        <p>如对处理结果有异议，可发邮件至上述邮箱申诉，我们会重新审核。</p>
        <h2>价格、计费与取消</h2>
        <p><a href="/pricing">价格页</a>列出轻揉免费档、醒发（¥39/30 天）和丰盛工坊（¥149/30 天）。仅登记开放通知不会扣款或开启续费。</p>
        <p>支付宝会员采用一次性付款，购买后使用 30 天，到期后可手动续购，不会自动扣款。付款入口是否开放以价格页实际显示为准。若日后开通银行卡自动续费，结账前会显示计费周期、续费条件及取消方式。</p>
        <h2>退款</h2>
        <p>免费预约不涉及付款。如发生重复扣费，或已扣款却无法开通所购权益，可发邮件至<a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a>，提供订单号和问题说明。确认重复扣费后退回多扣金额。确认无法交付所购权益后退回该笔费用。其他退款申请按订单情况审核。获批的退款通过原支付渠道退回。本政策不影响你依法享有的权利。</p>
        <h2>联系客服</h2>
        <p>服务以 AlreaDough 名义运营。订阅、扣款或使用问题请联系<a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a>。</p>
        <h2>终止与删除</h2>
        <p>你可以停止使用服务，并在“我的空间”导出或清除练习数据。数据处理和清除范围详见《隐私说明》。</p>
        <p><a href="/privacy">隐私说明</a></p>
        <hr />
        <section id="english" lang="en" aria-labelledby="english-title">
          <h2 id="english-title">Terms of Service</h2>
          <p className="legal-en">AlreaDough is currently a private beta for adults 18 and over. It offers AI conversation, imaginative practice, stories, Revision, audio practice, and vision-board tools. It is not a medical, therapy, legal, financial, or crisis service, and it does not guarantee any outcome or timing. Users must have the right to use uploaded content and may not use the product for unlawful, infringing, coercive, harassing, privacy-invasive, or harmful conduct. You can stop using the service and export or clear your practice data in My Space. See the Privacy Notice for data handling and deletion.</p>
          <p className="legal-en">See <a href="/en/trust">AI &amp; Safety</a> for permitted uses and how requests involving unlawful activity are handled.</p>
          <h3 id="prohibited-content-en">Prohibited content</h3>
          <p className="legal-en">You may not submit, record, or upload (including recordings used to create a custom voice), or ask the AI to generate, content in any of these categories:</p>
          <ul className="legal-en">
            <li><strong>Sexual or NSFW content:</strong> sexually explicit or pornographic material, or content intended for sexual gratification.</li>
            <li><strong>Violent or graphic content:</strong> content that glorifies, promotes, or incites violence; graphic depictions of gore, abuse, or torture; or threats against anyone.</li>
            <li><strong>Hateful or discriminatory content:</strong> content that attacks, demeans, harasses, or promotes exclusion of people based on race, ethnicity, national origin, religion, sex, sexual orientation, gender identity, disability, age, or another protected characteristic.</li>
            <li><strong>Content involving minors:</strong> any content that sexualizes anyone under 18, or that grooms, solicits, or endangers minors.</li>
          </ul>
          <p className="legal-en"><strong>Zero tolerance for child sexual abuse material (CSAM).</strong> Any content that depicts, promotes, or solicits the sexual exploitation of children is removed immediately, the account is permanently banned, and we report it to the relevant authorities as required by law, such as the National Center for Missing &amp; Exploited Children (NCMEC) and law enforcement.</p>
          <p className="legal-en">You also may not upload another person&apos;s voice, image, or personal information without their consent, whether to create a custom voice or for any other content. The system refuses to generate these categories but cannot catch every case. Violations are handled as described under Reporting and enforcement.</p>
          <h3 id="reporting-en">Reporting and enforcement</h3>
          <p className="legal-en"><strong>How to report.</strong> Use the Report button below any AI reply, or &ldquo;Report content or send feedback&rdquo; in My Space. You can also email <a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a> describing the content and why you are reporting it.</p>
          <p className="legal-en"><strong>What happens next.</strong> Each report enters a review queue and is reviewed by a person on the AlreaDough team. We look at the reported content and any context needed to decide whether it breaks these Terms or the <a href="/en/trust">AI &amp; Safety Notice</a>, and we record the outcome. If you reported by email, we reply with the outcome.</p>
          <p className="legal-en"><strong>Response times.</strong> Reports involving minors, child sexual exploitation, or an imminent threat to someone&apos;s safety are handled within 24 hours of receipt. All other reports are reviewed within 3 business days.</p>
          <p className="legal-en"><strong>Enforcement actions.</strong> Depending on severity and whether it has happened before, we may take one or more of these actions: removing the content; restricting features (for example, disabling custom voice or uploads); suspending the account; permanently terminating the account; and reporting to authorities where the law requires. Content involving child sexual exploitation is always removed, the account permanently banned, and the content reported. When the report concerns an inappropriate AI reply, we also use it to adjust the model&apos;s safety settings.</p>
          <p className="legal-en">If you disagree with a decision, email us to appeal and we will review it again.</p>
          <h3>Pricing, billing and cancellation</h3>
          <p className="legal-en">The <a href="/en/pricing">pricing page</a> lists Soft Start (free), Deep Practice (CNY 39 for 30 days), and Dough Atelier (CNY 149 for 30 days). Signing up for a launch notice does not charge you or start a subscription.</p>
          <p className="legal-en">Alipay memberships use a one-time payment for 30 days. You may renew manually; there is no automatic charge. The pricing page shows whether checkout is currently open. If automatically renewing card subscriptions become available, checkout will show the billing period, renewal terms, and how to cancel.</p>
          <h3>Refunds</h3>
          <p className="legal-en">A free reservation involves no payment. Email <a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a> with your order number and a description if you are charged twice or if we cannot provide the access you paid for. After verification, we refund the duplicate amount or the payment for access we could not provide. Other refund requests are reviewed based on the order circumstances. Approved refunds are sent back through the original payment method. Your statutory rights still apply.</p>
          <h3>Contact support</h3>
          <p className="legal-en">The service operates under the name AlreaDough. For subscription, billing, or product support, email <a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a>.</p>
          <p><a href="/privacy#english">Privacy Notice</a></p>
          <p><a href="/en">Back to the English homepage</a></p>
        </section>
      </article>
    </main><SiteFooter /></>
  );
}
