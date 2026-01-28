// User types
export type Sex = "male" | "female";
export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";
export type Goal = "lose_fat" | "maintain" | "gain_muscle";
export type MealType =
  | "breakfast"
  | "morning_snack"
  | "lunch"
  | "afternoon_snack"
  | "dinner";

export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  birth_date?: string;
  sex?: Sex;
  height_cm?: number;
  current_weight_kg?: number;
  target_weight_kg?: number;
  activity_level?: ActivityLevel;
  goal?: Goal;
  bmr?: number;
  tdee?: number;
  daily_calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  created_at: string;
  updated_at: string;
}

// Menu types
export interface Recipe {
  id: string;
  name: string;
  description?: string;
  instructions?: string[];
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g?: number;
  tags?: string[];
  image_url?: string;
  source?: string;
}

export interface Meal {
  id: string;
  menu_id: string;
  user_id: string;
  date: string;
  meal_type: MealType;
  recipe_id?: string;
  recipe?: Recipe;
  completed: boolean;
  completed_at?: string;
  notes?: string;
}

export interface WeeklyMenu {
  id: string;
  user_id: string;
  week_start: string;
  generated_at: string;
  meals: Meal[];
}

// Weight tracking
export interface WeightEntry {
  id: string;
  user_id: string;
  weight_kg: number;
  date: string;
  notes?: string;
  created_at: string;
}

// Streaks and achievements
export type StreakType = "daily_plan" | "weight_log" | "exercise";

export interface Streak {
  id: string;
  user_id: string;
  type: StreakType;
  current_count: number;
  longest_count: number;
  last_active_date?: string;
}

export interface Achievement {
  id: string;
  name: string;
  description?: string;
  icon: string;
  condition: string;
  points: number;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  achievement?: Achievement;
  unlocked_at: string;
}

// Exercise types
export interface Exercise {
  id: string;
  name: string;
  name_es: string;
  description?: string;
  muscle_group: string;
  equipment?: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  demo_url?: string;
  met_value: number;
  instructions?: string[];
  tips?: string[];
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  routine_id?: string;
  started_at: string;
  completed_at?: string;
  notes?: string;
  total_calories_burned?: number;
}

// Chat types
export interface ChatMessage {
  id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// Shopping types
export interface ShoppingItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  checked: boolean;
}

export interface PriceComparison {
  supermarket: string;
  price: number;
  price_per_unit: number;
  url?: string;
}

// Re-export NutritionProfile from nutrition module
export type {
  NutritionProfile,
  MacroTargets,
  BMICategory,
} from "@/lib/nutrition";
