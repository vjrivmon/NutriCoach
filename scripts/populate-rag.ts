/**
 * Script para poblar la base de conocimiento vectorial (RAG)
 *
 * Uso: npx tsx scripts/populate-rag.ts
 *
 * Este script:
 * 1. Lee documentos de ./knowledge/
 * 2. Los divide en chunks
 * 3. Genera embeddings con OpenAI
 * 4. Los guarda en Supabase con pgvector
 */

import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import * as fs from "fs";
import * as path from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Necesita service role para insertar
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface Document {
  title: string;
  source: string;
  content: string;
}

// Divide el texto en chunks de aproximadamente maxTokens
function chunkText(text: string, maxChars: number = 2000): string[] {
  const paragraphs = text.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = paragraph;
    } else {
      currentChunk += "\n\n" + paragraph;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return response.data[0].embedding;
}

async function processDocument(doc: Document) {
  console.log(`Processing: ${doc.title}`);

  const chunks = chunkText(doc.content);
  console.log(`  - ${chunks.length} chunks`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    try {
      const embedding = await getEmbedding(chunk);

      const { error } = await supabase.from("knowledge_documents").insert({
        title: doc.title,
        source: doc.source,
        content: chunk,
        chunk_index: i,
        embedding,
        metadata: {
          total_chunks: chunks.length,
          char_count: chunk.length,
        },
      });

      if (error) {
        console.error(`  Error inserting chunk ${i}:`, error);
      } else {
        console.log(`  - Chunk ${i + 1}/${chunks.length} inserted`);
      }

      // Rate limiting
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`  Error processing chunk ${i}:`, err);
    }
  }
}

async function main() {
  const knowledgeDir = path.join(process.cwd(), "knowledge");

  if (!fs.existsSync(knowledgeDir)) {
    console.log("Creating knowledge directory...");
    fs.mkdirSync(knowledgeDir, { recursive: true });

    // Crear documento de ejemplo
    const exampleDoc = `# Guía de Macronutrientes

## Proteínas
Las proteínas son esenciales para la construcción y reparación de tejidos.
Recomendación: 1.6-2.2g por kg de peso corporal para personas activas.

Fuentes de proteína de alta calidad:
- Pollo y pavo
- Pescado (salmón, atún, merluza)
- Huevos
- Legumbres (lentejas, garbanzos)
- Lácteos (yogur griego, queso cottage)

## Carbohidratos
Los carbohidratos son la principal fuente de energía del cuerpo.
Tipos:
- Complejos: arroz integral, avena, patata
- Simples: frutas, miel
Recomendación: 3-5g por kg para mantenimiento, ajustar según objetivo.

## Grasas
Las grasas son esenciales para hormonas y absorción de vitaminas.
Tipos saludables:
- Aceite de oliva virgen extra
- Aguacate
- Frutos secos
- Pescado azul (omega-3)
Recomendación: 0.8-1.2g por kg de peso corporal.

## Distribución de Macros por Objetivo

### Perder grasa
- Proteínas: 30-35%
- Carbohidratos: 35-40%
- Grasas: 25-30%
- Déficit calórico: 300-500 kcal

### Ganar músculo
- Proteínas: 25-30%
- Carbohidratos: 45-50%
- Grasas: 20-25%
- Superávit calórico: 200-400 kcal

### Mantener peso
- Proteínas: 25-30%
- Carbohidratos: 40-45%
- Grasas: 25-30%
`;

    fs.writeFileSync(path.join(knowledgeDir, "macronutrientes.md"), exampleDoc);
    console.log("Created example document: macronutrientes.md");
  }

  // Leer todos los archivos .md del directorio knowledge
  const files = fs.readdirSync(knowledgeDir).filter((f) => f.endsWith(".md"));

  console.log(`Found ${files.length} documents to process\n`);

  for (const file of files) {
    const filePath = path.join(knowledgeDir, file);
    const content = fs.readFileSync(filePath, "utf-8");

    await processDocument({
      title: file.replace(".md", ""),
      source: file,
      content,
    });

    console.log("");
  }

  console.log("Done! Knowledge base populated.");
}

main().catch(console.error);
