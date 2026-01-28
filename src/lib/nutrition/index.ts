import type { ActivityLevel, Goal, Sex } from "@/types";

// BMR - Basal Metabolic Rate using Mifflin-St Jeor formula
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: Sex,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(sex === "male" ? base + 5 : base - 161);
}

// Activity multipliers for TDEE calculation
const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// TDEE - Total Daily Energy Expenditure
export function calculateTDEE(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activity]);
}

// Calculate daily calories based on goal
export function calculateDailyCalories(tdee: number, goal: Goal): number {
  switch (goal) {
    case "lose_fat": {
      const deficit = Math.min(tdee * 0.2, 500);
      return Math.round(tdee - deficit);
    }
    case "maintain":
      return tdee;
    case "gain_muscle":
      return Math.round(tdee * 1.1);
  }
}

// Calculate macronutrients based on calories and goal
export interface MacroTargets {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export function calculateMacros(calories: number, goal: Goal): MacroTargets {
  let proteinPct: number, carbsPct: number, fatPct: number;

  switch (goal) {
    case "lose_fat":
      proteinPct = 0.35;
      carbsPct = 0.35;
      fatPct = 0.3;
      break;
    case "maintain":
      proteinPct = 0.3;
      carbsPct = 0.4;
      fatPct = 0.3;
      break;
    case "gain_muscle":
      proteinPct = 0.3;
      carbsPct = 0.45;
      fatPct = 0.25;
      break;
  }

  return {
    protein_g: Math.round((calories * proteinPct) / 4),
    carbs_g: Math.round((calories * carbsPct) / 4),
    fat_g: Math.round((calories * fatPct) / 9),
  };
}

// BMI calculation
export type BMICategory =
  | "underweight"
  | "normal"
  | "overweight"
  | "obese_1"
  | "obese_2"
  | "obese_3";

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function getBMICategory(bmi: number): BMICategory {
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  if (bmi < 35) return "obese_1";
  if (bmi < 40) return "obese_2";
  return "obese_3";
}

// Calculate calories burned using MET values
export function calculateCaloriesBurned(
  metValue: number,
  weightKg: number,
  durationMinutes: number,
): number {
  const durationHours = durationMinutes / 60;
  return Math.round(metValue * weightKg * durationHours);
}

// Calculate complete nutrition profile
export interface NutritionProfile {
  bmr: number;
  tdee: number;
  dailyCalories: number;
  macros: MacroTargets;
  bmi: number;
  bmiCategory: BMICategory;
}

export function calculateNutritionProfile(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: Sex,
  activity: ActivityLevel,
  goal: Goal,
): NutritionProfile {
  const bmr = calculateBMR(weightKg, heightCm, ageYears, sex);
  const tdee = calculateTDEE(bmr, activity);
  const dailyCalories = calculateDailyCalories(tdee, goal);
  const macros = calculateMacros(dailyCalories, goal);
  const bmi = calculateBMI(weightKg, heightCm);
  const bmiCategory = getBMICategory(bmi);

  return { bmr, tdee, dailyCalories, macros, bmi, bmiCategory };
}

// Get age from birth date
export function getAgeFromBirthDate(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
}
