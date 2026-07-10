import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeXml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function textToDocxParagraphs(text: string): string {
  return text.split("\n").map(line => {
    const trimmed = line.trim();
    if (!trimmed) return `<w:p><w:r><w:t></w:t></w:r></w:p>`;
    
    // Bold headers
    if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
      const clean = trimmed.slice(2, -2);
      return `<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(clean)}</w:t></w:r></w:p>`;
    }
    if (trimmed.startsWith("# ")) {
      return `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escapeXml(trimmed.slice(2))}</w:t></w:r></w:p>`;
    }
    if (trimmed.startsWith("## ")) {
      return `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>${escapeXml(trimmed.slice(3))}</w:t></w:r></w:p>`;
    }
    if (trimmed.startsWith("### ")) {
      return `<w:p><w:pPr><w:pStyle w:val="Heading3"/></w:pPr><w:r><w:t>${escapeXml(trimmed.slice(4))}</w:t></w:r></w:p>`;
    }
    if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
      return `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${escapeXml(trimmed.slice(2))}</w:t></w:r></w:p>`;
    }
    
    return `<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(trimmed)}</w:t></w:r></w:p>`;
  }).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { evidenceId } = await req.json();
    if (!evidenceId) {
      return new Response(JSON.stringify({ error: "ID da evidência é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: evidence } = await supabase
      .from("evidences")
      .select("*")
      .eq("id", evidenceId)
      .eq("user_id", user.id)
      .single();

    if (!evidence) {
      return new Response(JSON.stringify({ error: "Evidência não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    const peritoName = profile?.full_name || "Perito não identificado";
    const peritoReg = profile?.registration_number || "N/A";
    const peritoArea = profile?.area_of_expertise || "N/A";
    const peritoAddress = profile?.address || "N/A";
    const now = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

    const contentBody = textToDocxParagraphs(evidence.result_content || "Sem conteúdo de análise.");

    // Generate a simple DOCX (Office Open XML) as a flat XML document
    const docxContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:o="urn:schemas-microsoft-com:office:office">
  <w:body>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="36"/></w:rPr><w:t>LAUDO PERICIAL</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="20"/><w:color w:val="666666"/></w:rPr><w:t>Cortex Forense — Sistema de Perícia Digital</w:t></w:r>
    </w:p>
    <w:p/>

    <w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>1. PREÂMBULO</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">O presente laudo técnico-pericial foi elaborado pelo perito abaixo qualificado, utilizando metodologia científica e ferramentas computacionais forenses, com o objetivo de apresentar análise técnica sobre o objeto periciado.</w:t></w:r></w:p>
    <w:p/>

    <w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>2. QUALIFICAÇÃO DO PERITO</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Nome: ${escapeXml(peritoName)}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Registro Profissional: ${escapeXml(peritoReg)}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Área de Atuação: ${escapeXml(peritoArea)}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Endereço: ${escapeXml(peritoAddress)}</w:t></w:r></w:p>
    <w:p/>

    <w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>3. OBJETO DA PERÍCIA</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Título: ${escapeXml(evidence.title || "N/A")}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Módulo: ${escapeXml(evidence.module)}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Data do Registro: ${escapeXml(new Date(evidence.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }))}</w:t></w:r></w:p>
    ${evidence.file_hash ? `<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Hash de Integridade (SHA-256): ${escapeXml(evidence.file_hash)}</w:t></w:r></w:p>` : ""}
    ${evidence.tsa_timestamp ? `<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Carimbo de Tempo (TSA): ${escapeXml(evidence.tsa_timestamp)}</w:t></w:r></w:p>` : ""}
    ${evidence.blockchain_tx ? `<w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Registro Blockchain: ${escapeXml(evidence.blockchain_tx)}</w:t></w:r></w:p>` : ""}
    <w:p/>

    <w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>4. MATERIAL EXAMINADO</w:t></w:r></w:p>
    ${textToDocxParagraphs(evidence.input_content || "Material não especificado.")}
    <w:p/>

    <w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>5. METODOLOGIA</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">A análise foi realizada utilizando o sistema Cortex Forense, que emprega inteligência artificial e técnicas de computação forense para preservação e análise de evidências digitais. O sistema garante a cadeia de custódia através de hash SHA-256, carimbo de tempo RFC 3161 e ancoragem em blockchain.</w:t></w:r></w:p>
    <w:p/>

    <w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>6. ANÁLISE TÉCNICA E CONCLUSÕES</w:t></w:r></w:p>
    ${contentBody}
    <w:p/>

    <w:p><w:r><w:rPr><w:b/><w:sz w:val="28"/></w:rPr><w:t>7. ENCERRAMENTO</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">Nada mais havendo a relatar, dou por encerrado o presente laudo pericial, que vai por mim assinado.</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t xml:space="preserve">${escapeXml(now)}</w:t></w:r></w:p>
    <w:p/>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="24"/></w:rPr><w:t>_________________________________</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="24"/></w:rPr><w:t>${escapeXml(peritoName)}</w:t></w:r>
    </w:p>
    <w:p><w:pPr><w:jc w:val="center"/></w:pPr>
      <w:r><w:rPr><w:sz w:val="20"/></w:rPr><w:t>${escapeXml(peritoArea)} — Reg. ${escapeXml(peritoReg)}</w:t></w:r>
    </w:p>
  </w:body>
</w:wordDocument>`;

    // Log audit
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      action: "laudo_exported_docx",
      module: evidence.module,
      details: { evidenceId, format: "docx" },
    } as any);

    return new Response(docxContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.ms-word",
        "Content-Disposition": `attachment; filename="laudo-pericial-${evidenceId.slice(0, 8)}.doc"`,
      },
    });
  } catch (e) {
    console.error("export-laudo-docx error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro na exportação" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
