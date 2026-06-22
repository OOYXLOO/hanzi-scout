export function createPlatformAdapter({ wxApi = globalThis.wx, adUnits = readAdUnitConfig(globalThis) } = {}) {
  const isWeChat = Boolean(wxApi);
  const rewardedAdUnitId = normalizeAdUnitId(adUnits.rewarded);
  const interstitialAdUnitId = normalizeAdUnitId(adUnits.interstitial);
  const rewarded = isWeChat && wxApi.createRewardedVideoAd && rewardedAdUnitId
    ? wxApi.createRewardedVideoAd({ adUnitId: rewardedAdUnitId })
    : null;
  const interstitial = isWeChat && wxApi.createInterstitialAd && interstitialAdUnitId
    ? wxApi.createInterstitialAd({ adUnitId: interstitialAdUnitId })
    : null;

  return {
    isWeChat,
    readiness: {
      environment: isWeChat ? "wechat" : "browser",
      rewardedAdReady: !isWeChat || Boolean(rewarded),
      interstitialAdReady: !isWeChat || Boolean(interstitial),
      shareReady: Boolean(isWeChat && wxApi.shareAppMessage),
      storageReady: Boolean(createStorageAdapter(wxApi)),
    },
    storage: createStorageAdapter(wxApi),
    async showRewarded(reason) {
      if (!rewarded) {
        if (!isWeChat) {
          await wait(320);
          return { ok: true, simulated: true, reason };
        }
        return { ok: false, simulated: false, reason, skipped: true, error: "missing-rewarded-ad-unit" };
      }
      return new Promise((resolve) => {
        const onClose = (res) => {
          rewarded.offClose(onClose);
          resolve({ ok: Boolean(res?.isEnded), simulated: false, reason });
        };
        rewarded.onClose(onClose);
        rewarded.show().catch(() => rewarded.load().then(() => rewarded.show()).catch(() => {
          rewarded.offClose(onClose);
          resolve({ ok: false, simulated: false, reason });
        }));
      });
    },
    async showInterstitial() {
      if (!interstitial) {
        return { ok: false, simulated: !isWeChat, skipped: isWeChat, error: isWeChat ? "missing-interstitial-ad-unit" : undefined };
      }
      try {
        await interstitial.show();
        return { ok: true, simulated: false };
      } catch {
        return { ok: false, simulated: false };
      }
    },
    share(text) {
      if (isWeChat && wxApi.shareAppMessage) {
        wxApi.shareAppMessage({ title: text });
        return true;
      }
      return false;
    },
  };
}

function readAdUnitConfig(scope) {
  return {
    rewarded: scope?.__HANZI_SCOUT_CONFIG__?.adUnits?.rewarded || "",
    interstitial: scope?.__HANZI_SCOUT_CONFIG__?.adUnits?.interstitial || "",
  };
}

function normalizeAdUnitId(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("REPLACE_WITH_")) return "";
  return trimmed;
}

function createStorageAdapter(wxApi) {
  if (wxApi?.getStorageSync && wxApi?.setStorageSync) {
    return {
      getItem(key) {
        const value = wxApi.getStorageSync(key);
        return value || null;
      },
      setItem(key, value) {
        wxApi.setStorageSync(key, value);
      },
    };
  }
  return globalThis.localStorage || null;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
