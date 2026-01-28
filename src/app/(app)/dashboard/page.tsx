"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Flame,
  Droplets,
  Beef,
  Wheat,
  TrendingUp,
  Calendar,
  Target,
  Award,
} from "lucide-react";
import { calculateNutritionProfile } from "@/lib/nutrition";
import type { NutritionProfile } from "@/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { motion } from "framer-motion";

interface DailyProgress {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealsCompleted: number;
  totalMeals: number;
}

interface UserProfile {
  full_name: string | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  goal: string | null;
  sex: string | null;
  birth_date: string | null;
  height_cm: number | null;
  activity_level: string | null;
  daily_calorie_target: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
}

interface Streak {
  type: string;
  current_count: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [nutritionProfile, setNutritionProfile] =
    useState<NutritionProfile | null>(null);
  const [dailyProgress, setDailyProgress] = useState<DailyProgress>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    mealsCompleted: 0,
    totalMeals: 5,
  });
  const [streak, setStreak] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchTodayProgress();
      fetchStreak();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user?.id)
      .single();

    if (data) {
      setProfile(data);

      if (
        data.sex &&
        data.birth_date &&
        data.height_cm &&
        data.current_weight_kg &&
        data.activity_level &&
        data.goal
      ) {
        const age = calculateAge(data.birth_date);
        const calculated = calculateNutritionProfile(
          data.current_weight_kg,
          data.height_cm,
          age,
          data.sex as "male" | "female",
          data.activity_level as
            | "sedentary"
            | "light"
            | "moderate"
            | "active"
            | "very_active",
          data.goal as "lose_fat" | "maintain" | "gain_muscle",
        );
        setNutritionProfile(calculated);
      }
    }
  };

  const fetchTodayProgress = async () => {
    const today = format(new Date(), "yyyy-MM-dd");

    const { data: meals } = await supabase
      .from("meals")
      .select(
        `
        id,
        completed,
        custom_calories,
        custom_protein_g,
        custom_carbs_g,
        custom_fat_g,
        recipes (
          calories,
          protein_g,
          carbs_g,
          fat_g
        )
      `,
      )
      .eq("user_id", user?.id)
      .eq("date", today);

    if (meals) {
      interface RecipeData {
        calories: number;
        protein_g: number;
        carbs_g: number;
        fat_g: number;
      }
      const progress = meals.reduce(
        (acc, meal) => {
          if (meal.completed) {
            acc.mealsCompleted++;
            // Supabase returns joined data - handle both single object and array cases
            const recipeData = meal.recipes as RecipeData | RecipeData[] | null;
            const recipe = Array.isArray(recipeData)
              ? recipeData[0]
              : recipeData;
            acc.calories += meal.custom_calories || recipe?.calories || 0;
            acc.protein += meal.custom_protein_g || recipe?.protein_g || 0;
            acc.carbs += meal.custom_carbs_g || recipe?.carbs_g || 0;
            acc.fat += meal.custom_fat_g || recipe?.fat_g || 0;
          }
          return acc;
        },
        {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          mealsCompleted: 0,
          totalMeals: meals.length || 5,
        },
      );
      setDailyProgress(progress);
    }
  };

  const fetchStreak = async () => {
    const { data } = await supabase
      .from("streaks")
      .select("type, current_count")
      .eq("user_id", user?.id)
      .eq("type", "daily_meals")
      .single();

    if (data) {
      setStreak((data as Streak).current_count);
    }
  };

  const calculateAge = (birthDate: string) => {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age;
  };

  const targets = {
    calories:
      profile?.daily_calorie_target || nutritionProfile?.dailyCalories || 2000,
    protein:
      profile?.protein_target_g || nutritionProfile?.macros.protein_g || 150,
    carbs: profile?.carbs_target_g || nutritionProfile?.macros.carbs_g || 250,
    fat: profile?.fat_target_g || nutritionProfile?.macros.fat_g || 65,
  };

  const getProgressPercent = (current: number, target: number) =>
    Math.min(Math.round((current / target) * 100), 100);

  const getGoalText = (goal: string | null) => {
    switch (goal) {
      case "lose_fat":
        return "Perder grasa";
      case "gain_muscle":
        return "Ganar músculo";
      default:
        return "Mantener peso";
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            {format(new Date(), "EEEE, d MMMM", { locale: es })}
          </p>
          <h1 className="text-2xl font-bold">
            Hola, {profile?.full_name?.split(" ")[0] || "Usuario"}
          </h1>
        </div>
        {streak > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-1 rounded-full bg-orange-500/10 px-3 py-1"
          >
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="font-semibold text-orange-500">{streak}</span>
          </motion.div>
        )}
      </div>

      {/* Goal Card */}
      {profile?.goal && (
        <Card className="gradient-card">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Tu objetivo</p>
              <p className="font-semibold">{getGoalText(profile.goal)}</p>
            </div>
            {profile.current_weight_kg && profile.target_weight_kg && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  {profile.current_weight_kg} → {profile.target_weight_kg} kg
                </p>
                <p className="text-xs text-muted-foreground">
                  {Math.abs(
                    profile.target_weight_kg - profile.current_weight_kg,
                  ).toFixed(1)}{" "}
                  kg restantes
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Calories Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Calorías de hoy
            </span>
            <span className="text-sm font-normal text-muted-foreground">
              {dailyProgress.calories} / {targets.calories} kcal
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress
            value={getProgressPercent(dailyProgress.calories, targets.calories)}
            className="h-3"
          />
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Te quedan {Math.max(0, targets.calories - dailyProgress.calories)}{" "}
            kcal
          </p>
        </CardContent>
      </Card>

      {/* Macros Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Macronutrientes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Protein */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Beef className="h-4 w-4 text-red-500" />
                Proteínas
              </span>
              <span>
                {dailyProgress.protein}g / {targets.protein}g
              </span>
            </div>
            <Progress
              value={getProgressPercent(dailyProgress.protein, targets.protein)}
              className="h-2"
            />
          </div>

          {/* Carbs */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Wheat className="h-4 w-4 text-amber-500" />
                Carbohidratos
              </span>
              <span>
                {dailyProgress.carbs}g / {targets.carbs}g
              </span>
            </div>
            <Progress
              value={getProgressPercent(dailyProgress.carbs, targets.carbs)}
              className="h-2"
            />
          </div>

          {/* Fat */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-blue-500" />
                Grasas
              </span>
              <span>
                {dailyProgress.fat}g / {targets.fat}g
              </span>
            </div>
            <Progress
              value={getProgressPercent(dailyProgress.fat, targets.fat)}
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <Calendar className="mb-2 h-6 w-6 text-primary" />
            <p className="text-2xl font-bold">
              {dailyProgress.mealsCompleted}/{dailyProgress.totalMeals}
            </p>
            <p className="text-xs text-muted-foreground">Comidas de hoy</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col items-center p-4">
            <Award className="mb-2 h-6 w-6 text-yellow-500" />
            <p className="text-2xl font-bold">{streak}</p>
            <p className="text-xs text-muted-foreground">Días de racha</p>
          </CardContent>
        </Card>
      </div>

      {/* BMI Card */}
      {profile?.current_weight_kg && profile?.height_cm && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="font-semibold">IMC</p>
                <p className="text-sm text-muted-foreground">
                  Índice de Masa Corporal
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">
                {(
                  profile.current_weight_kg /
                  Math.pow(profile.height_cm / 100, 2)
                ).toFixed(1)}
              </p>
              <Badge
                variant={
                  profile.current_weight_kg /
                    Math.pow(profile.height_cm / 100, 2) <
                    18.5 ||
                  profile.current_weight_kg /
                    Math.pow(profile.height_cm / 100, 2) >=
                    30
                    ? "destructive"
                    : profile.current_weight_kg /
                          Math.pow(profile.height_cm / 100, 2) <
                        25
                      ? "default"
                      : "secondary"
                }
              >
                {profile.current_weight_kg /
                  Math.pow(profile.height_cm / 100, 2) <
                18.5
                  ? "Bajo peso"
                  : profile.current_weight_kg /
                        Math.pow(profile.height_cm / 100, 2) <
                      25
                    ? "Normal"
                    : profile.current_weight_kg /
                          Math.pow(profile.height_cm / 100, 2) <
                        30
                      ? "Sobrepeso"
                      : "Obesidad"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
