# AlreaDough 内测部署（无登录版 · 自己的 Cloudflare）

目标：把 App 从 OpenAI 托管平台搬到你自己的 Cloudflare Worker，用户点链接直接用、不需要任何账号。
AI 仍然调用 OpenAI API（用你自己的 key），用户不需要 OpenAI 账号。

---

## 已经改好的（代码层）

- 登录解耦：不再依赖 OpenAI 注入的 `oai-authenticated-user-*` 请求头。用户身份 = 浏览器本地生成并保存的一个随机设备 ID（`x-already-session-id`）。换设备/换浏览器不同步——正式账号系统上线后再解决。
- Founder 面板改为密钥保护：访问 `/beta?key=<你的密钥>` 打开一次（密钥存本机），对应服务器环境变量 `BETA_FOUNDER_SECRET`。
- 删除死代码 `app/chatgpt-auth.ts`、`.openai/` 目录、`@openai/sites-vite-plugin`。
- 图片优化降级：没有 Cloudflare Images 付费组件时，直接返回原图（`next.config.ts` `images.unoptimized` + worker 兜底）。
- 部署配置改为标准 `wrangler.jsonc`。

---

## 你需要做的账号准备（浏览器）

### 1. OpenAI API key

1. 打开 <https://platform.openai.com> ，用你现有的账号登录（和 ChatGPT 同一个）。
2. 左下角 **Settings → Billing** → 加一张卡 → 充值 $10–20（或开 Auto recharge）。
3. **Settings → Limits** → 设一个月度上限，例如 $30，防止被刷。
4. **Dashboard → API keys → Create new secret key** → 命名 `alreadough-prod` → 复制那串 `sk-...`。
   **只显示一次，存好；不要发给任何人、不要贴进聊天。** 稍后粘进 Cloudflare。
5. **Dashboard → Models**（或 Playground）确认可用的模型 ID。当前代码默认用的 `gpt-5.6-luna` / `gpt-5.6-terra` 可能是 OpenAI 托管平台的内部代号，在你自己的 key 上不一定能用——记下两个真实模型 ID（一个日常对话用、一个创意/故事用），稍后设成 `OPENAI_CHAT_MODEL` / `OPENAI_CREATIVE_MODEL`。

### 2. Cloudflare 账号

1. 打开 <https://dash.cloudflare.com/sign-up> ，用邮箱 + 密码注册（或 Continue with Google）。
2. 收邮件点验证链接。
3. 暂时不用加任何站点。

### 3. 域名（建议今天买，但不阻塞部署）

- 在 Cloudflare 仪表盘左侧 **Domain Registration → Register Domains**，搜一个 `.com`（约 $10/年）。
- `.com` 在中国大陆无需 ICP 备案即可访问（走 Cloudflare 香港/日本节点，稍慢但能用）。
- 域名激活要几分钟到几小时。**先用免费的 `*.workers.dev` 地址部署上线，域名好了再切。**

---

## 部署步骤（我陪你一步步跑）

在项目目录里：

```bash
# 1. 登录 Cloudflare（会打开浏览器授权）
pnpm dlx wrangler login

# 2. 创建 D1 数据库
pnpm dlx wrangler d1 create alreadough
```

把上一步打印出来的 `database_id` 粘进 `wrangler.jsonc` 里 `REPLACE_WITH_D1_DATABASE_ID` 的位置。

> 建表不用管：App 在第一次请求时会自动 `CREATE TABLE IF NOT EXISTS`（`lib/beta-guard.ts` / `app/api/space/route.ts`）。`drizzle/` 里的迁移是给以后用的。

```bash
# 3. 设置密钥（每条会让你粘贴值，不显示）
pnpm dlx wrangler secret put OPENAI_API_KEY          # 粘 sk-...
pnpm dlx wrangler secret put OPENAI_CHAT_MODEL       # 真实模型 ID
pnpm dlx wrangler secret put OPENAI_CREATIVE_MODEL   # 真实模型 ID
pnpm dlx wrangler secret put BETA_FOUNDER_SECRET     # 自己想一串长随机字符串
pnpm dlx wrangler secret put PEXELS_API_KEY          # 可选，愿景板图片搜索
pnpm dlx wrangler secret put UNSPLASH_ACCESS_KEY     # 可选
pnpm dlx wrangler secret put OPENAI_SEARCH_MODEL     # 可选，图片/音频关键词翻译，默认同 chat

# 4. 构建 + 部署
pnpm build
pnpm dlx wrangler deploy
```

部署完会给一个 `https://alreadough.<你的子域>.workers.dev` 地址。

---

## 部署后自查清单

- [ ] 用手机打开 workers.dev 地址（最好让一个国内朋友也试），能加载
- [ ] 完成 onboarding，能发一条对话并收到 AI 回复
- [ ] 刷新页面，愿望和对话还在（本机 + D1 都存了）
- [ ] 换个浏览器打开是全新的（设备隔离符合预期）
- [ ] 访问 `/beta?key=<BETA_FOUNDER_SECRET>`，能看到驾驶舱数字
- [ ] Cloudflare → Workers → 你的 worker → Logs，聊天时没有报错

---

## 绑定自己的域名（域名激活后）

1. Cloudflare 仪表盘 → 你的 Worker → **Settings → Domains & Routes → Add → Custom Domain** → 填 `app.你的域名.com`（或裸域名）。
2. 更新 `capacitor.config.ts` 里的地址（以后要打包 iOS 时）。
3. 把这个地址发朋友圈/小红书/抖音。

---

## 已知限制（9/10 内测可接受，之后处理）

- 无账号：换设备不同步、设备 ID 可被猜测则数据可被他人读取（随机 UUID，实际很难）。正式版上 Supabase 邮箱登录解决。
- Cloudflare 在大陆无节点，延迟偏高。抱怨多的话迁香港服务器。
- iOS 上架、国内短信验证码：都是几周级别的独立流程，现在就该并行启动申请，不要等。
