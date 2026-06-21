export const GLYPH_PAIRS = [
  { target: "未", decoy: "末", label: "top stroke length" },
  { target: "己", decoy: "已", label: "open lower hook" },
  { target: "日", decoy: "目", label: "middle stroke count" },
  { target: "土", decoy: "士", label: "lower stroke length" },
  { target: "人", decoy: "入", label: "falling stroke direction" },
  { target: "戊", decoy: "戌", label: "inner stroke" },
  { target: "问", decoy: "间", label: "inside glyph" },
  { target: "晴", decoy: "睛", label: "left radical" },
  { target: "拆", decoy: "折", label: "right component" },
  { target: "辨", decoy: "辩", label: "center component" },
  { target: "祇", decoy: "祗", label: "small dot" },
  { target: "候", decoy: "侯", label: "middle vertical" },
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
