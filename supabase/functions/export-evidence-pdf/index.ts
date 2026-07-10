import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatBrt(date?: string | null, brt?: string | null): string {
  if (brt) return brt;
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return `${parsed.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} (BRT)`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { evidenceId } = await req.json();

    // Fetch evidence + profile in parallel
    const [evidenceResult, profileResult] = await Promise.all([
      supabase.from("evidences").select("*").eq("id", evidenceId).eq("user_id", user.id).single(),
      supabase.from("profiles").select("*").eq("id", user.id).single(),
    ]);

    const evidence = evidenceResult.data;
    const profile = profileResult.data;

    if (!evidence) {
      return new Response(JSON.stringify({ error: "Evidência não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Helper: download image from storage and convert to base64 data URI
    async function storageImageToBase64(storagePath: string): Promise<string> {
      try {
        const { data, error } = await supabaseAdmin.storage
          .from("forensic-files")
          .download(storagePath);
        if (error || !data) return "";
        const arrayBuf = await data.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        const mime = data.type || "image/png";
        return `data:${mime};base64,${b64}`;
      } catch {
        return "";
      }
    }

    // Pre-fetch all grafotecnia images as base64 for embedding
    const grafImgs = evidence.metadata?.grafotecniaImages || [];
    const imgBase64Map = new Map<string, string>();
    await Promise.all(
      grafImgs.map(async (img: any) => {
        if (img.storagePath) {
          const b64 = await storageImageToBase64(img.storagePath);
          if (b64) imgBase64Map.set(img.storagePath, b64);
        }
      })
    );

    const moduleLabels: Record<string, string> = {
      grafotecnia: "Grafotecnia",
      hives: "Leitura de Hives",
      documental: "Análise Documental",
      laudo: "Geração de Laudos",
      "plagio-codigo": "Plágio de Código",
      "email-pst": "Análise de E-mails",
      "web-capture": "Captura Web",
    };

    const appUrl = "https://digital-truth-uncovered.lovable.app";
    const verificationUrl = evidence.verification_url || `${appUrl}/verify?id=${evidence.id}`;
    const qrDataUri = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&format=png&data=${encodeURIComponent(verificationUrl)}`;

    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const timeStr = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const evidenceCreatedAtBrt = formatBrt(evidence.created_at, evidence.created_at_brt || evidence.metadata?.iso27037?.chainOfCustody?.acquisitionTimeBR);

    // Generate HTML-based PDF content
    const htmlPdf = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 2cm; size: A4; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; line-height: 1.5; }
  .header { text-align: center; border-bottom: 3px solid #E87C1E; padding-bottom: 15px; margin-bottom: 20px; }
  .header h1 { font-size: 20pt; color: #E87C1E; margin: 0; }
  .header h2 { font-size: 12pt; color: #666; margin: 5px 0 0; font-weight: normal; }
  .section { margin-bottom: 18px; }
  .section-title { font-size: 12pt; font-weight: bold; color: #E87C1E; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-bottom: 8px; }
  .field { margin-bottom: 4px; }
  .field-label { font-weight: bold; color: #444; }
  .hash-box { background: #f5f5f5; border: 1px solid #ddd; padding: 8px; font-family: 'Courier New', monospace; font-size: 8pt; word-break: break-all; border-radius: 4px; }
  .content-box { background: #fafafa; border: 1px solid #eee; padding: 10px; font-size: 9pt; max-height: 300px; overflow: hidden; border-radius: 4px; white-space: pre-wrap; }
  .footer { margin-top: 30px; border-top: 2px solid #E87C1E; padding-top: 10px; text-align: center; font-size: 8pt; color: #888; }
  .qr-section { display: flex; align-items: center; gap: 15px; margin-top: 15px; padding: 10px; background: #f9f9f9; border-radius: 8px; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 48pt; color: rgba(232, 124, 30, 0.06); font-weight: bold; white-space: nowrap; pointer-events: none; z-index: -1; }
  .qr-text { font-size: 8pt; color: #666; }
  .cert-badge { display: inline-block; background: #E87C1E; color: white; padding: 3px 10px; border-radius: 4px; font-size: 9pt; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 3px 5px; vertical-align: top; }
  td:first-child { width: 140px; font-weight: bold; color: #444; }
</style>
</head>
<body>

<div class="header">
  <h1>CORTEX FORENSE</h1>
  <h2>Relatório de Evidência Digital</h2>
  <div style="margin-top: 8px;">
    <span class="cert-badge">DOCUMENTO CERTIFICADO</span>
  </div>
</div>

<div class="section">
  <div class="section-title">1. IDENTIFICAÇÃO</div>
  <table>
    <tr><td>ID da Evidência:</td><td>${evidence.id}</td></tr>
    <tr><td>Módulo:</td><td>${moduleLabels[evidence.module] || evidence.module}</td></tr>
    <tr><td>Título:</td><td>${evidence.title || "—"}</td></tr>
    <tr><td>Data de Registro:</td><td>${evidenceCreatedAtBrt}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">2. PERITO RESPONSÁVEL</div>
  <table>
    <tr><td>Nome:</td><td>${profile?.full_name || "N/A"}</td></tr>
    <tr><td>Registro:</td><td>${profile?.registration_number || "N/A"}</td></tr>
    <tr><td>Área:</td><td>${profile?.area_of_expertise || "N/A"}</td></tr>
    <tr><td>E-mail:</td><td>${user.email}</td></tr>
  </table>
</div>

<div class="section">
  <div class="section-title">3. INTEGRIDADE</div>
  <div class="field"><span class="field-label">Hash SHA-256:</span></div>
  <div class="hash-box">${evidence.file_hash || "N/A"}</div>
  ${evidence.tsa_timestamp ? `
  <div class="field" style="margin-top: 8px;"><span class="field-label">Carimbo de Tempo (TSA):</span> ${formatBrt(evidence.tsa_timestamp)}</div>
  ` : ""}
  ${evidence.blockchain_tx ? `
  <div class="field"><span class="field-label">Ancoragem Blockchain:</span> ${evidence.blockchain_tx}</div>
  <div class="field"><span class="field-label">Rede:</span> ${evidence.blockchain_network}</div>
  ` : ""}
</div>

${evidence.metadata?.screenshotBase64 ? `
<div class="section">
  <div class="section-title">4. SCREENSHOT DA CAPTURA</div>
  <div style="text-align:center;"><img src="${evidence.metadata.screenshotBase64}" style="max-width:100%; border:1px solid #ddd; border-radius:4px;" alt="Screenshot"/></div>
</div>
` : ""}

${(evidence.metadata?.grafotecniaImages && evidence.metadata.grafotecniaImages.length > 0) ? `
<div class="section" style="page-break-before: auto;">
  <div class="section-title">${evidence.metadata?.screenshotBase64 ? "5" : "4"}. IMAGENS ANALISADAS (EXAME GRAFOTÉCNICO)</div>
  <p style="font-size:9pt; color:#666; margin-bottom:10px;">
    Imagens submetidas ao exame grafotécnico para confronto de assinaturas conforme metodologia pericial.
  </p>
  <table style="width:100%; border-collapse:collapse;">
    ${(() => {
      const imgs = evidence.metadata.grafotecniaImages;
      const padraoImgs = imgs.filter((i: any) => i.label === "padrao");
      const questionadaImgs = imgs.filter((i: any) => i.label === "questionada");
      
      let html = "";
      
      if (padraoImgs.length > 0) {
        html += '<tr><td colspan="2" style="padding:8px 0 4px; font-weight:bold; color:#2E7D32; font-size:10pt; border-bottom:1px solid #ddd;">Assinatura(s) Padrão (Autêntica/Referência)</td></tr>';
        padraoImgs.forEach((img: any, idx: number) => {
          const imgSrc = (img.storagePath && imgBase64Map.get(img.storagePath)) || img.url || img.base64 || "";
          html += '<tr><td colspan="2" style="padding:8px; text-align:center; border:1px solid #eee; background:#fafafa;">';
          html += '<img src="' + imgSrc + '" style="max-width:90%; max-height:250px; border:1px solid #ddd; border-radius:4px;" alt="Padrão ' + (idx + 1) + '" crossorigin="anonymous" />';
          html += '<div style="font-size:8pt; color:#666; margin-top:4px;">Padrão #' + (idx + 1) + ' — ' + (img.fileName || "sem nome") + '</div>';
          if (img.hash) { html += '<div style="font-size:7pt; color:#999; font-family:monospace;">SHA-256: ' + img.hash + '</div>'; }
          html += '</td></tr>';
        });
      }
      
      if (questionadaImgs.length > 0) {
        html += '<tr><td colspan="2" style="padding:12px 0 4px; font-weight:bold; color:#E65100; font-size:10pt; border-bottom:1px solid #ddd;">Assinatura(s) Questionada(s)</td></tr>';
        questionadaImgs.forEach((img: any, idx: number) => {
          const imgSrc = (img.storagePath && imgBase64Map.get(img.storagePath)) || img.url || img.base64 || "";
          html += '<tr><td colspan="2" style="padding:8px; text-align:center; border:1px solid #eee; background:#fafafa;">';
          html += '<img src="' + imgSrc + '" style="max-width:90%; max-height:250px; border:1px solid #ddd; border-radius:4px;" alt="Questionada ' + (idx + 1) + '" crossorigin="anonymous" />';
          html += '<div style="font-size:8pt; color:#666; margin-top:4px;">Questionada #' + (idx + 1) + ' — ' + (img.fileName || "sem nome") + '</div>';
          if (img.hash) { html += '<div style="font-size:7pt; color:#999; font-family:monospace;">SHA-256: ' + img.hash + '</div>'; }
          html += '</td></tr>';
        });
      }
      
      return html;
    })()}
  </table>
</div>
` : ""}

${(() => {
      let s = evidence.metadata?.screenshotBase64 ? 5 : 4;
      if (evidence.metadata?.grafotecniaImages?.length > 0) s++;
      return `<div class="section">
  <div class="section-title">${s}. DADOS DE ENTRADA</div>
  <div class="content-box">${(evidence.input_content || "—").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
</div>

<div class="section">
  <div class="section-title">${s + 1}. RESULTADO DA ANÁLISE</div>
  <div class="content-box">${(evidence.result_content || "—").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
</div>

<div class="section">
  <div class="section-title">${s + 2}. VERIFICAÇÃO</div>
  <div class="qr-section">
    <img src="${qrDataUri}" width="120" height="120" alt="QR Code de Verificação" />
    <div class="qr-text">
      <strong>QR Code de Verificação</strong><br/>
      Escaneie para verificar a autenticidade deste documento.<br/>
      URL: ${verificationUrl}<br/>
      ID: ${evidence.id}
    </div>
  </div>
</div>`;
    })()}

<div class="watermark">CORTEX FORENSE — DOCUMENTO OFICIAL</div>

<div class="footer">
  <p>Documento gerado por <strong>Cortex Forense</strong> em ${dateStr} às ${timeStr}</p>
  <p>Este relatório contém hash de integridade SHA-256 para verificação de autenticidade.</p>
  <p>A verificação pode ser realizada através do QR Code acima ou pela URL informada.</p>
</div>

</body>
</html>`;

    return new Response(JSON.stringify({
      html: htmlPdf,
      filename: `evidencia-${evidence.id.slice(0, 8)}-${dateStr.replace(/\//g, "-")}.html`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("export-pdf error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro na exportação" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
