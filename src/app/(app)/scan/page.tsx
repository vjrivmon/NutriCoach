"use client";

import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Upload,
  Loader2,
  Sparkles,
  X,
  Utensils,
  Flame,
  Beef,
  Wheat,
  Droplets,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface NutritionEstimate {
  name: string;
  serving_size: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  ingredients: string[];
  health_notes: string[];
  confidence: number;
}

export default function ScanPage() {
  const [image, setImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<NutritionEstimate | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setStream(mediaStream);
      setShowCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      toast.error("No se pudo acceder a la cámara");
      console.error(error);
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCamera(false);
  }, [stream]);

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("La imagen es demasiado grande (máx 10MB)");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async () => {
    if (!image) return;

    setAnalyzing(true);
    setResult(null);

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image }),
      });

      if (!response.ok) throw new Error("Error analyzing image");

      const data = await response.json();
      setResult(data);
    } catch (error) {
      toast.error("Error al analizar la imagen");
      console.error(error);
    } finally {
      setAnalyzing(false);
    }
  };

  const clearImage = () => {
    setImage(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col p-4">
      <h1 className="mb-4 text-xl font-bold">Escanear comida</h1>

      {/* Camera View */}
      {showCamera && (
        <div className="fixed inset-0 z-50 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
            <Button variant="secondary" size="lg" onClick={stopCamera}>
              <X className="mr-2 h-5 w-5" />
              Cancelar
            </Button>
            <Button
              size="lg"
              onClick={capturePhoto}
              className="h-16 w-16 rounded-full p-0"
            >
              <Camera className="h-8 w-8" />
            </Button>
          </div>
        </div>
      )}

      {/* Image Preview or Capture Options */}
      {image ? (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-xl">
            <img
              src={image}
              alt="Foto de comida"
              className="aspect-square w-full object-cover"
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute right-2 top-2"
              onClick={clearImage}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {!result && (
            <Button
              onClick={analyzeImage}
              disabled={analyzing}
              className="w-full"
              size="lg"
            >
              {analyzing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Analizar con IA
                </>
              )}
            </Button>
          )}

          {/* Analysis Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Utensils className="h-5 w-5" />
                          {result.name}
                        </CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Porción: {result.serving_size}
                        </p>
                      </div>
                      <Badge
                        variant={
                          result.confidence > 0.8 ? "default" : "secondary"
                        }
                      >
                        {Math.round(result.confidence * 100)}% confianza
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Main Macros */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="rounded-lg bg-orange-500/10 p-3 text-center">
                        <Flame className="mx-auto mb-1 h-5 w-5 text-orange-500" />
                        <p className="text-lg font-bold text-orange-500">
                          {result.calories}
                        </p>
                        <p className="text-xs text-muted-foreground">kcal</p>
                      </div>
                      <div className="rounded-lg bg-red-500/10 p-3 text-center">
                        <Beef className="mx-auto mb-1 h-5 w-5 text-red-500" />
                        <p className="text-lg font-bold text-red-500">
                          {result.protein_g}g
                        </p>
                        <p className="text-xs text-muted-foreground">prot</p>
                      </div>
                      <div className="rounded-lg bg-amber-500/10 p-3 text-center">
                        <Wheat className="mx-auto mb-1 h-5 w-5 text-amber-500" />
                        <p className="text-lg font-bold text-amber-500">
                          {result.carbs_g}g
                        </p>
                        <p className="text-xs text-muted-foreground">carbs</p>
                      </div>
                      <div className="rounded-lg bg-blue-500/10 p-3 text-center">
                        <Droplets className="mx-auto mb-1 h-5 w-5 text-blue-500" />
                        <p className="text-lg font-bold text-blue-500">
                          {result.fat_g}g
                        </p>
                        <p className="text-xs text-muted-foreground">grasa</p>
                      </div>
                    </div>

                    {/* Ingredients */}
                    {result.ingredients.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium">
                          Ingredientes detectados
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {result.ingredients.map((ingredient, idx) => (
                            <Badge key={idx} variant="outline">
                              {ingredient}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Health Notes */}
                    {result.health_notes.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-medium">
                          Notas de salud
                        </p>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {result.health_notes.map((note, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span>•</span>
                              {note}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={clearImage}>
                    Nueva foto
                  </Button>
                  <Button>Añadir a comida</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Camera className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mb-2 text-lg font-semibold">Escanea tu comida</h2>
              <p className="mb-6 text-center text-sm text-muted-foreground">
                Toma una foto o sube una imagen para obtener información
                nutricional instantánea con IA
              </p>

              <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                <Button onClick={startCamera} className="gap-2" size="lg">
                  <Camera className="h-5 w-5" />
                  Tomar foto
                </Button>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                  size="lg"
                >
                  <Upload className="h-5 w-5" />
                  Subir imagen
                </Button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Consejos para mejores resultados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  Buena iluminación, preferiblemente natural
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  Foto desde arriba mostrando todo el plato
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  Evita reflejos y sombras fuertes
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  Incluye un objeto de referencia para el tamaño
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
