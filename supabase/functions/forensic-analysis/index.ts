import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { type, content, imageBase64, images } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    const messages: any[] = [];

    switch (type) {
      case "grafotecnia":
        systemPrompt = `Você é um perito grafotécnico judicial com formação em documentoscopia e grafoscopia, seguindo a metodologia científica de exame grafotécnico conforme as normas da ABNT NBR 13752 e as diretrizes da ASTM E444 (Standard Guide for Scope of Work of Forensic Document Examiners).

Ao receber imagens de assinaturas classificadas como "Padrão (Autêntica)" e "Questionada", realize uma análise comparativa completa seguindo estes critérios técnicos:

**1. GÊNESE GRÁFICA (elementos genéticos)**
- Calibre (tamanho absoluto e relativo das letras)
- Proporção entre zonas (superior, média, inferior)
- Inclinação axial (ângulo dos hastes em relação à linha de pauta)
- Alinhamento gráfico (ascendente, descendente, sinuoso, retilíneo)
- Espaçamento interliteral e interpalavras

**2. DINÂMICA DO TRAÇADO**
- Pressão (leve, média, forte; variações ao longo do traçado)
- Velocidade de execução (lenta, moderada, rápida)
- Progressão (movimento esquerda→direita, continuidade)
- Ritmo gráfico (regularidade vs. irregularidade)
- Qualidade do traço (firme, trêmulo, hesitante, pastoso)

**3. ELEMENTOS CONSTITUTIVOS**
- Ataques (início dos traços: apoiados, em gancho, acerados, em botão)
- Remates (finais dos traços: acerados, em clava, em gancho, retornados)
- Ligações (conexões entre letras e elementos)
- Ornamentos e particularismos (rubrica, parafe, floreios)

**4. ANÁLISE DE FALSIFICAÇÃO**
- Sinais de decalque (paradas abruptas, tremores mecânicos)
- Retoque ou sobrecarga de traços
- Hesitações (interrupções com acúmulo de tinta)
- Lentidão incompatível (traço vagaroso em elementos normalmente rápidos)
- Automatismo gráfico (presença ou ausência de naturalidade)
- Conformismo servil (cópia excessivamente fiel = indício de decalque)

**5. CONCLUSÃO TÉCNICA**
- Convergência ou divergência dos elementos analisados
- Grau de certeza: Positiva, Negativa ou Inconclusiva
- Justificativa técnica fundamentada

As imagens serão enviadas com rótulos: "PADRÃO (AUTÊNTICA)" ou "QUESTIONADA". Compare cada questionada contra o(s) padrão(ões).

Responda SEMPRE em português do Brasil, com linguagem técnica apropriada para laudo pericial judicial. Estruture o parecer em seções numeradas.`;
        break;

      case "hives":
        systemPrompt = `Você é um perito em informática forense especializado em análise de registros do Windows (Hives). Analise o conteúdo fornecido dos arquivos de registro e produza um relatório técnico incluindo:
- Identificação do tipo de hive (SAM, SYSTEM, SOFTWARE, NTUSER, etc.)
- Artefatos encontrados (usuários, programas instalados, dispositivos USB, execuções)
- Timeline de eventos relevantes
- Evidências de atividade suspeita ou relevante
- Conclusões técnicas
Responda sempre em português do Brasil, com linguagem técnica apropriada para laudo pericial.`;
        break;

      case "documental":
        systemPrompt = `Você é um perito judicial especialista em análise documental. Analise o documento/texto fornecido e produza uma análise técnica incluindo:
- Identificação dos pontos controvertidos
- Extração de dados relevantes (valores, datas, partes envolvidas)
- Análise de inconsistências ou irregularidades
- Resumo estruturado dos fatos
- Sugestões de quesitos a serem respondidos
Responda sempre em português do Brasil, com linguagem técnica apropriada para laudo pericial.`;
        break;

      case "laudo":
        systemPrompt = `Você é um perito judicial experiente. Com base nas informações e evidências fornecidas, gere um laudo técnico pericial completo e estruturado seguindo o padrão dos tribunais brasileiros:
1. PREÂMBULO (identificação do perito, processo, partes)
2. HISTÓRICO E OBJETO DA PERÍCIA
3. METODOLOGIA UTILIZADA
4. EXAME E ANÁLISE DAS EVIDÊNCIAS
5. RESPOSTAS AOS QUESITOS (se aplicável)
6. CONCLUSÃO TÉCNICA
7. ENCERRAMENTO
Use linguagem formal, técnica e imparcial. Responda sempre em português do Brasil.`;
        break;

      case "plagio-codigo":
        systemPrompt = `Você é um perito judicial em informática forense com especialização em crimes de plágio de software e propriedade intelectual. Realiza análises para processos judiciais e administrativos conforme as normas ABNT NBR ISO/IEC 27037.

INSTRUÇÃO ESTRUTURAL OBRIGATÓRIA:
Sua resposta DEVE começar exatamente assim (duas primeiras linhas):
VEREDITO: [CULPADO | SUSPEITO | NÃO CULPADO]
SIMILARIDADE: [0-100]%

Definições de veredito:
- CULPADO: similaridade algorítmica ≥70% ou evidências claras de cópia/tradução de código
- SUSPEITO: similaridade 30-69% ou padrões arquiteturais idênticos sem justificativa
- NÃO CULPADO: similaridade <30% e sem evidências de apropriação indevida

Após o cabeçalho obrigatório, produza o parecer técnico nas seguintes seções:

1. IDENTIFICAÇÃO DO CASO
   - Repositório A (referência) e B (suspeito)
   - Linguagens identificadas em cada repositório
   - Quantidade de arquivos analisados

2. ANÁLISE COMPARATIVA DE LÓGICA ALGORÍTMICA
   - Compare fluxos de controle, estruturas de dados e padrões arquiteturais
   - Detecte plágio cross-language (ex: Python traduzido para JS, Java reescrito em C#)
   - Identifique lógicas não-padrão ou custom que não seriam coincidentes

3. TÉCNICAS DE OFUSCAÇÃO DETECTADAS
   - Renomeação de variáveis/funções
   - Reordenação de blocos de código
   - Inversão de condições lógicas
   - Mudança de linguagem ou paradigma (OO → funcional)
   - Fragmentação ou fusão de funções

4. EVIDÊNCIAS POR ARQUIVO
   Para cada arquivo com similaridade relevante, indique:
   - Arquivo A vs Arquivo B
   - Nível de similaridade do par
   - Trecho representativo com explicação

5. ANÁLISE DE ESTILO E PADRÕES
   - Convenções de nomenclatura
   - Comentários e docstrings
   - Estrutura de diretórios e organização

6. CONCLUSÃO TÉCNICA FUNDAMENTADA
   - Síntese das evidências
   - Grau de certeza da conclusão
   - Recomendações para o processo

Responda sempre em português do Brasil, com linguagem técnica e imparcial apropriada para laudo pericial judicial.`;
        break;

      case "email-pst":
        systemPrompt = `Você é um perito em informática forense especializado em análise de e-mails e arquivos PST (Personal Storage Table) do Microsoft Outlook. Analise o conteúdo fornecido e produza um parecer técnico forense detalhado incluindo:

**ANÁLISE DE METADADOS:**
- Cabeçalhos completos (From, To, CC, BCC, Date, Subject)
- Endereços IP e rotas de entrega (Received headers)
- Message-ID, In-Reply-To, References
- Servidores SMTP envolvidos na cadeia de entrega
- Timestamps e fusos horários

**ANÁLISE DE CONTEÚDO:**
- Resumo do conteúdo das mensagens
- Palavras-chave e termos relevantes identificados
- Padrões de comunicação entre as partes
- Anexos mencionados ou identificados
- Links e URLs presentes

**TIMELINE DE COMUNICAÇÕES:**
- Cronologia detalhada das trocas de mensagens
- Intervalos entre respostas
- Horários habituais de comunicação
- Períodos de atividade intensa ou inatividade

**DETECÇÃO DE MANIPULAÇÃO:**
- Sinais de adulteração de cabeçalhos
- Inconsistências em timestamps
- Evidências de edição ou exclusão de mensagens
- Análise de integridade dos dados
- Verificação de autenticidade (SPF, DKIM, DMARC se disponível)

Responda sempre em português do Brasil, com linguagem técnica apropriada para laudo pericial. Estruture o parecer em seções claras com numeração.`;
        break;

      default:
        return new Response(JSON.stringify({ error: "Tipo de análise não reconhecido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Build user message — support multiple labeled images for grafotecnia
    if (Array.isArray(images) && images.length > 0) {
      const parts: any[] = [
        { type: "text", text: content || "Analise e compare as assinaturas a seguir." },
      ];
      for (const img of images) {
        const labelText = img.label === "padrao" ? "PADRÃO (AUTÊNTICA)" : "QUESTIONADA";
        parts.push({ type: "text", text: `\n--- Imagem: ${labelText} (${img.fileName || "sem nome"}) ---` });
        parts.push({ type: "image_url", image_url: { url: img.base64 } });
      }
      messages.push({ role: "user", content: parts });
    } else if (imageBase64) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: content || "Analise esta imagem." },
          { type: "image_url", image_url: { url: imageBase64 } },
        ],
      });
    } else {
      messages.push({ role: "user", content: content });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.5",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
        max_completion_tokens: 16000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("forensic-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
