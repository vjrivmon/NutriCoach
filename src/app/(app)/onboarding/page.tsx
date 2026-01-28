"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  User,
  Ruler,
  Target,
  Activity,
  Sparkles,
} from "lucide-react";
import { differenceInYears } from "date-fns";
import { calculateNutritionProfile } from "@/lib/nutrition";

const steps = [
  { id: 1, title: "Datos personales", icon: User },
  { id: 2, title: "Medidas corporales", icon: Ruler },
  { id: 3, title: "Tu objetivo", icon: Target },
  { id: 4, title: "Nivel de actividad", icon: Activity },
];

export default function OnboardingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form data
  const [formData, setFormData] = useState({
    full_name: "",
    birth_date: "",
    sex: "",
    height_cm: "",
    current_weight_kg: "",
    target_weight_kg: "",
    goal: "",
    activity_level: "",
  });

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.full_name && formData.birth_date && formData.sex;
      case 2:
        return (
          formData.height_cm &&
          formData.current_weight_kg &&
          formData.target_weight_kg
        );
      case 3:
        return formData.goal;
      case 4:
        return formData.activity_level;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      // Calculate nutrition targets
      const age = differenceInYears(new Date(), new Date(formData.birth_date));
      const nutrition = calculateNutritionProfile(
        parseFloat(formData.current_weight_kg),
        parseFloat(formData.height_cm),
        age,
        formData.sex as "male" | "female",
        formData.activity_level as
          | "sedentary"
          | "light"
          | "moderate"
          | "active"
          | "very_active",
        formData.goal as "lose_fat" | "maintain" | "gain_muscle",
      );

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          birth_date: formData.birth_date,
          sex: formData.sex,
          height_cm: parseFloat(formData.height_cm),
          current_weight_kg: parseFloat(formData.current_weight_kg),
          target_weight_kg: parseFloat(formData.target_weight_kg),
          goal: formData.goal,
          activity_level: formData.activity_level,
          daily_calorie_target: Math.round(nutrition.dailyCalories),
          protein_target_g: Math.round(nutrition.macros.protein_g),
          carbs_target_g: Math.round(nutrition.macros.carbs_g),
          fat_target_g: Math.round(nutrition.macros.fat_g),
        })
        .eq("id", user?.id);

      if (error) throw error;

      // Also add first weight record
      await supabase.from("weight_records").insert({
        user_id: user?.id,
        weight_kg: parseFloat(formData.current_weight_kg),
      });

      toast.success("¡Perfil completado!");
      router.push("/dashboard");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Error al guardar el perfil");
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre completo</Label>
              <Input
                id="full_name"
                placeholder="Vicente Rivas"
                value={formData.full_name}
                onChange={(e) => updateField("full_name", e.target.value)}
                className="touch-target"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birth_date">Fecha de nacimiento</Label>
              <Input
                id="birth_date"
                type="date"
                value={formData.birth_date}
                onChange={(e) => updateField("birth_date", e.target.value)}
                className="touch-target"
              />
            </div>

            <div className="space-y-2">
              <Label>Sexo biológico</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={formData.sex === "male" ? "default" : "outline"}
                  onClick={() => updateField("sex", "male")}
                  className="touch-target"
                >
                  Masculino
                </Button>
                <Button
                  type="button"
                  variant={formData.sex === "female" ? "default" : "outline"}
                  onClick={() => updateField("sex", "female")}
                  className="touch-target"
                >
                  Femenino
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Necesario para calcular tu metabolismo basal
              </p>
            </div>
          </motion.div>
        );

      case 2:
        return (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="height_cm">Altura (cm)</Label>
              <Input
                id="height_cm"
                type="number"
                placeholder="173"
                value={formData.height_cm}
                onChange={(e) => updateField("height_cm", e.target.value)}
                className="touch-target"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="current_weight_kg">Peso actual (kg)</Label>
              <Input
                id="current_weight_kg"
                type="number"
                step="0.1"
                placeholder="95"
                value={formData.current_weight_kg}
                onChange={(e) =>
                  updateField("current_weight_kg", e.target.value)
                }
                className="touch-target"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="target_weight_kg">Peso objetivo (kg)</Label>
              <Input
                id="target_weight_kg"
                type="number"
                step="0.1"
                placeholder="80"
                value={formData.target_weight_kg}
                onChange={(e) =>
                  updateField("target_weight_kg", e.target.value)
                }
                className="touch-target"
              />
              <p className="text-xs text-muted-foreground">
                El peso que te gustaría alcanzar
              </p>
            </div>
          </motion.div>
        );

      case 3:
        return (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
          >
            <Label>¿Cuál es tu objetivo principal?</Label>

            {[
              {
                value: "lose_fat",
                title: "Perder grasa",
                description: "Déficit calórico moderado manteniendo músculo",
              },
              {
                value: "maintain",
                title: "Mantener peso",
                description: "Balance calórico para tu peso actual",
              },
              {
                value: "gain_muscle",
                title: "Ganar músculo",
                description: "Superávit calórico con proteína alta",
              },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateField("goal", option.value)}
                className={`w-full rounded-xl border-2 p-4 text-left transition-colors ${
                  formData.goal === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <p className="font-medium">{option.title}</p>
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
              </button>
            ))}
          </motion.div>
        );

      case 4:
        return (
          <motion.div
            key="step4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
          >
            <Label>¿Cuál es tu nivel de actividad física?</Label>

            {[
              {
                value: "sedentary",
                title: "Sedentario",
                description: "Trabajo de oficina, poco ejercicio",
              },
              {
                value: "light",
                title: "Actividad ligera",
                description: "Ejercicio 1-2 días por semana",
              },
              {
                value: "moderate",
                title: "Moderadamente activo",
                description: "Ejercicio 3-5 días por semana",
              },
              {
                value: "active",
                title: "Muy activo",
                description: "Ejercicio intenso 6-7 días por semana",
              },
              {
                value: "very_active",
                title: "Atleta",
                description: "Entrenamiento intenso diario o trabajo físico",
              },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateField("activity_level", option.value)}
                className={`w-full rounded-xl border-2 p-4 text-left transition-colors ${
                  formData.activity_level === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <p className="font-medium">{option.title}</p>
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
              </button>
            ))}
          </motion.div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {currentStep === 4 ? (
              <Sparkles className="h-6 w-6 text-primary" />
            ) : (
              (() => {
                const StepIcon = steps[currentStep - 1].icon;
                return <StepIcon className="h-6 w-6 text-primary" />;
              })()
            )}
          </div>
          <CardTitle>{steps[currentStep - 1].title}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Paso {currentStep} de {steps.length}
          </p>
          <Progress
            value={(currentStep / steps.length) * 100}
            className="mt-2"
          />
        </CardHeader>

        <CardContent className="space-y-6">
          <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>

          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="touch-target"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Atrás
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={!canProceed() || loading}
              className="touch-target flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : currentStep === 4 ? (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Completar
                </>
              ) : (
                <>
                  Siguiente
                  <ChevronRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
