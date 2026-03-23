const WATER_PER_CUP = 10;

const STAGE_CUP_REQUIREMENTS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 8,
};

export function computeGrowthUpdate(
  currentWaterEvents: number,
  currentCupsFilled: number,
  currentSeedStage: number,
  waterAmount: number
): {
  waterEvents: number;
  cupsFilled: number;
  seedStage: number;
  cupJustFilled: boolean;
  stageAdvanced: boolean;
  preResetFillPercent: number;
} {
  let waterEvents = currentWaterEvents + waterAmount;
  let cupsFilled = currentCupsFilled;
  let seedStage = currentSeedStage;
  let cupJustFilled = false;
  let stageAdvanced = false;
  const preResetFillPercent = Math.round((waterEvents / WATER_PER_CUP) * 100);

  while (waterEvents >= WATER_PER_CUP) {
    waterEvents -= WATER_PER_CUP;
    cupsFilled += 1;
    cupJustFilled = true;

    const nextStage = seedStage + 1;
    const cupsNeeded = STAGE_CUP_REQUIREMENTS[nextStage];
    if (cupsNeeded !== undefined && cupsFilled >= cupsNeeded) {
      seedStage = nextStage;
      stageAdvanced = true;
    }
  }

  return { waterEvents, cupsFilled, seedStage, cupJustFilled, stageAdvanced, preResetFillPercent };
}

export const SEED_STAGE_INFO: Record<number, { name: string; description: string }> = {
  0: { name: "Dormant Seed", description: "Seed intact, fully underground" },
  1: { name: "Germination", description: "Seed cracks open, slight internal glow" },
  2: { name: "Primary Root", description: "One visible root extends downward" },
  3: { name: "Root Expansion", description: "Root network becomes visible underground" },
  4: { name: "Soil Pressure", description: "Soil mounds upward, energy building" },
  5: { name: "Sprout Emergence", description: "Green sprout breaks through soil" },
  6: { name: "Early Plant", description: "Stem strengthens, first leaves form" },
};

export const CUP_IDENTITY_STATEMENTS: Record<number, string> = {
  25: "I STARTED",
  50: "I CAN'T QUIT NOW",
  75: "I'M FINISHING THIS",
  100: "I FOLLOW THROUGH",
};

// ─── Momentum Boost constants (first targeted goal only) ────────────────────
// 40% reduction: 10 → 6 entries to fill first cup
export const BOOST_FIRST_CUP_THRESHOLD = 6;
// 30% reduction: 10 → 7 entries to trigger Germination stage
export const BOOST_GERMINATION_THRESHOLD = 7;

/**
 * computeGrowthStateWithBoost — same as computeGrowthStateFromEntries but
 * applies the First Goal Momentum Boost for the user's first targeted goal.
 *
 * Boost thresholds:
 *   - First cup fills at 6 entries (instead of 10)  — 40% reduction
 *   - Germination stage triggers at 7 entries         — 30% reduction
 * After the first cup fills (entry ≥ 6), normal economy resumes for all
 * subsequent cups and stages.  Identity goals are never boosted.
 */
export function computeGrowthStateWithBoost(entryCount: number): {
  waterEvents: number;
  cupsFilled: number;
  seedStage: number;
  fillPercent: number;
} {
  if (entryCount < BOOST_FIRST_CUP_THRESHOLD) {
    // Boost active: fill bar accelerated toward first cup
    return {
      waterEvents: entryCount,
      cupsFilled: 0,
      seedStage: 0,
      fillPercent: Math.min(100, Math.round((entryCount / BOOST_FIRST_CUP_THRESHOLD) * 100)),
    };
  }

  // First cup filled — normal economy resumes for subsequent cups.
  const extraEntries = entryCount - BOOST_FIRST_CUP_THRESHOLD;
  const cupsFromExtra = Math.floor(extraEntries / WATER_PER_CUP);
  const cupsFilled = 1 + cupsFromExtra;
  const withinCup = extraEntries % WATER_PER_CUP;
  const fillPercent = Math.min(100, Math.round(withinCup * (100 / WATER_PER_CUP)));

  // Germination triggers at BOOST_GERMINATION_THRESHOLD; higher stages use
  // normal STAGE_CUP_REQUIREMENTS against the actual cupsFilled count.
  let seedStage = entryCount >= BOOST_GERMINATION_THRESHOLD ? 1 : 0;
  for (const [stage, cupsNeeded] of Object.entries(STAGE_CUP_REQUIREMENTS)) {
    const stageNum = Number(stage);
    if (stageNum > 1 && cupsFilled >= cupsNeeded) {
      seedStage = Math.max(seedStage, stageNum);
    }
  }

  return { waterEvents: entryCount, cupsFilled, seedStage, fillPercent };
}

/**
 * computeGrowthStateFromEntries — derives growth state from happy entry count.
 *
 * Each verified action (happy entry) = 1 water unit for display purposes.
 * This keeps the Growth Dashboard in sync with the same entry-based source
 * the Home screen uses, instead of relying on the AP-threshold accumulation
 * in the goals table (which only increments every 10 AP = ~4 VAs).
 *
 * The AP-based reward engine continues to write to goals.actionPoints /
 * goals.waterEvents for celebration logic and deduplication — those fields
 * are NOT changed. This function is for DISPLAY aggregation only.
 */
export function computeGrowthStateFromEntries(entryCount: number): {
  waterEvents: number;
  cupsFilled: number;
  seedStage: number;
  fillPercent: number;
} {
  const waterEvents = entryCount;
  let cupsFilled = 0;
  let seedStage = 0;

  const fullCups = Math.floor(waterEvents / WATER_PER_CUP);
  for (let cup = 1; cup <= fullCups; cup++) {
    cupsFilled = cup;
    for (const [stage, cupsNeeded] of Object.entries(STAGE_CUP_REQUIREMENTS)) {
      const stageNum = Number(stage);
      if (stageNum > seedStage && cupsFilled >= cupsNeeded) {
        seedStage = stageNum;
      }
    }
  }

  const withinCup = waterEvents % WATER_PER_CUP;
  const fillPercent = Math.min(100, Math.round(withinCup * (100 / WATER_PER_CUP)));

  return { waterEvents, cupsFilled, seedStage, fillPercent };
}
