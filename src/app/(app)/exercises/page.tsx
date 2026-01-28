"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Dumbbell,
  Play,
  Clock,
  Flame,
  Check,
  Plus,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { calculateCaloriesBurned } from "@/lib/nutrition";

interface Exercise {
  id: string;
  name: string;
  description: string | null;
  muscle_group: string;
  met_value: number;
  difficulty: string;
  equipment: string[];
  instructions: string[];
}

interface ExerciseSession {
  id: string;
  date: string;
  duration_minutes: number | null;
  calories_burned: number | null;
  completed: boolean;
  routine_name: string | null;
}

const muscleGroups = [
  { id: "all", label: "Todos" },
  { id: "chest", label: "Pecho" },
  { id: "back", label: "Espalda" },
  { id: "shoulders", label: "Hombros" },
  { id: "biceps", label: "Bíceps" },
  { id: "triceps", label: "Tríceps" },
  { id: "core", label: "Core" },
  { id: "quadriceps", label: "Cuádriceps" },
  { id: "hamstrings", label: "Isquios" },
  { id: "glutes", label: "Glúteos" },
  { id: "cardio", label: "Cardio" },
];

export default function ExercisesPage() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [sessions, setSessions] = useState<ExerciseSession[]>([]);
  const [selectedMuscle, setSelectedMuscle] = useState("all");
  const [loading, setLoading] = useState(true);
  const [startingWorkout, setStartingWorkout] = useState(false);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [userWeight, setUserWeight] = useState(80);
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchExercises();
      fetchSessions();
      fetchUserWeight();
    }
  }, [user]);

  const fetchExercises = async () => {
    setLoading(true);
    const { data } = await supabase.from("exercises").select("*").order("name");

    if (data) {
      setExercises(data);
    }
    setLoading(false);
  };

  const fetchSessions = async () => {
    const { data } = await supabase
      .from("exercise_sessions")
      .select(
        `
        id,
        date,
        duration_minutes,
        calories_burned,
        completed,
        exercise_routines (
          name
        )
      `,
      )
      .eq("user_id", user?.id)
      .order("date", { ascending: false })
      .limit(10);

    if (data) {
      setSessions(
        data.map((s) => {
          // Handle both single object and array cases from Supabase join
          const routineData = s.exercise_routines as
            | { name: string }
            | { name: string }[]
            | null;
          const routine = Array.isArray(routineData)
            ? routineData[0]
            : routineData;
          return {
            ...s,
            routine_name: routine?.name || null,
          };
        }),
      );
    }
  };

  const fetchUserWeight = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("current_weight_kg")
      .eq("id", user?.id)
      .single();

    if (data?.current_weight_kg) {
      setUserWeight(data.current_weight_kg);
    }
  };

  const startQuickWorkout = async () => {
    setStartingWorkout(true);

    try {
      const { data, error } = await supabase
        .from("exercise_sessions")
        .insert({
          user_id: user?.id,
          date: format(new Date(), "yyyy-MM-dd"),
        })
        .select()
        .single();

      if (error) throw error;

      setActiveSession(data.id);
      toast.success("¡Entrenamiento iniciado!");
      fetchSessions();
    } catch (error) {
      toast.error("Error al iniciar el entrenamiento");
      console.error(error);
    } finally {
      setStartingWorkout(false);
    }
  };

  const endWorkout = async (durationMinutes: number) => {
    if (!activeSession) return;

    // Calculate approximate calories (average MET of 5)
    const caloriesBurned = calculateCaloriesBurned(
      5,
      userWeight,
      durationMinutes,
    );

    const { error } = await supabase
      .from("exercise_sessions")
      .update({
        duration_minutes: durationMinutes,
        calories_burned: Math.round(caloriesBurned),
        completed: true,
      })
      .eq("id", activeSession);

    if (error) {
      toast.error("Error al guardar el entrenamiento");
    } else {
      toast.success(
        `¡Entrenamiento completado! ${Math.round(caloriesBurned)} kcal quemadas`,
      );
      setActiveSession(null);
      fetchSessions();
    }
  };

  const filteredExercises =
    selectedMuscle === "all"
      ? exercises
      : exercises.filter((e) => e.muscle_group === selectedMuscle);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "bg-green-500/10 text-green-500";
      case "intermediate":
        return "bg-yellow-500/10 text-yellow-500";
      case "advanced":
        return "bg-red-500/10 text-red-500";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "Principiante";
      case "intermediate":
        return "Intermedio";
      case "advanced":
        return "Avanzado";
      default:
        return difficulty;
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Ejercicios</h1>
        <Button
          onClick={startQuickWorkout}
          disabled={startingWorkout || !!activeSession}
        >
          {startingWorkout ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          {activeSession ? "En progreso" : "Iniciar"}
        </Button>
      </div>

      {/* Active Workout Banner */}
      {activeSession && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-primary bg-primary/5">
            <CardContent className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
                  <Dumbbell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Entrenamiento en curso</p>
                  <p className="text-sm text-muted-foreground">
                    Selecciona ejercicios para registrar
                  </p>
                </div>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    Finalizar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Finalizar entrenamiento</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <p className="text-muted-foreground">
                      ¿Cuántos minutos has entrenado?
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {[15, 30, 45, 60, 90, 120].map((mins) => (
                        <Button
                          key={mins}
                          variant="outline"
                          onClick={() => endWorkout(mins)}
                        >
                          {mins} min
                        </Button>
                      ))}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Tabs defaultValue="exercises">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="exercises">Ejercicios</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        {/* Exercises Tab */}
        <TabsContent value="exercises" className="space-y-4">
          {/* Muscle Filter */}
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
            {muscleGroups.map((group) => (
              <Button
                key={group.id}
                variant={selectedMuscle === group.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedMuscle(group.id)}
                className="shrink-0"
              >
                {group.label}
              </Button>
            ))}
          </div>

          {/* Exercise List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {filteredExercises.map((exercise) => (
                <Dialog key={exercise.id}>
                  <DialogTrigger asChild>
                    <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                      <CardContent className="flex items-center gap-3 p-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Dumbbell className="h-6 w-6 text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{exercise.name}</p>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className={getDifficultyColor(
                                exercise.difficulty,
                              )}
                            >
                              {getDifficultyLabel(exercise.difficulty)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              MET: {exercise.met_value}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{exercise.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      {exercise.description && (
                        <p className="text-muted-foreground">
                          {exercise.description}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <Badge
                          variant="secondary"
                          className={getDifficultyColor(exercise.difficulty)}
                        >
                          {getDifficultyLabel(exercise.difficulty)}
                        </Badge>
                        <Badge variant="outline">
                          <Flame className="mr-1 h-3 w-3" />
                          {Math.round(
                            calculateCaloriesBurned(
                              exercise.met_value,
                              userWeight,
                              30,
                            ),
                          )}{" "}
                          kcal/30min
                        </Badge>
                      </div>

                      {exercise.equipment.length > 0 && (
                        <div>
                          <p className="mb-2 text-sm font-medium">
                            Equipamiento
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {exercise.equipment.map((eq, idx) => (
                              <Badge key={idx} variant="outline">
                                {eq}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {exercise.instructions.length > 0 && (
                        <div>
                          <p className="mb-2 text-sm font-medium">
                            Instrucciones
                          </p>
                          <ol className="list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                            {exercise.instructions.map((instruction, idx) => (
                              <li key={idx}>{instruction}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              ))}

              {filteredExercises.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">
                  No hay ejercicios en esta categoría
                </p>
              )}
            </div>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4">
          {sessions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center py-8">
                <Dumbbell className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No hay entrenamientos registrados
                </p>
                <Button onClick={startQuickWorkout} className="mt-4">
                  <Play className="mr-2 h-4 w-4" />
                  Empezar ahora
                </Button>
              </CardContent>
            </Card>
          ) : (
            sessions.map((session) => (
              <Card key={session.id}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      session.completed
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {session.completed ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <Dumbbell className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {session.routine_name || "Entrenamiento libre"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(session.date), "d MMM yyyy", {
                        locale: es,
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    {session.duration_minutes && (
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {session.duration_minutes} min
                      </div>
                    )}
                    {session.calories_burned && (
                      <div className="flex items-center gap-1 text-sm text-orange-500">
                        <Flame className="h-3 w-3" />
                        {session.calories_burned} kcal
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
