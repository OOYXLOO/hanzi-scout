export function createPlatformAdapter({ wxApi = globalThis.wx } = {}) {
  const isWeChat = Boolean(wxApi);
  const rewarded = isWeChat && wxApi.createRewardedVideoAd
    ? wxApi.createRewardedVideoAd({ adUnitId: "REPLACE_WITH_REWARDED_AD_UNIT_ID" })
    : null;
  const interstitial = isWeChat && wxApi.createInterstitialAd
    ? wxApi.createInterstitialAd({ adUnitId: "REPLACE_WITH_INTERSTITIAL_AD_UNIT_ID" })
    : null;

  return {
    isWeChat,
    storage: createStorageAdapter(wxApi),
    async showRewarded(reason) {
      if (!rewarded) {
        await wait(320);
        return { ok: true, simulated: true, reason };
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
        return { ok: false, simulated: true };
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
