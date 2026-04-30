import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { content, mode } = await req.json();

    if (!content?.trim()) {
      return new Response(JSON.stringify({ error: "Conteúdo é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "API key não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompts: Record<string, string> = {
      extract: `Você é um perito judicial experiente. Analise o texto de uma petição, contestação ou despacho judicial e:

1. **Extraia todos os quesitos** formulados pelas partes, MP ou Juiz
2. **Numere** cada quesito identificado
3. **Identifique** quem formulou cada quesito (autor, réu, MP, Juiz)
4. **Classifique** cada quesito por área (técnico, financeiro, médico, etc.)

Formate a saída de forma clara e organizada. Responda em português do Brasil.`,

      answer: `Você é um perito judicial altamente qualificado. Para cada quesito apresentado:

1. **Analise** o quesito cuidadosamente
2. **Elabore uma resposta técnica** fundamentada, objetiva e imparcial
3. **Cite** metodologias, normas técnicas ou referências quando aplicável
4. **Use linguagem** adequada para laudos periciais
5. **Estruture** a resposta com: a) Entendimento do quesito b) Fundamentação técnica c) Resposta objetiva

Seja técnico, imparcial e preciso. Responda em português do Brasil.`,

      contestation: `Você é um perito judicial experiente em contestações técnicas. Analise o parecer ou laudo contrário apresentado e:

1. **Identifique** os pontos técnicos contestáveis
2. **Elabore** contrapontos fundamentados tecnicamente
3. **Aponte** inconsistências metodológicas
4. **Sugira** argumentos técnicos para contestação
5. **Cite** normas e referências que sustentem a contestação

Seja técnico, fundamentado e objetivo. Responda em português do Brasil.`,
    };

    const systemPrompt = systemPrompts[mode || "extract"] || systemPrompts.extract;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze-quesitos error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
