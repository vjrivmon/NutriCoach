import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@/lib/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `Eres NutriCoach, un nutricionista experto y amigable que ayuda a los usuarios con sus objetivos de alimentación y salud.

Tu personalidad:
- Eres amable, motivador y empático
- Das consejos prácticos y basados en evidencia científica
- Respondes en español de España
- Usas un tono cercano pero profesional
- Evitas ser condescendiente o alarmista

Tus conocimientos:
- Nutrición clínica y deportiva
- Planificación de comidas
- Macronutrientes y micronutrientes
- Dietas específicas (mediterránea, cetogénica, vegetariana, etc.)
- Control de peso saludable
- Suplementación básica

Limitaciones importantes:
- NO diagnosticas condiciones médicas
- NO recomiendas tratamientos médicos
- Siempre sugieres consultar a un profesional médico para casos específicos
- No das consejos sobre trastornos alimentarios sin recomendar ayuda profesional

Formato de respuesta:
- Respuestas concisas pero completas
- Usa listas cuando sea apropiado
- Incluye ejemplos prácticos
- Si es relevante, menciona valores nutricionales aproximados`;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId, message } = await request.json();

    if (!conversationId || !message) {
      return NextResponse.json(
        { error: "Missing conversationId or message" },
        { status: 400 },
      );
    }

    // Fetch conversation history
    const { data: messages } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(20);

    // Build messages array for OpenAI
    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (messages) {
      for (const msg of messages) {
        chatMessages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    }

    // Perform RAG search if query is nutrition-related
    let relevantDocs: { content: string; source: string }[] | null = null;
    try {
      console.log(
        "[RAG] Searching vector database for:",
        message.substring(0, 50) + "...",
      );
      const embedding = await getEmbedding(message);

      if (embedding.length > 0) {
        const { data, error } = await supabase.rpc("match_documents", {
          query_embedding: embedding,
          match_threshold: 0.7,
          match_count: 3,
        });

        if (error) {
          console.log("[RAG] Vector search error:", error.message);
        } else {
          relevantDocs = data;
          console.log(
            "[RAG] Found",
            relevantDocs?.length || 0,
            "relevant documents",
          );
        }
      } else {
        console.log(
          "[RAG] Embedding generation failed, skipping vector search",
        );
      }
    } catch (ragError) {
      console.log("[RAG] Vector search failed:", ragError);
    }

    if (relevantDocs && relevantDocs.length > 0) {
      console.log(
        "[RAG] Using context from:",
        relevantDocs.map((d) => d.source).join(", "),
      );
      const context = relevantDocs
        .map(
          (doc: { content: string; source: string }) =>
            `[${doc.source}]: ${doc.content}`,
        )
        .join("\n\n");

      chatMessages.push({
        role: "system",
        content: `Información científica relevante para tu respuesta:\n\n${context}\n\nUsa esta información para fundamentar tu respuesta cuando sea apropiado.`,
      });
    } else {
      console.log(
        "[RAG] No relevant documents found, using base knowledge only",
      );
    }

    chatMessages.push({ role: "user", content: message });

    // Create streaming response
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: chatMessages,
      stream: true,
      max_tokens: 1000,
      temperature: 0.7,
    });

    // Create a TransformStream to handle the streaming
    const encoder = new TextEncoder();
    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            fullResponse += content;
            controller.enqueue(encoder.encode(content));
          }
        }

        // Save assistant message to database
        await supabase.from("chat_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: fullResponse,
        });

        // Update conversation timestamp
        await supabase
          .from("chat_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);

        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function getEmbedding(text: string): Promise<number[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  } catch {
    return [];
  }
}
