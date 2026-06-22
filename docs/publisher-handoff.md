# Hanzi Scout Publisher Handoff

This handoff keeps the browser preview, native mini game boundary, and owner-side publishing gates in one reviewable place.

## Current Public Build
- Browser preview: https://ooyxloo.github.io/hanzi-scout/
- Source repository: https://github.com/OOYXLOO/hanzi-scout
- Native entry: `game.js` and `game.json`
- Safe DevTools template: `project.config.example.json`

## Release Evidence
| File | Status | Bytes |
| --- | --- | ---: |
| `src/levels.js` | ready | 3037 |
| `src/game.js` | ready | 6353 |
| `src/profile.js` | ready | 5549 |
| `src/wechat-adapter.js` | ready | 3527 |
| `src/canvas-shell.js` | ready | 15897 |
| `src/main.js` | ready | 10867 |
| `src/styles.css` | ready | 5425 |
| `index.html` | ready | 3629 |
| `game.js` | ready | 4282 |
| `game.json` | ready | 192 |
| `project.config.example.json` | ready | 216 |
| `README.md` | ready | 3455 |
| `docs/wechat-port-plan.md` | ready | 3033 |
| `docs/wechat-devtools-import.md` | ready | 1667 |

## Package Boundary
Reusable runtime modules:
- `src/levels.js`
- `src/game.js`
- `src/profile.js`
- `src/wechat-adapter.js`
- `src/canvas-shell.js`

Browser-only surfaces that stay out of the native canvas runtime:
- `src/main.js`: DOM event binding and element rendering must become a Canvas/touch shell.
- `src/styles.css`: CSS layout does not run in the native mini game canvas runtime.
- `index.html`: The WeChat mini game entrypoint is game.js, not an HTML document.

Planned package files:
- `game.js`: entry-ready - Create the platform canvas, import the canvas shell, wire WeChat touch events, and start the frame loop.
- `game.json`: entry-ready - Declare orientation and mini game runtime settings.
- `project.config.json`: user-gated - Created in WeChat DevTools after the owner supplies AppID and project settings.
- `project.config.example.json`: template-ready - Safe import template using touristappid; copy locally before owner-side AppID configuration.
- `ad-unit.config.js`: user-gated - Inject real ad unit ids outside the public source tree.

## Owner-Side Batch Gates
- WeChat developer account
- Mini game AppID
- Traffic owner eligibility
- Rewarded and interstitial ad units
- Content category, privacy, review, entity, and owner-only account settings

## Verification Commands
```bash
npm run check
npm test
npm run audit:local
npm run audit:wechat
```

## Publisher Notes
- Import with the safe template first, then replace owner-only project settings inside WeChat DevTools.
- Keep real AppID values, ad unit ids, and platform console settings out of the public repository.
- Validate rewarded assists on device before any public release candidate.
