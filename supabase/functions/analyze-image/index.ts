import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, context, analysisType } = await req.json();

    if (!imageBase64) {
      return new Response(JSON.stringify({ error: "Imagem é obrigatória" }), {
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
      imovel: `Você é um perito judicial especializado em avaliação de imóveis. Analise a imagem fornecida e produza uma descrição técnica detalhada para laudo pericial incluindo:
- Estado de conservação
- Materiais identificados
- Patologias construtivas (trincas, infiltrações, mofo, etc.)
- Acabamentos visíveis
- Estimativa de gravidade dos problemas encontrados
- Recomendações técnicas
Seja detalhado, técnico e objetivo. Responda em português do Brasil.`,
      acidente: `Você é um perito judicial especializado em acidentes de trânsito. Analise a imagem fornecida e produza uma descrição técnica detalhada para laudo pericial incluindo:
- Danos visíveis nos veículos/local
- Estimativa da dinâmica do acidente
- Marcas no pavimento (frenagem, derrapagem)
- Posicionamento dos veículos/objetos
- Sinalização visível
- Condições da via
Seja detalhado, técnico e objetivo. Responda em português do Brasil.`,
      grafotecnia: `Você é um perito grafotécnico judicial. Analise a imagem da assinatura/documento fornecida e produza uma descrição técnica detalhada para laudo pericial incluindo:
- Características gerais da escrita (pressão, velocidade, ritmo)
- Elementos genéticos (traçados, ligações, proporções)
- Elementos genéticos individuais
- Sinais de possível falsificação (tremores, retoques, hesitações)
- Qualidade do substrato e instrumento escritor
- Conclusão preliminar sobre autenticidade
Seja detalhado, técnico e objetivo. Responda em português do Brasil.`,
      documento: `Você é um perito judicial em documentoscopia. Analise a imagem do documento fornecida e produza uma descrição técnica detalhada para laudo pericial incluindo:
- Tipo de documento identificado
- Elementos de segurança visíveis
- Qualidade de impressão
- Sinais de adulteração ou manipulação
- Consistência tipográfica
- Estado de conservação
- Observações sobre autenticidade
Seja detalhado, técnico e objetivo. Responda em português do Brasil.`,
      geral: `Você é um perito judicial multidisciplinar. Analise a imagem fornecida e produza uma descrição técnica detalhada para laudo pericial incluindo:
- Descrição objetiva do conteúdo
- Elementos relevantes identificados
- Observações técnicas pertinentes
- Potencial valor probatório
- Recomendações para complementação
Seja detalhado, técnico e objetivo. Responda em português do Brasil.`,
    };

    const systemPrompt = systemPrompts[analysisType || "geral"] || systemPrompts.geral;

    const userContent: any[] = [
      { type: "text", text: context ? `Contexto adicional: ${context}\n\nAnalise a imagem a seguir:` : "Analise a imagem a seguir:" },
      { type: "image_url", image_url: { url: imageBase64 } },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("analyze-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro na análise" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
