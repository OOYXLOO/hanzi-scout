export const GLYPH_PAIRS = [
  { target: "未", decoy: "末", label: "横画长短" },
  { target: "己", decoy: "已", label: "下方开口" },
  { target: "日", decoy: "目", label: "中间笔画数量" },
  { target: "土", decoy: "士", label: "下横长短" },
  { target: "人", decoy: "入", label: "撇捺方向" },
  { target: "戊", decoy: "戌", label: "内部短画" },
  { target: "问", decoy: "间", label: "门内字形" },
  { target: "晴", decoy: "睛", label: "左侧偏旁" },
  { target: "拆", decoy: "折", label: "右侧部件" },
  { target: "辨", decoy: "辩", label: "中间部件" },
  { target: "祇", decoy: "祗", label: "细小点画" },
  { target: "候", decoy: "侯", label: "中间竖画" },
];

function hashSeed(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRandom(seed) {
  let state = hashSeed(seed) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function pick(random, list) {
  return list[Math.floor(random() * list.length) % list.length];
}

export function getDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function normalizeDayKey(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

export function createRound({ dayKey = getDayKey(), index = 0, size = 6 } = {}) {
  const random = createRandom(`${dayKey}:${index}:hanzi-scout`);
  const pair = pick(random, GLYPH_PAIRS);
  const total = size * size;
  const targetIndex = Math.floor(random() * total);
  const cells = Array.from({ length: total }, (_, cellIndex) => ({
    glyph: cellIndex === targetIndex ? pair.target : pair.decoy,
    target: cellIndex === targetIndex,
  }));

  return {
    id: `${dayKey}-${index + 1}`,
    dayKey,
    index,
    size,
    pair,
    targetIndex,
    cells,
    difficulty: 1 + Math.floor(index / 2),
  };
}

export function createRun({ dayKey = getDayKey(), rounds = 6, size = 6 } = {}) {
  return {
    dayKey,
    rounds: Array.from({ length: rounds }, (_, index) => createRound({ dayKey, index, size })),
    timeLimit: 60,
    goal: createDailyGoal({ dayKey, rounds }),
  };
}

export function quadrantForIndex(index, size) {
  const row = Math.floor(index / size);
  const col = index % size;
  const vertical = row < size / 2 ? "upper" : "lower";
  const horizontal = col < size / 2 ? "left" : "right";
  return `${vertical} ${horizontal}`;
}

export function createDailyGoal({ dayKey = getDayKey(), rounds = 6 } = {}) {
  const random = createRandom(`${dayKey}:daily-goal`);
  const targetScore = 760 + Math.floor(random() * 220);
  const maxMisses = 2 + Math.floor(random() * 2);
  const focusPair = pick(random, GLYPH_PAIRS);
  return {
    targetScore,
    maxMisses,
    rounds,
    focus: focusPair.label,
  };
}
