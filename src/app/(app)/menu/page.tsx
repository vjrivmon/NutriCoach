"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Check,
  Plus,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Apple,
  UtensilsCrossed,
  Cookie,
  Moon,
  Sparkles,
  Loader2,
} from "lucide-react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface Meal {
  id: string;
  date: string;
  meal_type: string;
  completed: boolean;
  custom_name: string | null;
  custom_calories: number | null;
  recipes: {
    id: string;
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    image_url: string | null;
  } | null;
}

interface Recipe {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  image_url: string | null;
}

const mealTypes = [
  { id: "breakfast", label: "Desayuno", icon: Coffee, time: "07:00" },
  { id: "mid_morning", label: "Media mañana", icon: Apple, time: "10:30" },
  { id: "lunch", label: "Almuerzo", icon: UtensilsCrossed, time: "14:00" },
  { id: "snack", label: "Merienda", icon: Cookie, time: "17:30" },
  { id: "dinner", label: "Cena", icon: Moon, time: "21:00" },
];

export default function MenuPage() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [meals, setMeals] = useState<Meal[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchMeals();
      fetchRecipes();
    }
  }, [user, selectedDate]);

  const fetchMeals = async () => {
    setLoading(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    const { data } = await supabase
      .from("meals")
      .select(
        `
        id,
        date,
        meal_type,
        completed,
        custom_name,
        custom_calories,
        recipes (
          id,
          name,
          calories,
          protein_g,
          carbs_g,
          fat_g,
          image_url
        )
      `,
      )
      .eq("user_id", user?.id)
      .eq("date", dateStr)
      .order("meal_type");

    if (data) {
      // Handle Supabase join that may return array for foreign key relation
      const processedMeals = data.map((meal) => {
        const recipesData = meal.recipes as
          | Meal["recipes"]
          | Meal["recipes"][]
          | null;
        const recipe = Array.isArray(recipesData)
          ? recipesData[0]
          : recipesData;
        return {
          ...meal,
          recipes: recipe || null,
        };
      });
      setMeals(processedMeals as Meal[]);
    }
    setLoading(false);
  };

  const fetchRecipes = async () => {
    const { data } = await supabase
      .from("recipes")
      .select("id, name, calories, protein_g, carbs_g, fat_g, image_url")
      .or(`user_id.eq.${user?.id},is_public.eq.true`)
      .limit(50);

    if (data) {
      setRecipes(data);
    }
  };

  const toggleMealComplete = async (mealId: string, completed: boolean) => {
    const { error } = await supabase
      .from("meals")
      .update({
        completed: !completed,
        completed_at: !completed ? new Date().toISOString() : null,
      })
      .eq("id", mealId);

    if (error) {
      toast.error("Error al actualizar la comida");
    } else {
      setMeals((prev) =>
        prev.map((m) =>
          m.id === mealId ? { ...m, completed: !completed } : m,
        ),
      );

      if (!completed) {
        toast.success("¡Comida completada!", {
          description: "Sigue así, vas genial 💪",
        });
      }
    }
  };

  const addMealToDay = async (mealType: string, recipeId: string) => {
    const dateStr = format(selectedDate, "yyyy-MM-dd");

    const { error } = await supabase.from("meals").insert({
      user_id: user?.id,
      date: dateStr,
      meal_type: mealType,
      recipe_id: recipeId,
    });

    if (error) {
      toast.error("Error al añadir la comida");
    } else {
      toast.success("Comida añadida");
      fetchMeals();
      setSelectedMealType(null);
    }
  };

  const generateWeeklyMenu = async () => {
    setGenerating(true);
    try {
      const response = await fetch("/api/menu/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weekStart: format(weekStart, "yyyy-MM-dd"),
        }),
      });

      if (!response.ok) throw new Error("Error generating menu");

      toast.success("¡Menú semanal generado!");
      fetchMeals();
    } catch {
      toast.error("Error al generar el menú");
    } finally {
      setGenerating(false);
    }
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getMealForType = (type: string) =>
    meals.find((m) => m.meal_type === type);

  const getDayTotals = () => {
    return meals.reduce(
      (acc, meal) => {
        if (meal.recipes) {
          acc.calories += meal.recipes.calories;
          acc.protein += meal.recipes.protein_g;
          acc.carbs += meal.recipes.carbs_g;
          acc.fat += meal.recipes.fat_g;
        } else if (meal.custom_calories) {
          acc.calories += meal.custom_calories;
        }
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );
  };

  const totals = getDayTotals();

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-lg">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-xl font-bold">Menú Semanal</h1>
          <Button
            onClick={generateWeeklyMenu}
            disabled={generating}
            size="sm"
            className="gap-2"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Generar
          </Button>
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between px-4 pb-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium">
            {format(weekStart, "d MMM", { locale: es })} -{" "}
            {format(addDays(weekStart, 6), "d MMM yyyy", { locale: es })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Day Selector */}
        <ScrollArea className="w-full whitespace-nowrap px-4 pb-3">
          <div className="flex gap-2">
            {weekDays.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, new Date());

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={`flex min-w-[48px] flex-col items-center rounded-xl p-2 transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="text-[10px] uppercase">
                    {format(day, "EEE", { locale: es })}
                  </span>
                  <span className="text-lg font-semibold">
                    {format(day, "d")}
                  </span>
                  {isToday && !isSelected && (
                    <span className="h-1 w-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Daily Summary */}
      <div className="grid grid-cols-4 gap-2 px-4 py-2">
        <div className="rounded-lg bg-orange-500/10 p-2 text-center">
          <p className="text-xs text-muted-foreground">Kcal</p>
          <p className="font-semibold text-orange-500">
            {Math.round(totals.calories)}
          </p>
        </div>
        <div className="rounded-lg bg-red-500/10 p-2 text-center">
          <p className="text-xs text-muted-foreground">Prot</p>
          <p className="font-semibold text-red-500">
            {Math.round(totals.protein)}g
          </p>
        </div>
        <div className="rounded-lg bg-amber-500/10 p-2 text-center">
          <p className="text-xs text-muted-foreground">Carbs</p>
          <p className="font-semibold text-amber-500">
            {Math.round(totals.carbs)}g
          </p>
        </div>
        <div className="rounded-lg bg-blue-500/10 p-2 text-center">
          <p className="text-xs text-muted-foreground">Grasa</p>
          <p className="font-semibold text-blue-500">
            {Math.round(totals.fat)}g
          </p>
        </div>
      </div>

      {/* Meals List */}
      <div className="space-y-3 p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          mealTypes.map((mealType) => {
            const meal = getMealForType(mealType.id);
            const Icon = mealType.icon;

            return (
              <motion.div
                key={mealType.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card
                  className={`transition-colors ${meal?.completed ? "border-primary/50 bg-primary/5" : ""}`}
                >
                  <CardContent className="flex items-center gap-3 p-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        meal?.completed
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {meal?.completed ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <Icon className="h-5 w-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{mealType.label}</p>
                        <span className="text-xs text-muted-foreground">
                          {mealType.time}
                        </span>
                      </div>
                      {meal?.recipes ? (
                        <p className="truncate text-sm text-muted-foreground">
                          {meal.recipes.name}
                        </p>
                      ) : meal?.custom_name ? (
                        <p className="truncate text-sm text-muted-foreground">
                          {meal.custom_name}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Sin asignar
                        </p>
                      )}
                    </div>

                    {meal ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {meal.recipes?.calories || meal.custom_calories || 0}{" "}
                          kcal
                        </Badge>
                        <Button
                          variant={meal.completed ? "secondary" : "default"}
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() =>
                            toggleMealComplete(meal.id, meal.completed)
                          }
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0"
                            onClick={() => setSelectedMealType(mealType.id)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>
                              Añadir {mealType.label.toLowerCase()}
                            </DialogTitle>
                          </DialogHeader>
                          <ScrollArea className="max-h-[400px]">
                            <div className="space-y-2 pr-4">
                              {recipes.length === 0 ? (
                                <p className="py-4 text-center text-muted-foreground">
                                  No hay recetas disponibles
                                </p>
                              ) : (
                                recipes.map((recipe) => (
                                  <button
                                    key={recipe.id}
                                    onClick={() =>
                                      addMealToDay(mealType.id, recipe.id)
                                    }
                                    className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted"
                                  >
                                    <div className="h-12 w-12 shrink-0 rounded-lg bg-muted" />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate font-medium">
                                        {recipe.name}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {recipe.calories} kcal • P{" "}
                                        {recipe.protein_g}g • C {recipe.carbs_g}
                                        g • G {recipe.fat_g}g
                                      </p>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
