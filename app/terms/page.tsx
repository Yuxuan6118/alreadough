import { SITE_RECORD } from "@/lib/site-info";
import SiteFooter from "../components/SiteFooter";
import Link from "next/link";

export default function TermsPage() {
  return (
    <><main className="legal-page">
      <Link href="/" className="legal-brand">AlreaDough</Link>
      <article>
        <p><a href="#english" lang="en">Read in English</a></p>
        <p className="eyebrow">TERMS OF SERVICE</p>
        <h1>服务条款</h1>
        <p>最后更新：2026 年 11 月 20 日</p>
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
        <p>你也不得上传未经本人同意的他人声音、图像或个人信息，用于生成定制声音或任何内容。系统会拒绝生成上述内容，但无法拦截所有情况。违反本条的内容将按下文“举报与处理”进行处理。声音的具体规则见下文“定制声音与声音授权”。</p>
        <h2 id="custom-voice">定制声音与声音授权</h2>
        <p>本节适用于你为生成定制声音而录制、上传或导入的音频（下称“声音样本”），以及由此生成的声音和用它读出的音频（下称“定制声音”）。</p>
        <p><strong>你的保证。</strong>每次提交声音样本，你都向 AlreaDough 保证：</p>
        <ul>
          <li>声音样本是你本人的声音；或者你已取得声音权利人明确的同意，同意范围包括把样本发送给语音服务商生成声音，以及在 AlreaDough 内用该声音朗读内容；</li>
          <li>声音权利人已年满 18 周岁；</li>
          <li>你能够在我们要求时提供上述同意的证明；</li>
          <li>声音样本不含其他人的声音、背景人声或你无权使用的内容。</li>
        </ul>
        <p><strong>使用范围。</strong>定制声音只用于你本人在 AlreaDough 内收听自己的练习内容。你不得用定制声音或它读出的音频冒充他人，不得对外发布、转发、出售，也不得用于欺诈、骚扰、诽谤、色情、误导他人或任何违法用途。由定制声音读出的音频属于人工智能合成内容。</p>
        <p><strong>责任承担。</strong>声音样本的来源、授权和使用由你本人负责。你违反本节，导致任何第三方向 AlreaDough 提出主张、投诉或索赔，或导致有关部门作出处理的，由你自行承担责任，并赔偿 AlreaDough 因此遭受的损失，包括合理的律师费。在法律允许的范围内，AlreaDough 不对你上传的声音样本的合法性及你对定制声音的使用承担责任。</p>
        <p><strong>我们的做法。</strong>提交声音样本前，我们会请你确认上述保证。声音样本只发送给语音服务商用于生成你的定制声音，不用于训练模型，也不向其他用户公开。我们可以要求你提供授权证明；你无法提供，或我们有理由认为样本未经授权时，可以删除相关定制声音、停用你的定制声音功能，并按“举报与处理”采取进一步措施。我们会依法配合有关部门的调查。</p>
        <p><strong>撤回与删除。</strong>你可以随时在声音设置中删除定制声音，删除时我们会同时删除语音服务商处的对应声音。声音权利人撤回同意时，你应立即删除对应的定制声音。</p>
        <p><strong>声音被冒用时。</strong>如果你认为自己的声音在未经同意的情况下被用来生成定制声音，请发邮件至<a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a>，附上能证明你身份的材料和情况说明。我们会在 3 个工作日内处理；核实后会删除相关定制声音，并告诉你处理结果。</p>
        <h2 id="persona">TA 人设</h2>
        <p>TA 是 AI 根据你提供的信息生成的虚构角色，不是任何真实的人，也不代表真实的人的想法、态度或意愿。TA 说的话不能作为任何人真实意愿的证据。</p>
        <p>你导入聊天记录或填写资料时，保证有权使用这些内容；不会借 TA 冒充、联系、骚扰、跟踪或影响任何真实的人；也不会把 TA 生成的内容当作对方本人所说的话对外传播。导入的聊天记录只在生成人设时处理一次，不在我们的服务器上保存。因你提供的内容或你对 TA 的使用引起的任何争议，由你本人负责。</p>
        <p>如果你发现自己越来越难区分 TA 和真实的人，或者使用 TA 让你更痛苦，请暂停使用，并联系身边信任的人或专业人士。</p>
        <h2>AI 与可用性</h2>
        <p>AI 可能出现错误、遗漏或不合适的表达。测试期间，功能可能调整，服务可能暂时中断。重要决定不应只依赖模型输出。有关允许的用途及违法请求的处理方式，见<a href="/trust">AI 与安全说明</a>。</p>
        <p>AlreaDough 不是心理治疗、医疗或危机服务。如果你或他人正处于危险中，请立即联系当地急救电话（例如美国 911 或 988，中国大陆 120 或 12356）。</p>
        <h2 id="ai-content">AI 生成的内容</h2>
        <p>你保留你输入内容中依法享有的权利。在我们享有权利的范围内，AI 根据你的输入生成的剧本、肯定语、对话等内容归你使用。AI 生成的内容可能与其他人得到的内容相似，我们不保证它独有、原创或不侵犯他人权利。你对使用、发布生成内容负责；对外发布时，应注明内容由人工智能生成。</p>
        <h2 id="account">账户与安全</h2>
        <p>请保管好你的邮箱和登录方式，账户下发生的活动由你负责。发现账户被他人使用，请尽快联系我们。出于安全原因，我们可以要求你重新验证身份。</p>
        <h2 id="reporting">举报与处理</h2>
        <p><strong>如何举报：</strong>每条 AI 回复下方都有“举报”按钮，“我的空间”中也有“举报内容或反馈问题”入口。你也可以发邮件至<a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a>，说明相关内容和原因。</p>
        <p><strong>处理流程：</strong>举报提交后进入待处理队列，由 AlreaDough 团队人工审核。我们会查看被举报的内容及必要的上下文，判断是否违反本条款或<a href="/trust">AI 与安全说明</a>，并记录处理结果。邮件举报会收到处理结果回复。</p>
        <p><strong>处理时限：</strong>涉及未成年人、儿童性剥削，或对人身安全构成紧迫威胁的举报，我们会在收到后 24 小时内处理。其他举报会在 3 个工作日内完成审核。</p>
        <p><strong>处理措施：</strong>根据严重程度和是否重复违规，可能采取以下一项或多项措施：删除相关内容；限制相关功能（例如停用定制声音或上传功能）；暂停账户；永久终止账户；依法向有关机构报告。涉及儿童性剥削的内容一律删除、永久封禁并报告。若被举报的是 AI 生成的不当回复，我们也会据此调整模型的安全设置。</p>
        <p>如对处理结果有异议，可发邮件至上述邮箱申诉，我们会重新审核。</p>
        <h2>价格、计费与取消</h2>
        <p><a href="/pricing">价格页</a>列出轻揉免费档、醒发（¥39/30 天）和丰盛工坊（¥149/30 天）。仅登记开放通知不会扣款或开启续费。</p>
        <p>支付宝会员采用一次性付款，购买后使用 30 天，到期后可手动续购，不会自动扣款。付款入口是否开放以价格页实际显示为准。若日后开通银行卡自动续费，结账前会显示计费周期、续费条件及取消方式。</p>
        <h2 id="invitations">邀请码与活动</h2>
        <p>邀请码和活动权益没有现金价值，不能转让、出售或兑换现金。我们可以随时调整或结束活动。发现批量注册、刷码或其他滥用行为时，我们可以收回相关权益并限制账户。</p>
        <h2>退款</h2>
        <p>免费预约不涉及付款。如发生重复扣费，或已扣款却无法开通所购权益，可发邮件至<a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a>，提供订单号和问题说明。确认重复扣费后退回多扣金额。确认无法交付所购权益后退回该笔费用。其他退款申请按订单情况审核。获批的退款通过原支付渠道退回。本政策不影响你依法享有的权利。</p>
        <h2>联系客服</h2>
        <p>服务以 AlreaDough 名义运营。订阅、扣款或使用问题请联系<a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a>。</p>
        <h2>终止与删除</h2>
        <p>你可以停止使用服务，并在“我的空间”导出或清除练习数据，或发邮件申请注销账户。数据处理和清除范围详见《隐私说明》。</p>
        <h2 id="changes-to-service">服务的调整</h2>
        <p>测试期间，我们可以修改、暂停或停止任何功能，包括测试版功能和每日使用额度。重大调整会提前通知。我们停止整个付费服务时，按你会员剩余的天数退款。</p>
        <h2 id="disclaimer">免责与责任限制</h2>
        <p><strong>按现状提供。</strong>AlreaDough 按“现状”和“现有”提供服务。在法律允许的范围内，我们不就服务的准确性、可靠性、持续可用或适合特定目的作出任何明示或默示的保证，也不保证通过练习获得任何特定结果。</p>
        <p><strong>责任限制。</strong>在法律允许的范围内，AlreaDough 不对任何间接、附带、特殊、惩罚性或后果性损失承担责任，包括利润、数据、机会或情感上的损失，也不对你基于 AI 内容作出的决定或采取的行动承担责任。我们对你承担的全部责任，以你在引起责任的事件发生前 12 个月内向我们支付的费用总额为上限；你未付费的，上限为人民币 100 元（或 15 美元）。</p>
        <p><strong>你的赔偿责任。</strong>你违反本条款、侵犯他人权利或违法使用服务，导致任何第三方向 AlreaDough 提出主张、投诉或索赔的，由你负责处理，并赔偿 AlreaDough 因此遭受的损失，包括合理的律师费。</p>
        <p>本节不排除或限制法律不允许排除或限制的责任，例如因故意或重大过失造成的人身伤害。</p>
        <h2 id="changes">条款的修改</h2>
        <p>我们可能修改本条款。重大修改会在生效前至少 7 天通过应用内通知或邮件告诉你，并更新页面顶部的日期。修改生效后你继续使用服务，即表示接受修改后的条款；你不同意的，可以停止使用并申请注销账户。</p>
        <h2 id="general">其他</h2>
        <p>本条款与《隐私说明》《AI 与安全说明》《素材与版权说明》共同构成你与我们之间关于本服务的完整协议。本条款某一条无效或不可执行的，不影响其他条款的效力。我们没有行使某项权利，不代表放弃该权利。我们可以把本条款转让给承继本服务的主体；未经我们同意，你不得转让本条款下的权利和义务。因网络、服务商故障、政府行为、自然灾害等我们无法合理控制的原因导致服务中断的，我们不承担责任。</p>
        <p>桌面宠物等可下载的软件仅许可你个人使用，你不得反向工程、修改后再分发或用于商业用途。</p>
        <p><a href="/privacy">隐私说明</a></p>
        <hr />
        <section id="english" lang="en" aria-labelledby="english-title">
          <h2 id="english-title">Terms of Service</h2>
          <p className="legal-en">Last updated: November 20, 2026</p>
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
          <p className="legal-en">You also may not upload another person&apos;s voice, image, or personal information without their consent, whether to create a custom voice or for any other content. The system refuses to generate these categories but cannot catch every case. Violations are handled as described under Reporting and enforcement. Voice-specific rules are set out under Custom voices and voice permission.</p>
          <h3 id="custom-voice-en">Custom voices and voice permission</h3>
          <p className="legal-en">This section covers audio you record, upload, or import to create a custom voice (a &ldquo;voice sample&rdquo;), and the voice created from it together with any audio it reads aloud (a &ldquo;custom voice&rdquo;).</p>
          <p className="legal-en"><strong>Your promises.</strong> Each time you submit a voice sample, you promise AlreaDough that:</p>
          <ul className="legal-en">
            <li>the sample is your own voice, or the person whose voice it is has given you explicit permission covering sending it to a voice provider to create a voice and using that voice to read content inside AlreaDough;</li>
            <li>that person is 18 or older;</li>
            <li>you can show proof of that permission when we ask; and</li>
            <li>the sample contains no other voices, background speech, or material you have no right to use.</li>
          </ul>
          <p className="legal-en"><strong>Permitted use.</strong> A custom voice is only for you to listen to your own practice content inside AlreaDough. You may not use a custom voice, or audio it reads aloud, to impersonate anyone, and you may not publish, share, or sell it, or use it for fraud, harassment, defamation, sexual content, misleading others, or anything unlawful. Audio read by a custom voice is AI-generated content.</p>
          <p className="legal-en"><strong>Responsibility.</strong> You alone are responsible for where a voice sample comes from, the permission behind it, and how you use the custom voice. If your breach of this section leads to any claim, complaint, or demand against AlreaDough, or to action by an authority, you are responsible for it and will compensate AlreaDough for resulting losses, including reasonable legal fees. To the extent the law allows, AlreaDough is not responsible for the lawfulness of voice samples you submit or for your use of a custom voice.</p>
          <p className="legal-en"><strong>What we do.</strong> Before you submit a voice sample, we ask you to confirm these promises. A sample is sent to a voice provider only to create your custom voice; it is not used to train models and is never shown to other users. We may ask you for proof of permission. If you cannot provide it, or we have reason to believe a sample was submitted without permission, we may delete the custom voice, turn off custom voices for your account, and take further action under Reporting and enforcement. We cooperate with lawful investigations.</p>
          <p className="legal-en"><strong>Withdrawal and deletion.</strong> You can delete a custom voice at any time in the voice settings; we then also delete the matching voice at the voice provider. If the voice&apos;s owner withdraws permission, you must delete that custom voice right away.</p>
          <p className="legal-en"><strong>If your voice was used without permission.</strong> Email <a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a> with proof of identity and a description of what happened. We handle these within 3 business days, delete the custom voice once verified, and tell you the outcome.</p>
          <h3 id="persona-en">TA personas</h3>
          <p className="legal-en">TA is a fictional character generated by AI from information you provide. TA is not any real person and does not represent any real person&apos;s thoughts, attitudes, or wishes, and nothing TA says is evidence of what anyone actually wants. When you import a chat log or fill in details, you promise you have the right to use that content; that you will not use TA to impersonate, contact, harass, track, or influence any real person; and that you will not share TA&apos;s words as if the real person said them. An imported chat log is processed once to build the persona and is not stored on our servers. You are responsible for any dispute arising from what you provide or how you use TA. If you find it harder to tell TA apart from the real person, or using TA makes you feel worse, please pause and reach out to someone you trust or a professional.</p>
          <h3 id="reporting-en">Reporting and enforcement</h3>
          <p className="legal-en"><strong>How to report.</strong> Use the Report button below any AI reply, or &ldquo;Report content or send feedback&rdquo; in My Space. You can also email <a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a> describing the content and why you are reporting it.</p>
          <p className="legal-en"><strong>What happens next.</strong> Each report enters a review queue and is reviewed by a person on the AlreaDough team. We look at the reported content and any context needed to decide whether it breaks these Terms or the <a href="/en/trust">AI &amp; Safety Notice</a>, and we record the outcome. If you reported by email, we reply with the outcome.</p>
          <p className="legal-en"><strong>Response times.</strong> Reports involving minors, child sexual exploitation, or an imminent threat to someone&apos;s safety are handled within 24 hours of receipt. All other reports are reviewed within 3 business days.</p>
          <p className="legal-en"><strong>Enforcement actions.</strong> Depending on severity and whether it has happened before, we may take one or more of these actions: removing the content; restricting features (for example, disabling custom voice or uploads); suspending the account; permanently terminating the account; and reporting to authorities where the law requires. Content involving child sexual exploitation is always removed, the account permanently banned, and the content reported. When the report concerns an inappropriate AI reply, we also use it to adjust the model&apos;s safety settings.</p>
          <p className="legal-en">If you disagree with a decision, email us to appeal and we will review it again.</p>
          <h3 id="ai-content-en">AI-generated content</h3>
          <p className="legal-en">You keep the rights you hold in what you enter. To the extent we hold any rights, stories, affirmations, conversations and other content the AI generates from your input are yours to use. Generated content may resemble what others receive, and we do not promise it is unique, original, or non-infringing. You are responsible for how you use and publish it, and you should label it as AI-generated when you share it publicly. AlreaDough is not a therapy, medical, or crisis service; if you or someone else is in danger, contact local emergency services now (for example 911 or 988 in the US).</p>
          <h3 id="account-en">Your account</h3>
          <p className="legal-en">Keep your email and sign-in method secure; you are responsible for activity under your account. Tell us promptly if someone else is using it. We may ask you to verify your identity again for security.</p>
          <h3>Pricing, billing and cancellation</h3>
          <p className="legal-en">The <a href="/en/pricing">pricing page</a> lists Soft Start (free), Deep Practice (CNY 39 for 30 days), and Dough Atelier (CNY 149 for 30 days). Signing up for a launch notice does not charge you or start a subscription.</p>
          <p className="legal-en">Alipay memberships use a one-time payment for 30 days. You may renew manually; there is no automatic charge. The pricing page shows whether checkout is currently open. If automatically renewing card subscriptions become available, checkout will show the billing period, renewal terms, and how to cancel.</p>
          <h3>Refunds</h3>
          <p className="legal-en">A free reservation involves no payment. Email <a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a> with your order number and a description if you are charged twice or if we cannot provide the access you paid for. After verification, we refund the duplicate amount or the payment for access we could not provide. Other refund requests are reviewed based on the order circumstances. Approved refunds are sent back through the original payment method. Your statutory rights still apply.</p>
          <h3 id="invitations-en">Invitation codes and promotions</h3>
          <p className="legal-en">Invitation codes and promotional benefits have no cash value and cannot be transferred, sold, or exchanged for cash. We may change or end a promotion at any time, and we may withdraw benefits and restrict accounts involved in bulk sign-ups, code farming, or other abuse.</p>
          <h3 id="changes-to-service-en">Changes to the service</h3>
          <p className="legal-en">During the beta we may change, pause, or stop any feature, including beta features and daily limits, with advance notice of significant changes. If we stop the paid service entirely, we refund the unused days of your membership. You can stop using the service, export or clear your data in My Space, or email us to close your account.</p>
          <h3 id="disclaimer-en">Disclaimers and limitation of liability</h3>
          <p className="legal-en"><strong>As is.</strong> AlreaDough is provided &ldquo;as is&rdquo; and &ldquo;as available.&rdquo; To the extent the law allows, we make no express or implied warranties about accuracy, reliability, uninterrupted availability, or fitness for a particular purpose, and we do not promise any particular result from practice.</p>
          <p className="legal-en"><strong>Limitation of liability.</strong> To the extent the law allows, AlreaDough is not liable for any indirect, incidental, special, punitive, or consequential loss, including lost profits, data, opportunities, or emotional loss, or for decisions you make or actions you take based on AI content. Our total liability to you is limited to the amount you paid us in the 12 months before the event giving rise to the liability, or US$15 (CNY 100) if you have not paid.</p>
          <p className="legal-en"><strong>Your indemnity.</strong> If your breach of these Terms, infringement of others&apos; rights, or unlawful use of the service leads to any claim, complaint, or demand against AlreaDough, you are responsible for it and will compensate AlreaDough for resulting losses, including reasonable legal fees.</p>
          <p className="legal-en">Nothing in this section excludes or limits liability that cannot be excluded or limited by law, such as for personal injury caused by intent or gross negligence.</p>
          <h3 id="changes-en">Changes to these Terms</h3>
          <p className="legal-en">We may change these Terms. We give at least 7 days&apos; notice of material changes in the app or by email and update the date at the top. If you keep using the service after a change takes effect, you accept the new Terms; if you do not agree, you can stop using the service and ask us to close your account.</p>
          <h3 id="general-en">General</h3>
          <p className="legal-en">These Terms, together with the Privacy Notice, the AI &amp; Safety Notice, and the Content &amp; Copyright notice, are the entire agreement between you and us about the service. If any part is invalid or unenforceable, the rest still applies. Not exercising a right is not a waiver of it. We may assign these Terms to a successor to the service; you may not assign them without our consent. We are not responsible for interruptions caused by events beyond our reasonable control, such as network or provider failures, government action, or natural disasters. Downloadable software such as the desktop pet is licensed for your personal use only; you may not reverse engineer it, redistribute modified copies, or use it commercially.</p>
          <h3>Contact support</h3>
          <p className="legal-en">The service operates under the name AlreaDough. For subscription, billing, or product support, email <a href={`mailto:${SITE_RECORD.contactEmail}`}>{SITE_RECORD.contactEmail}</a>.</p>
          <p><a href="/privacy#english">Privacy Notice</a></p>
          <p><a href="/en">Back to the English homepage</a></p>
        </section>
      </article>
    </main><SiteFooter /></>
  );
}
