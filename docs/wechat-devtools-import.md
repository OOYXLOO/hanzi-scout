# WeChat DevTools Import Checklist

This checklist prepares Hanzi Scout for an owner-side WeChat DevTools import without committing account state, AppID, ad unit ids, or owner-only platform console settings.

## Files To Use

- `game.js`: native mini game entry.
- `game.json`: portrait runtime settings.
- `project.config.example.json`: safe template for DevTools import.
- `src/canvas-shell.js`: DOM-free Canvas/touch shell.
- `src/wechat-adapter.js`: storage, share, rewarded video, interstitial, and readiness boundary.

## Owner-Side Import Steps

1. Copy `project.config.example.json` to `project.config.json`.
2. Replace `appid: "touristappid"` with the owner-controlled Mini Game AppID inside WeChat DevTools.
3. Open the repository root as a mini game project.
4. Run the simulator and confirm the start screen, touch input, timer, share payload, local storage, and revive flow.
5. Keep real ad unit ids outside Git, for example through a local ignored `ad-unit.config.js` or DevTools-only configuration.
6. Run `npm run audit:wechat` after any entry or adapter change.

## Do Not Commit

- Real AppID.
- Real rewarded or interstitial ad unit ids.
- WeChat account data.
- Owner-only console, entity, or review data.
- Private DevTools settings.

The repository `.gitignore` intentionally excludes `project.config.json`, `project.private.config.json`, and `ad-unit.config.js`.

## Expected Preflight

```bash
npm run check
npm test
npm run audit:local
npm run audit:wechat
```

`npm run audit:wechat` should keep `game.js` and `game.json` as `entry-ready`, `project.config.example.json` as `template-ready`, and real owner/account/ad settings as user-gated.
