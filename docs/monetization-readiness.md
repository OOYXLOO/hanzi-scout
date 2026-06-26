# Hanzi Scout Monetization Readiness Pack

This pack summarizes the ad touchpoints, replay loops, and owner-side evidence still needed before a WeChat mini game release candidate.

## Public Review Targets
- Browser preview: https://ooyxloo.github.io/hanzi-scout/
- Source repository: https://github.com/OOYXLOO/hanzi-scout
- WeChat package preflight: ready

## Ad Touchpoint Matrix
| Touchpoint | Player trigger | Responsible reward pacing | Current evidence |
| --- | --- | --- | --- |
| hint assist | Player requests one glyph-location clue while a round is active. | Maximum two uses per run through `canUseReward(state, "hint")`. | `grantHint` records the assist and `createRewardedVideoAd` gates the reward in WeChat mode. |
| extra-time assist | Player asks for more time before the run is complete. | Maximum one use per run, adding a short time extension only after completion. | `grantExtraTime` refuses inactive or already-complete runs and shares the rewarded-video boundary. |
| timeout revive | Timer expires before all six rounds are solved. | Maximum one revive per run; it resumes play for 15 seconds after completion. | `pauseForRevive`, `canOfferRevive`, and `grantRevive` keep revive state explicit and testable. |
| completion interstitial | Later completed-round surfaces may show a lightweight interstitial. | Optional and skipped when no real interstitial unit exists. | `showInterstitial` reports skipped WeChat state instead of blocking score recording. |

## Retention & Share Loop
| Loop | Evidence |
| --- | --- |
| daily deterministic challenge | A fixed daily seed creates the same board for share comparison without server data. |
| daily target and streak memory | Local profile state tracks best score, streak, play count, and recent history. |
| share payload | `createSharePayload` carries `day`, `score`, `solved`, and `from` query fields. |
| simulated leaderboard pressure | Seeded rival rows show repeat-play pressure without reading a real social graph. |

## Responsible Reward Pacing
- Rewarded assists are optional and never required to record a completed run.
- Browser preview uses simulated completion for testing; WeChat mode requires a completed rewarded-video close event.
- Missing rewarded or interstitial ad units are reported as skipped boundaries, not treated as successful rewards.
- Real AppID values and ad unit ids stay outside the public repository.

## Owner-Side Evidence Checklist
- Confirm WeChat developer account.
- Confirm Mini game AppID.
- Confirm Traffic owner eligibility.
- Confirm Rewarded and interstitial ad units.
- Confirm Content category, privacy, review, entity, and owner-only account settings.
- Capture one device run showing hint assist, extra-time assist, timeout revive, completion, and share payload.
- Confirm ad unit ids stay outside the public repository and are injected only through owner-side configuration.
- Re-run the verification commands after replacing the safe DevTools template with private project settings.

## Verification Commands
```bash
npm run check
npm test
npm run audit:local
npm run audit:wechat
```
