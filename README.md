# Hanzi Scout

Hanzi Scout is a lightweight glyph-spotting puzzle prototype for short mobile sessions. It is designed to validate a simple loop: daily challenge, fast start, limited rewarded assists, local progress, and shareable score payloads.

## Current Build

Public app: https://ooyxloo.github.io/hanzi-scout/

- Deterministic daily seed.
- Six 6x6 rounds, each with one visually different glyph.
- 60-second timer, speed score, miss penalty, and streak bonus.
- Daily target, max-miss limit, and observation prompt.
- Mobile-first quick start before the board.
- Limited rewarded assists: hints, extra time, and one timeout revive.
- Local best score, streak, play count, and recent 14-day history.
- Share payload with `day`, `score`, `solved`, and `from` query values.
- Simulated daily leaderboard generated from the daily seed; no real social graph access.
- Browser mode simulates rewarded completion for local preview.
- WeChat mode only grants rewarded assists after a real rewarded-video completion event.
- `src/canvas-shell.js` provides a DOM-free Canvas/touch shell for the mini game entry.
- The repository does not include real AppID values, ad unit ids, account data, or owner-only platform console settings.

See `docs/public-verification.md` for the current public deployment, source, and check status.

## Local Preview

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:8788/`.

## Quality Checks

```bash
npm test
npm run check
npm run audit:local
npm run audit:wechat
```

## WeChat Mini Game Path

The native mini game entry is already present:

- `game.js`: creates the platform canvas, imports `src/canvas-shell.js`, reads launch query values, binds touch events, and starts the frame loop.
- `game.json`: declares portrait orientation and runtime timeout settings.
- `project.config.example.json`: safe DevTools import template with `appid` set to `touristappid`.
- `docs/wechat-devtools-import.md`: owner-side import checklist.
- `docs/wechat-package-preflight.md`: migration boundary and package plan.

Do not commit a real `project.config.json`, `project.private.config.json`, or `ad-unit.config.js`. Those files may contain owner-only AppID, DevTools settings, or real ad unit ids and are intentionally ignored.

## WeChat Boundary

Current adapter surface: `src/wechat-adapter.js`.

- `wx.createRewardedVideoAd`: used for hints, extra time, and revive; rewards are granted only after completion.
- `wx.createInterstitialAd`: optional lightweight interstitial after later completed rounds; missing ad units are skipped.
- `wx.shareAppMessage`: score sharing.
- `wx.getStorageSync` / `wx.setStorageSync`: local progress storage.
- `readiness`: exposes browser/WeChat environment, ad unit, share, and storage boundaries for preflight checks.
- `npm run audit:wechat`: prints a deterministic package plan and checks reusable logic, browser-only surfaces, entry files, and owner-only gates.

Real release still requires the owner to handle the WeChat developer account, AppID, traffic-owner eligibility, ad units, content category, privacy materials, review, entity verification, and platform console settings.

## Mobile Visual Check

The current mobile smoke pass uses a 390x844 viewport with 2x device scale. It verified no horizontal overflow, a 366px board width, 5 leaderboard rows, and exactly one player row.

- Start screen: `docs/media/mobile-start.png`
- Completed run: `docs/media/mobile-complete.png`
