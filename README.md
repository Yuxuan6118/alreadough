# Already

Already 是一个围绕“一个很难相信、却真正想要的愿望”建立的中英文 AI 显化陪练产品。当前版本同时提供响应式网页与 Capacitor iOS 工程。

## 当前体验

- 7 步新用户引导：语言、称呼、愿望分类、愿望焦点、最多 12 条信念触发点、陪伴方式与确认
- 三种原创陪练方法：释放引导、假设法则引导、潜意识引导
- 单一愿望的连续 AI 对话、长期摘要、Revision 与故事记忆
- 可编辑故事库，避免重复创建入口
- 入梦声场：肯定语、录音、上传音轨、多轨音量、环境声、练习计时与打卡
- 真实图片愿景板：授权图库搜索与本机照片拼贴编辑器
- 愿望归档、新愿望开启、结构化数据导出与本机数据清除
- 中英文、桌面侧栏、手机底部导航、PWA 与 iOS 壳

## 数据原则

愿望卡、对话、故事、Revision 和打卡默认保存在当前设备。录音与自选图片存入浏览器本机数据库，不发送给 AI。AI 请求只携带当前愿望需要的有限上下文，服务端密钥不会进入浏览器。

## 本地开发

需要 Node.js 22.13 或更新版本。

```bash
pnpm install
pnpm dev
pnpm test
```

## iOS

将稳定 HTTPS 地址写入 iOS 工程：

```bash
CAPACITOR_SERVER_URL="https://your-hosted-app.example" pnpm ios:sync
pnpm ios:open
```

正式 App Store 流程仍需要 Apple Developer Team 签名、真机与 TestFlight 测试、最终隐私申报、商店素材，以及若销售数字会员则接入 Apple In-App Purchase。
