import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";
import { addDays, format } from "date-fns";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MealPlan {
  date: string;
  meals: {
    meal_type: string;
    name: string;
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
  }[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { weekStart } = await request.json();

    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const dailyCalories = profile.daily_calorie_target || 2000;
    const proteinTarget = profile.protein_target_g || 150;
    const carbsTarget = profile.carbs_target_g || 250;
    const fatTarget = profile.fat_target_g || 65;
    const goal = profile.goal || "maintain";

    const goalText =
      goal === "lose_fat"
        ? "perder grasa manteniendo masa muscular"
        : goal === "gain_muscle"
          ? "ganar masa muscular"
          : "mantener peso";

    const prompt = `Genera un plan de comidas para 7 días para una persona con estos objetivos:
- Objetivo: ${goalText}
- Calorías diarias: ${dailyCalories} kcal
- Proteína diaria: ${proteinTarget}g
- Carbohidratos diarios: ${carbsTarget}g
- Grasa diaria: ${fatTarget}g

Requisitos:
- 5 comidas por día (usar EXACTAMENTE estos valores para meal_type):
  - "breakfast" (desayuno)
  - "mid_morning" (media mañana)
  - "lunch" (almuerzo)
  - "snack" (merienda)
  - "dinner" (cena)
- Platos de la dieta mediterránea española
- Variedad de ingredientes a lo largo de la semana
- Recetas realistas y fáciles de preparar
- Incluir legumbres 2-3 veces por semana
- Pescado 2-3 veces por semana
- Carne roja máximo 2 veces por semana

IMPORTANTE: Los valores de meal_type DEBEN ser exactamente: "breakfast", "mid_morning", "lunch", "snack", "dinner"

Responde SOLO con un JSON válido con esta estructura:
{
  "week": [
    {
      "day": 1,
      "meals": [
        {"meal_type": "breakfast", "name": "Tostadas con tomate y aceite", "calories": 350, "protein_g": 12, "carbs_g": 45, "fat_g": 14},
        {"meal_type": "mid_morning", "name": "Fruta y frutos secos", "calories": 200, "protein_g": 5, "carbs_g": 25, "fat_g": 10},
        {"meal_type": "lunch", "name": "Pollo a la plancha con ensalada", "calories": 550, "protein_g": 40, "carbs_g": 30, "fat_g": 25},
        {"meal_type": "snack", "name": "Yogur con avena", "calories": 250, "protein_g": 15, "carbs_g": 30, "fat_g": 8},
        {"meal_type": "dinner", "name": "Merluza al horno con verduras", "calories": 450, "protein_g": 35, "carbs_g": 25, "fat_g": 20}
      ]
    }
  ]
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
      temperature: 0.8,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 },
      );
    }

    // Parse the JSON response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
      content.match(/```\s*([\s\S]*?)\s*```/) || [null, content];
    const jsonStr = jsonMatch[1] || content;
    const mealPlan = JSON.parse(jsonStr.trim());

    // Create meal plan record
    const { data: planRecord, error: planError } = await supabase
      .from("meal_plans")
      .upsert(
        {
          user_id: user.id,
          week_start: weekStart,
        },
        { onConflict: "user_id,week_start" },
      )
      .select()
      .single();

    if (planError) {
      console.error("Error creating meal plan:", planError);
      return NextResponse.json(
        { error: "Failed to create meal plan" },
        { status: 500 },
      );
    }

    // Delete existing meals for the week
    const weekEnd = format(addDays(new Date(weekStart), 6), "yyyy-MM-dd");
    await supabase
      .from("meals")
      .delete()
      .eq("user_id", user.id)
      .gte("date", weekStart)
      .lte("date", weekEnd);

    // Insert new meals
    const mealsToInsert = [];

    for (const day of mealPlan.week) {
      const date = format(
        addDays(new Date(weekStart), day.day - 1),
        "yyyy-MM-dd",
      );

      for (const meal of day.meals) {
        mealsToInsert.push({
          user_id: user.id,
          meal_plan_id: planRecord.id,
          date,
          meal_type: meal.meal_type,
          custom_name: meal.name,
          custom_calories: meal.calories,
          custom_protein_g: meal.protein_g,
          custom_carbs_g: meal.carbs_g,
          custom_fat_g: meal.fat_g,
        });
      }
    }

    const { error: insertError } = await supabase
      .from("meals")
      .insert(mealsToInsert);

    if (insertError) {
      console.error("Error inserting meals:", insertError);
      return NextResponse.json(
        { error: "Failed to save meals" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      mealsCreated: mealsToInsert.length,
    });
  } catch (error) {
    console.error("Menu generation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
