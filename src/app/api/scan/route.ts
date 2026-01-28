import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ANALYSIS_PROMPT = `Analiza esta imagen de comida y proporciona información nutricional estimada.

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "name": "Nombre del plato o alimento en español",
  "serving_size": "Estimación del tamaño de la porción (ej: '200g', '1 plato mediano')",
  "calories": número entero de calorías,
  "protein_g": gramos de proteína (número con 1 decimal),
  "carbs_g": gramos de carbohidratos (número con 1 decimal),
  "fat_g": gramos de grasa (número con 1 decimal),
  "fiber_g": gramos de fibra (número con 1 decimal),
  "ingredients": ["lista", "de", "ingredientes", "detectados"],
  "health_notes": ["nota 1 sobre aspectos nutricionales", "nota 2 si aplica"],
  "confidence": número entre 0 y 1 indicando tu confianza en la estimación
}

Notas importantes:
- Si no puedes identificar la comida, usa un nombre genérico
- Basa tus estimaciones en porciones típicas
- La confianza debe ser menor si la imagen es borrosa o el plato es difícil de identificar
- Las notas de salud deben ser útiles pero no alarmistas
- Todos los valores nutricionales son por porción

Responde SOLO con el JSON, sin texto adicional.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { image } = await request.json();

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // Validate image format
    if (!image.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Invalid image format" },
        { status: 400 },
      );
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: ANALYSIS_PROMPT },
            {
              type: "image_url",
              image_url: {
                url: image,
                detail: "high",
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 500 },
      );
    }

    // Parse JSON response
    try {
      // Extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
        content.match(/```\s*([\s\S]*?)\s*```/) || [null, content];

      const jsonStr = jsonMatch[1] || content;
      const nutritionData = JSON.parse(jsonStr.trim());

      // Validate required fields
      const requiredFields = [
        "name",
        "serving_size",
        "calories",
        "protein_g",
        "carbs_g",
        "fat_g",
        "fiber_g",
        "ingredients",
        "health_notes",
        "confidence",
      ];

      for (const field of requiredFields) {
        if (!(field in nutritionData)) {
          throw new Error(`Missing field: ${field}`);
        }
      }

      return NextResponse.json(nutritionData);
    } catch (parseError) {
      console.error("Failed to parse nutrition data:", parseError);
      console.error("Raw content:", content);

      // Return a fallback response
      return NextResponse.json({
        name: "Comida no identificada",
        serving_size: "Porción desconocida",
        calories: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
        ingredients: [],
        health_notes: [
          "No se pudo analizar la imagen correctamente",
          "Intenta con una foto más clara",
        ],
        confidence: 0,
      });
    }
  } catch (error) {
    console.error("Scan API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
