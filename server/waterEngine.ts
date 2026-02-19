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
