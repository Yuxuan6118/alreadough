# Already iOS 上架准备

当前 `ios/App/App.xcodeproj` 已经是可由 Xcode 打开的 iOS 工程。它共用网页版的功能和响应式界面，并加入了 iOS 安全区、启动页、状态栏、轻触反馈、麦克风说明和照片权限说明。

## 正式测试前

1. 先把网页版发布到一个稳定的 HTTPS 地址。
2. 同步 iOS 工程时提供该地址：

   ```bash
   CAPACITOR_SERVER_URL="https://你的正式域名" pnpm ios:sync
   ```

3. 打开 Xcode：

   ```bash
   pnpm ios:open
   ```

4. 在 Xcode 的 Signing & Capabilities 中选择你的 Apple Developer Team。
5. 在真机上测试 AI、麦克风录音、音频后台行为、照片上传、愿景板和中英文切换。

## App Store Connect 前仍需由创始人提供

- Apple Developer Program 账户与签名团队
- 最终 App 图标、启动画面和 iPhone / iPad 商店截图
- 已公开可访问的隐私政策网址与客服网址
- 订阅方案。如果在 iOS App 内售卖数字会员，需要在后续接入 Apple In-App Purchase
- App 名称、Subtitle、Keywords、Description 与 Review Notes
- AI 数据流、第三方图片服务和分析工具对应的 App Privacy 回答

## 审核风险

Apple 要求应用不能只是重新包装的网站。Already 的提交版本应突出原生价值：设备端录音和多轨播放、触觉回弹、照片选择、设备本地愿望空间、可持续练习记录，以及区别于网页营销页的手机导航。正式提交前需要完成 TestFlight 真机测试，不能只提交远程网页壳。
