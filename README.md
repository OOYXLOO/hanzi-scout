# Hanzi Scout

Hanzi Scout 是一个轻量汉字找不同小游戏原型，目标是验证“短局挑战、每日目标、分享成绩、有限激励帮助”的移动小游戏体验。

## 当前版本

- 每日 deterministic seed。
- 6 轮 6x6 汉字棋盘，每轮只有 1 个不同字。
- 60 秒倒计时、速度分、错点扣分、连击加分。
- 每日目标：目标分数、最大错点次数、今日观察点。
- 移动端棋盘前快速开始按钮，避免首屏只看到未启动棋盘。
- 激励帮助限制：每局最多 2 次提示、1 次加时、1 次超时复活。
- 本地记录：最佳分、连续挑战天数、游玩局数、近 14 天历史。
- 分享成绩文本。
- 离线模拟好友榜：用每日种子生成固定对手，验证分享和再来一局循环，不读取真实微信好友数据。
- 浏览器模式模拟激励完成；微信环境通过适配边界替换为平台 API。
- 微信环境缺少真实广告位时不会发放激励奖励，避免审核包或灰度包误把占位配置当成可变现配置。
- `src/canvas-shell.js` 提供无 DOM 的 Canvas/touch 壳：包含移动布局、棋盘命中测试、按钮动作、绘制循环和平台适配调用，可作为微信小游戏入口的基础。
- 仓库不包含生产凭证、广告位 id、账号数据或平台后台配置。

## Mobile visual check

The current mobile smoke pass uses a 390x844 viewport with 2x device scale. It verified no horizontal overflow, a 366px board width, 5 leaderboard rows, and exactly one player row.

- Start screen: `docs/media/mobile-start.png`
- Completed run: `docs/media/mobile-complete.png`

## 命令

```bash
npm test
npm run check
npm run audit:local
npm run audit:wechat
npm run dev
```

`npm run dev` 会在 `http://127.0.0.1:8788/` 启动本地预览。

## 微信边界

当前适配层在 `src/wechat-adapter.js`：

- `wx.createRewardedVideoAd`：提示、加时、超时复活；只有真实广告位存在且完整观看后才发放。
- `wx.createInterstitialAd`：从第二局开始的一局结束后轻量间隙展示，避免首局强打断；缺广告位时直接跳过。
- `wx.shareAppMessage`：成绩分享。
- `wx.getStorageSync` / `wx.setStorageSync`：迁移本地记录。
- `readiness`：暴露浏览器/微信环境、广告位、分享、存储边界，方便之后打包前检查。
- `npm run audit:wechat`：输出微信小游戏包结构预演，确认 Canvas 壳无 DOM 依赖，并区分可复用逻辑、必须重写的 DOM/CSS 表面和用户 gate。

真正的小程序版本需要在微信开发者工具内处理 AppID、广告位、类目、隐私、审核材料和发布流程。
