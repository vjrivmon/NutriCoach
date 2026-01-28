"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Settings,
  Trophy,
  Scale,
  LogOut,
  Loader2,
  ChevronRight,
  Target,
  Activity,
  Ruler,
  Calendar,
  Edit,
  Save,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { format, differenceInYears } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { calculateNutritionProfile } from "@/lib/nutrition";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  birth_date: string | null;
  sex: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  activity_level: string | null;
  goal: string | null;
  daily_calorie_target: number | null;
  protein_target_g: number | null;
  carbs_target_g: number | null;
  fat_target_g: number | null;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked_at: string | null;
}

interface WeightRecord {
  id: string;
  weight_kg: number;
  recorded_at: string;
}

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [weightHistory, setWeightHistory] = useState<WeightRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [editedProfile, setEditedProfile] = useState<Partial<Profile>>({});
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchAchievements();
      fetchWeightHistory();
    }
  }, [user]);

  const fetchProfile = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user?.id)
      .single();

    if (data) {
      setProfile(data);
      setEditedProfile(data);
    }
    setLoading(false);
  };

  const fetchAchievements = async () => {
    const { data } = await supabase
      .from("achievements")
      .select(
        `
        id,
        name,
        description,
        icon,
        user_achievements!left (
          unlocked_at
        )
      `,
      )
      .order("points", { ascending: true });

    if (data) {
      const mapped = data.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description || "",
        icon: a.icon || "🏆",
        unlocked_at:
          (
            a.user_achievements as unknown as { unlocked_at: string | null }[]
          )?.[0]?.unlocked_at || null,
      }));
      setAchievements(mapped);
    }
  };

  const fetchWeightHistory = async () => {
    const { data } = await supabase
      .from("weight_records")
      .select("id, weight_kg, recorded_at")
      .eq("user_id", user?.id)
      .order("recorded_at", { ascending: false })
      .limit(30);

    if (data) {
      setWeightHistory(data);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);

    // Calculate nutrition targets if we have all data
    let nutritionTargets = {};
    if (
      editedProfile.sex &&
      editedProfile.birth_date &&
      editedProfile.height_cm &&
      editedProfile.current_weight_kg &&
      editedProfile.activity_level &&
      editedProfile.goal
    ) {
      const age = differenceInYears(
        new Date(),
        new Date(editedProfile.birth_date),
      );
      const calculated = calculateNutritionProfile(
        editedProfile.current_weight_kg,
        editedProfile.height_cm,
        age,
        editedProfile.sex as "male" | "female",
        editedProfile.activity_level as
          | "sedentary"
          | "light"
          | "moderate"
          | "active"
          | "very_active",
        editedProfile.goal as "lose_fat" | "maintain" | "gain_muscle",
      );
      nutritionTargets = {
        daily_calorie_target: Math.round(calculated.dailyCalories),
        protein_target_g: Math.round(calculated.macros.protein_g),
        carbs_target_g: Math.round(calculated.macros.carbs_g),
        fat_target_g: Math.round(calculated.macros.fat_g),
      };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ ...editedProfile, ...nutritionTargets })
      .eq("id", user?.id);

    if (error) {
      toast.error("Error al guardar el perfil");
    } else {
      toast.success("Perfil actualizado");
      setProfile({
        ...profile,
        ...editedProfile,
        ...nutritionTargets,
      } as Profile);
      setEditing(false);
    }
    setSaving(false);
  };

  const handleAddWeight = async () => {
    if (!newWeight) return;

    const weight = parseFloat(newWeight);
    if (isNaN(weight) || weight < 20 || weight > 300) {
      toast.error("Peso inválido");
      return;
    }

    const { error } = await supabase.from("weight_records").upsert(
      {
        user_id: user?.id,
        weight_kg: weight,
        recorded_at: format(new Date(), "yyyy-MM-dd"),
      },
      { onConflict: "user_id,recorded_at" },
    );

    if (error) {
      toast.error("Error al registrar el peso");
    } else {
      // Also update current weight in profile
      await supabase
        .from("profiles")
        .update({ current_weight_kg: weight })
        .eq("id", user?.id);

      toast.success("Peso registrado");
      setNewWeight("");
      fetchWeightHistory();
      fetchProfile();
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const getActivityLabel = (level: string | null | undefined) => {
    const labels: Record<string, string> = {
      sedentary: "Sedentario",
      light: "Ligero",
      moderate: "Moderado",
      active: "Activo",
      very_active: "Muy activo",
    };
    return labels[level || ""] || "Sin definir";
  };

  const getGoalLabel = (goal: string | null | undefined) => {
    const labels: Record<string, string> = {
      lose_fat: "Perder grasa",
      maintain: "Mantener peso",
      gain_muscle: "Ganar músculo",
    };
    return labels[goal || ""] || "Sin definir";
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const unlockedCount = achievements.filter((a) => a.unlocked_at).length;

  return (
    <div className="space-y-4 p-4">
      {/* Profile Header */}
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">
              {profile?.full_name || "Usuario"}
            </h2>
            <p className="text-sm text-muted-foreground">{profile?.email}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditing(!editing)}
          >
            <Edit className="h-5 w-5" />
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="stats" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stats" className="gap-2">
            <Activity className="h-4 w-4" />
            Stats
          </TabsTrigger>
          <TabsTrigger value="weight" className="gap-2">
            <Scale className="h-4 w-4" />
            Peso
          </TabsTrigger>
          <TabsTrigger value="achievements" className="gap-2">
            <Trophy className="h-4 w-4" />
            Logros
          </TabsTrigger>
        </TabsList>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          {editing ? (
            <Card>
              <CardHeader>
                <CardTitle>Editar perfil</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nombre completo</Label>
                  <Input
                    value={editedProfile.full_name || ""}
                    onChange={(e) =>
                      setEditedProfile({
                        ...editedProfile,
                        full_name: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sexo</Label>
                    <Select
                      value={editedProfile.sex || ""}
                      onValueChange={(v) =>
                        setEditedProfile({ ...editedProfile, sex: v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Masculino</SelectItem>
                        <SelectItem value="female">Femenino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Fecha de nacimiento</Label>
                    <Input
                      type="date"
                      value={editedProfile.birth_date || ""}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile,
                          birth_date: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Altura (cm)</Label>
                    <Input
                      type="number"
                      value={editedProfile.height_cm || ""}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile,
                          height_cm: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Peso actual (kg)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={editedProfile.current_weight_kg || ""}
                      onChange={(e) =>
                        setEditedProfile({
                          ...editedProfile,
                          current_weight_kg: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Peso objetivo (kg)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={editedProfile.target_weight_kg || ""}
                    onChange={(e) =>
                      setEditedProfile({
                        ...editedProfile,
                        target_weight_kg: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nivel de actividad</Label>
                  <Select
                    value={editedProfile.activity_level || ""}
                    onValueChange={(v) =>
                      setEditedProfile({ ...editedProfile, activity_level: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sedentary">
                        Sedentario (poco ejercicio)
                      </SelectItem>
                      <SelectItem value="light">
                        Ligero (1-2 días/semana)
                      </SelectItem>
                      <SelectItem value="moderate">
                        Moderado (3-5 días/semana)
                      </SelectItem>
                      <SelectItem value="active">
                        Activo (6-7 días/semana)
                      </SelectItem>
                      <SelectItem value="very_active">
                        Muy activo (atleta)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Objetivo</Label>
                  <Select
                    value={editedProfile.goal || ""}
                    onValueChange={(v) =>
                      setEditedProfile({ ...editedProfile, goal: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lose_fat">Perder grasa</SelectItem>
                      <SelectItem value="maintain">Mantener peso</SelectItem>
                      <SelectItem value="gain_muscle">Ganar músculo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Guardar cambios
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      Edad
                    </span>
                    <span className="font-medium">
                      {profile?.birth_date
                        ? `${differenceInYears(new Date(), new Date(profile.birth_date))} años`
                        : "Sin definir"}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Ruler className="h-4 w-4" />
                      Altura
                    </span>
                    <span className="font-medium">
                      {profile?.height_cm
                        ? `${profile.height_cm} cm`
                        : "Sin definir"}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Scale className="h-4 w-4" />
                      Peso actual
                    </span>
                    <span className="font-medium">
                      {profile?.current_weight_kg
                        ? `${profile.current_weight_kg} kg`
                        : "Sin definir"}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Target className="h-4 w-4" />
                      Peso objetivo
                    </span>
                    <span className="font-medium">
                      {profile?.target_weight_kg
                        ? `${profile.target_weight_kg} kg`
                        : "Sin definir"}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Activity className="h-4 w-4" />
                      Actividad
                    </span>
                    <Badge variant="secondary">
                      {getActivityLabel(profile?.activity_level)}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Target className="h-4 w-4" />
                      Objetivo
                    </span>
                    <Badge>{getGoalLabel(profile?.goal)}</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Nutrition Targets */}
              {profile?.daily_calorie_target && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      Objetivos diarios calculados
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-orange-500/10 p-3 text-center">
                      <p className="text-2xl font-bold text-orange-500">
                        {profile.daily_calorie_target}
                      </p>
                      <p className="text-xs text-muted-foreground">kcal/día</p>
                    </div>
                    <div className="rounded-lg bg-red-500/10 p-3 text-center">
                      <p className="text-2xl font-bold text-red-500">
                        {profile.protein_target_g}g
                      </p>
                      <p className="text-xs text-muted-foreground">proteína</p>
                    </div>
                    <div className="rounded-lg bg-amber-500/10 p-3 text-center">
                      <p className="text-2xl font-bold text-amber-500">
                        {profile.carbs_target_g}g
                      </p>
                      <p className="text-xs text-muted-foreground">carbos</p>
                    </div>
                    <div className="rounded-lg bg-blue-500/10 p-3 text-center">
                      <p className="text-2xl font-bold text-blue-500">
                        {profile.fat_target_g}g
                      </p>
                      <p className="text-xs text-muted-foreground">grasas</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Weight Tab */}
        <TabsContent value="weight" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Registrar peso de hoy</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Input
                type="number"
                step="0.1"
                placeholder="Ej: 85.5"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleAddWeight}>
                <Save className="mr-2 h-4 w-4" />
                Guardar
              </Button>
            </CardContent>
          </Card>

          {/* Weight Progress */}
          {profile?.current_weight_kg && profile?.target_weight_kg && (
            <Card>
              <CardContent className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Progreso hacia objetivo
                  </span>
                  <span className="text-sm font-medium">
                    {profile.current_weight_kg} → {profile.target_weight_kg} kg
                  </span>
                </div>
                <Progress
                  value={
                    100 -
                    (Math.abs(
                      profile.current_weight_kg - profile.target_weight_kg,
                    ) /
                      Math.abs(
                        (weightHistory[weightHistory.length - 1]?.weight_kg ||
                          profile.current_weight_kg) - profile.target_weight_kg,
                      )) *
                      100
                  }
                  className="h-2"
                />
              </CardContent>
            </Card>
          )}

          {/* Weight History */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Historial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {weightHistory.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No hay registros de peso
                </p>
              ) : (
                weightHistory.slice(0, 10).map((record, idx) => {
                  const prevWeight = weightHistory[idx + 1]?.weight_kg;
                  const diff = prevWeight
                    ? record.weight_kg - prevWeight
                    : null;

                  return (
                    <div
                      key={record.id}
                      className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
                    >
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(record.recorded_at), "d MMM yyyy", {
                          locale: es,
                        })}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {record.weight_kg} kg
                        </span>
                        {diff !== null && (
                          <Badge
                            variant={diff <= 0 ? "default" : "secondary"}
                            className="gap-1"
                          >
                            {diff > 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {diff > 0 ? "+" : ""}
                            {diff.toFixed(1)}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Achievements Tab */}
        <TabsContent value="achievements" className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Logros desbloqueados
                </span>
                <span className="font-medium">
                  {unlockedCount} / {achievements.length}
                </span>
              </div>
              <Progress
                value={(unlockedCount / achievements.length) * 100}
                className="h-2"
              />
            </CardContent>
          </Card>

          <div className="grid gap-2">
            {achievements.map((achievement) => (
              <motion.div
                key={achievement.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card
                  className={
                    achievement.unlocked_at ? "" : "opacity-50 grayscale"
                  }
                >
                  <CardContent className="flex items-center gap-3 p-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-2xl">
                      {achievement.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{achievement.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {achievement.description}
                      </p>
                    </div>
                    {achievement.unlocked_at && (
                      <Badge variant="secondary">
                        {format(new Date(achievement.unlocked_at), "d MMM", {
                          locale: es,
                        })}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Sign Out */}
      <Button
        variant="outline"
        className="w-full text-destructive"
        onClick={handleSignOut}
      >
        <LogOut className="mr-2 h-4 w-4" />
        Cerrar sesión
      </Button>
    </div>
  );
}
