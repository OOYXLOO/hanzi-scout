const PROFILE_KEY = "hanzi-scout-profile-v1";

export function createEmptyProfile() {
  return {
    bestScore: 0,
    bestDay: null,
    bestSolved: 0,
    lastPlayedDay: null,
    streak: 0,
    plays: 0,
    completions: 0,
    totalScore: 0,
    rewardViews: {
      hint: 0,
      extraTime: 0,
    },
    history: [],
  };
}

export function loadProfile({ storage = globalThis.localStorage } = {}) {
  if (!storage) return createEmptyProfile();
  try {
    const raw = storage.getItem(PROFILE_KEY);
    if (!raw) return createEmptyProfile();
    return normalizeProfile(JSON.parse(raw));
  } catch {
    return createEmptyProfile();
  }
}

export function saveProfile(profile, { storage = globalThis.localStorage } = {}) {
  if (!storage) return false;
  try {
    storage.setItem(PROFILE_KEY, JSON.stringify(normalizeProfile(profile)));
    return true;
  } catch {
    return false;
  }
}

export function recordRun(profile, summary) {
  const next = normalizeProfile(profile);
  const existingIndex = next.history.findIndex((entry) => entry.dayKey === summary.dayKey);
  const previousForDay = existingIndex === -1 ? null : next.history[existingIndex];
  const bestForDay = !previousForDay || summary.score > previousForDay.score ? compactSummary(summary) : previousForDay;

  if (existingIndex === -1) {
    next.history.unshift(bestForDay);
  } else {
    next.history[existingIndex] = bestForDay;
  }

  next.history = next.history
    .sort((a, b) => b.dayKey.localeCompare(a.dayKey))
    .slice(0, 14);

  next.plays += 1;
  next.totalScore += summary.score;
  if (summary.cleared) next.completions += 1;
  next.rewardViews.hint += summary.rewardUses?.hint || 0;
  next.rewardViews.extraTime += summary.rewardUses?.extraTime || 0;

  if (summary.score > next.bestScore) {
    next.bestScore = summary.score;
    next.bestDay = summary.dayKey;
    next.bestSolved = summary.solved;
  }

  if (summary.solved > 0 && next.lastPlayedDay !== summary.dayKey) {
    next.streak = isNextDay(next.lastPlayedDay, summary.dayKey) ? next.streak + 1 : 1;
    next.lastPlayedDay = summary.dayKey;
  }

  return next;
}

export function createScoreCard(profile, summary) {
  const next = normalizeProfile(profile);
  const clearRate = next.plays ? Math.round((next.completions / next.plays) * 100) : 0;
  return {
    headline: summary.goalMet ? "Daily goal cleared" : summary.cleared ? "Board cleared" : "Run logged",
    details: `${summary.solved}/${summary.total} boards · ${summary.score} pts · ${summary.misses} misses`,
    record: `Best ${next.bestScore} on ${next.bestDay || summary.dayKey} · streak ${next.streak} day${next.streak === 1 ? "" : "s"} · clear ${clearRate}%`,
  };
}

function compactSummary(summary) {
  return {
    dayKey: summary.dayKey,
    score: summary.score,
    solved: summary.solved,
    total: summary.total,
    cleared: summary.cleared,
    misses: summary.misses,
    goalMet: summary.goalMet,
  };
}

function normalizeProfile(value) {
  const base = createEmptyProfile();
  const profile = { ...base, ...(value && typeof value === "object" ? value : {}) };
  profile.rewardViews = { ...base.rewardViews, ...(profile.rewardViews || {}) };
  profile.history = Array.isArray(profile.history) ? profile.history.slice(0, 14) : [];
  profile.bestScore = Number.isFinite(profile.bestScore) ? profile.bestScore : 0;
  profile.bestSolved = Number.isFinite(profile.bestSolved) ? profile.bestSolved : 0;
  profile.streak = Number.isFinite(profile.streak) ? profile.streak : 0;
  profile.plays = Number.isFinite(profile.plays) ? profile.plays : 0;
  profile.completions = Number.isFinite(profile.completions) ? profile.completions : 0;
  profile.totalScore = Number.isFinite(profile.totalScore) ? profile.totalScore : 0;
  return profile;
}

function isNextDay(previousDay, currentDay) {
  if (!previousDay) return false;
  const previous = Date.parse(`${previousDay}T00:00:00.000Z`);
  const current = Date.parse(`${currentDay}T00:00:00.000Z`);
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return false;
  return current - previous === 86_400_000;
}
