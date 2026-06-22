# WeChat Package Preflight

Hanzi Scout is still a browser prototype. This preflight defines the smallest safe path toward a WeChat mini game package without adding account state, AppID, ad unit ids, or platform settings to this repository.

## Command

```bash
npm run audit:wechat
```

The command prints a deterministic package plan and fails if the migration boundaries are missing.

## Reusable Modules

- `src/levels.js`: daily seed, board generation, and glyph pair selection.
- `src/game.js`: timer, scoring, hints, extra time, revive, and summary logic.
- `src/profile.js`: local record and simulated leaderboard logic, with storage injected by adapter.
- `src/wechat-adapter.js`: WeChat storage, share, rewarded video, interstitial, and readiness boundary.
- `src/canvas-shell.js`: DOM-free Canvas/touch shell with layout, hit testing, action handling, drawing, and adapter calls.

## Must Be Rewritten For Native WeChat

- `index.html`: replaced by WeChat mini game entry files.
- `src/main.js`: DOM rendering and click handlers stay browser-only; the native path should use `src/canvas-shell.js`.
- `src/styles.css`: browser CSS must become canvas layout constants.

## Planned Package Files

- `game.js`: small WeChat entrypoint that creates the platform canvas, imports `src/canvas-shell.js`, and binds touch/tick events.
- `game.json`: mini game orientation/runtime settings.
- `project.config.example.json`: safe DevTools import template with `appid` set to `touristappid`.
- `project.config.json`: created in WeChat DevTools after AppID exists.
- `ad-unit.config.js`: injected outside public source when real ad units exist.

## DevTools Import

Use `docs/wechat-devtools-import.md` for the owner-side import checklist. Copy `project.config.example.json` to an ignored local `project.config.json`, then replace the template AppID inside WeChat DevTools. Do not commit real owner-only project settings.

## Gates

These stay outside autonomous local work:

- WeChat developer account.
- Mini game AppID.
- Traffic owner eligibility.
- Rewarded and interstitial ad units.
- Content category, privacy, review, entity, and owner-only account settings.

The public source must keep real AppID, ad unit ids, account data, and platform settings out of Git.
