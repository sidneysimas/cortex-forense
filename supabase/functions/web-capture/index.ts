import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function resolveDns(hostname: string) {
  try {
    const records = await Deno.resolveDns(hostname, "A");
    return records;
  } catch {
    return [];
  }
}

async function getWhoisInfo(hostname: string) {
  try {
    // Use a public WHOIS API
    const resp = await fetch(`https://whois.freeaitools.org/api/whois?domain=${hostname}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.json();
      return data;
    }
  } catch { /* ignore */ }
  return null;
}

function formatBrasiliaIsoOffset(date: Date): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}-03:00`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error("Protocolo inválido");
    } catch {
      return new Response(JSON.stringify({ error: "URL inválida. Use http:// ou https://" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

     const now = new Date();
     const captureTimestamp = now.toISOString();
     const brTimestamp = formatBrasiliaIsoOffset(now);
    const hostname = parsedUrl.hostname;

    // Parallel: DNS + WHOIS + Page fetch + Screenshot
    const screenshotPromise = (async () => {
      try {
        const resp = await fetch(`https://image.thum.io/get/width/1280/crop/900/noanimate/${url}`, {
          signal: AbortSignal.timeout(15000),
        });
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          return `data:image/png;base64,${btoa(binary)}`;
        }
      } catch { /* ignore */ }
      return null;
    })();

    const [dnsRecords, whoisData, pageResponse, screenshotBase64] = await Promise.all([
      resolveDns(hostname),
      getWhoisInfo(hostname),
      fetch(url, {
        headers: {
          "User-Agent": "CortexForense-WebCapture/2.0",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
        redirect: "follow",
      }),
      screenshotPromise,
    ]);

    const finalUrl = pageResponse.url;
    const statusCode = pageResponse.status;
    const responseHeaders: Record<string, string> = {};
    pageResponse.headers.forEach((v, k) => { responseHeaders[k] = v; });

    const htmlContent = await pageResponse.text();

    // SSL certificate info
    const sslInfo: Record<string, string> = {};
    if (parsedUrl.protocol === "https:") {
      sslInfo.protocol = "TLS";
      sslInfo.issuer = responseHeaders["x-ssl-issuer"] || "N/A (não disponível via fetch)";
      sslInfo.secure = "true";
    }

    // Extract metadata from HTML
    const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "Sem título";
    const metaDescMatch = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
    const description = metaDescMatch ? metaDescMatch[1].trim() : "";

    // Extract text content
    const textContent = htmlContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 10000);

    // SHA-256 hash
    const encoder = new TextEncoder();
    const data = encoder.encode(htmlContent);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const contentHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    const captureId = crypto.randomUUID();

    // AI analysis
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let aiAnalysis = "";
    if (LOVABLE_API_KEY) {
      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: `Você é um assistente forense especializado em análise de conteúdo web para fins de preservação de provas digitais. Analise o conteúdo capturado e produza um resumo técnico incluindo:
- Descrição do conteúdo da página
- Tipo de conteúdo identificado
- Elementos relevantes encontrados
- Observações sobre a autenticidade e integridade do conteúdo
- Recomendações para uso como prova digital
Seja conciso e técnico. Responda em português do Brasil.`,
              },
              {
                role: "user",
                content: `URL capturada: ${finalUrl}\nTítulo: ${title}\nDescrição: ${description}\nIPs: ${dnsRecords.join(", ")}\n\nConteúdo extraído (primeiros 5000 caracteres):\n${textContent.slice(0, 5000)}`,
              },
            ],
          }),
        });
        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiAnalysis = aiData.choices?.[0]?.message?.content || "";
        }
      } catch { /* continue without AI */ }
    }

    const result = {
      captureId,
       timestamp: captureTimestamp,
       timestampBR: brTimestamp,
      originalUrl: url,
      finalUrl,
      statusCode,
      title,
      description,
      contentHash,
      contentLength: htmlContent.length,
      textPreview: textContent.slice(0, 2000),
      responseHeaders,
      aiAnalysis,
      screenshotBase64,
      dnsRecords,
      serverIp: dnsRecords[0] || "N/A",
      whoisData: whoisData ? {
        registrar: whoisData.registrar || whoisData.Registrar || "N/A",
        creationDate: whoisData.creation_date || whoisData.CreationDate || "N/A",
        expirationDate: whoisData.expiration_date || whoisData.ExpirationDate || "N/A",
        nameServers: whoisData.name_servers || whoisData.NameServers || [],
      } : null,
      sslInfo,
      htmlSnapshot: htmlContent.slice(0, 50000),
      metadata: {
        captureAgent: "CortexForense-WebCapture/2.0",
        hashAlgorithm: "SHA-256",
        captureMethod: "HTTP GET with redirect follow",
        dnsLookup: true,
        whoisLookup: !!whoisData,
        sslCheck: parsedUrl.protocol === "https:",
        screenshotCaptured: !!screenshotBase64,
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("web-capture error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro na captura" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
