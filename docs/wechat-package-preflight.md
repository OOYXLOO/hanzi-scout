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

## Must Be Rewritten For Native WeChat

- `index.html`: replaced by WeChat mini game entry files.
- `src/main.js`: DOM rendering and click handlers must become a Canvas/touch loop.
- `src/styles.css`: browser CSS must become canvas layout constants.

## Planned Package Files

- `game.js`: canvas shell and main loop.
- `game.json`: mini game orientation/runtime settings.
- `project.config.json`: created in WeChat DevTools after AppID exists.
- `ad-unit.config.js`: injected outside public source when real ad units exist.

## Gates

These stay outside autonomous local work:

- WeChat developer account.
- Mini game AppID.
- Traffic owner eligibility.
- Rewarded and interstitial ad units.
- Content category, privacy, review, entity, and owner-only account settings.

The public source must keep real AppID, ad unit ids, account data, and platform settings out of Git.
