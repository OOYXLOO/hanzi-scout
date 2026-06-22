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
      revive: 0,
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
  next.rewardViews.revive += summary.rewardUses?.revive || 0;

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

export function createFriendLeaderboard(profile, summary, { names = ["小林", "Mia", "阿澈", "Noah"] } = {}) {
  const next = normalizeProfile(profile);
  const dayKey = summary?.dayKey || next.lastPlayedDay || next.bestDay || "daily";
  const playerScore = Number(summary?.score || dailyHistory(next, dayKey)?.score || next.bestScore || 0);
  const playerSolved = Number(summary?.solved || dailyHistory(next, dayKey)?.solved || next.bestSolved || 0);
  const entries = names.map((name, index) => {
    const seed = hash(`${dayKey}:${name}:${index}`);
    const solved = Math.min(6, 3 + (seed % 4));
    const score = 420 + (seed % 360) + solved * 38 + index * 11;
    return {
      name,
      score,
      solved,
      isPlayer: false,
    };
  });

  entries.push({
    name: "你",
    score: playerScore,
    solved: playerSolved,
    isPlayer: true,
  });

  return entries
    .sort((a, b) => b.score - a.score || b.solved - a.solved || a.name.localeCompare(b.name))
    .slice(0, 5)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
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

function dailyHistory(profile, dayKey) {
  return profile.history.find((entry) => entry.dayKey === dayKey) || null;
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

function hash(input) {
  let value = 2166136261;
  for (const char of String(input)) {
    value ^= char.codePointAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function isNextDay(previousDay, currentDay) {
  if (!previousDay) return false;
  const previous = Date.parse(`${previousDay}T00:00:00.000Z`);
  const current = Date.parse(`${currentDay}T00:00:00.000Z`);
  if (!Number.isFinite(previous) || !Number.isFinite(current)) return false;
  return current - previous === 86_400_000;
}
