"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Loader2, Leaf, User, Sparkles, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

const SUGGESTIONS = [
  "¿Cuántas calorías necesito al día?",
  "Dame ideas para un desayuno saludable",
  "¿Cómo puedo ganar masa muscular?",
  "¿Qué alimentos tienen más proteína?",
];

export default function ChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(
    null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation);
    }
  }, [activeConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  const fetchConversations = async () => {
    const { data } = await supabase
      .from("chat_conversations")
      .select("id, title, created_at")
      .eq("user_id", user?.id)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (data && data.length > 0) {
      setConversations(data);
      setActiveConversation(data[0].id);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (data) {
      setMessages(data as Message[]);
    }
  };

  const createConversation = async () => {
    const { data, error } = await supabase
      .from("chat_conversations")
      .insert({
        user_id: user?.id,
        title: "Nueva conversación",
      })
      .select()
      .single();

    if (data && !error) {
      setConversations([data, ...conversations]);
      setActiveConversation(data.id);
      setMessages([]);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading || streaming) return;

    if (!activeConversation) {
      await createConversation();
    }

    const conversationId = activeConversation;
    if (!conversationId) return;

    setInput("");
    setLoading(true);

    // Add user message immediately
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    try {
      // Save user message
      await supabase.from("chat_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content,
      });

      // Stream AI response
      setStreaming(true);
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: content,
        }),
      });

      if (!response.ok) throw new Error("Error en la respuesta");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let assistantContent = "";
      const assistantMessage: Message = {
        id: `temp-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        assistantContent += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id
              ? { ...m, content: assistantContent }
              : m,
          ),
        );
      }

      // Update conversation title if first message
      if (messages.length === 0) {
        const title =
          content.length > 50 ? content.substring(0, 50) + "..." : content;
        await supabase
          .from("chat_conversations")
          .update({ title })
          .eq("id", conversationId);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            "Lo siento, ha ocurrido un error. Por favor, intenta de nuevo.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary">
            <Leaf className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold">NutriCoach AI</h1>
            <p className="text-xs text-muted-foreground">
              Tu nutricionista personal
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={createConversation}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <h2 className="mb-2 text-lg font-semibold">
                ¡Hola! Soy NutriCoach
              </h2>
              <p className="mb-6 text-center text-sm text-muted-foreground">
                Tu asistente de nutrición con IA. Pregúntame sobre alimentación,
                recetas, calorías y más.
              </p>
              <div className="grid gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="outline"
                    className="h-auto justify-start whitespace-normal text-left"
                    onClick={() => sendMessage(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${
                    message.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback
                      className={
                        message.role === "assistant"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }
                    >
                      {message.role === "assistant" ? (
                        <Leaf className="h-4 w-4" />
                      ) : (
                        <User className="h-4 w-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap text-sm">
                      {message.content}
                    </p>
                    {message.role === "assistant" &&
                      streaming &&
                      !message.content && (
                        <div className="flex gap-1 py-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-current" />
                          <span
                            className="h-2 w-2 animate-bounce rounded-full bg-current"
                            style={{ animationDelay: "0.1s" }}
                          />
                          <span
                            className="h-2 w-2 animate-bounce rounded-full bg-current"
                            style={{ animationDelay: "0.2s" }}
                          />
                        </div>
                      )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-4 safe-area-bottom">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu pregunta..."
            disabled={loading || streaming}
            className="touch-target flex-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || loading || streaming}
            className="touch-target"
          >
            {loading || streaming ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
