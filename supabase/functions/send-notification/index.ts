import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { type, recipientEmail, subject, body, evidenceId, caseId } = await req.json();
    if (!subject || !body) return new Response(JSON.stringify({ error: "subject e body são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Get SMTP config
    const { data: smtpConfig } = await supabase
      .from("smtp_config")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!smtpConfig) {
      return new Response(JSON.stringify({ error: "SMTP não configurado. Acesse Configurações de E-mail." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipient = recipientEmail || smtpConfig.from_email;

    // Log notification
    const { data: notif } = await supabase.from("notification_queue").insert({
      user_id: user.id,
      notification_type: type || "general",
      recipient_email: recipient,
      subject,
      body,
      status: "pending",
      evidence_id: evidenceId || null,
      case_id: caseId || null,
    }).select("id").single();

    // Send via SMTP using Deno's built-in SMTP
    try {
      const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

      const client = new SMTPClient({
        connection: {
          hostname: smtpConfig.smtp_host,
          port: smtpConfig.smtp_port,
          tls: smtpConfig.use_tls,
          auth: {
            username: smtpConfig.smtp_user,
            password: smtpConfig.smtp_pass,
          },
        },
      });

      const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; background: #0f1520; color: #e0e0e0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: #1a2030; border-radius: 12px; padding: 30px; border: 1px solid #2a3040;">
    <div style="text-align: center; margin-bottom: 24px;">
      <h1 style="color: #e67e22; font-size: 20px; margin: 0;">CORTEX FORENSE</h1>
    </div>
    <h2 style="color: #fff; font-size: 16px; margin: 0 0 16px;">${subject}</h2>
    <div style="color: #c0c0c0; font-size: 14px; line-height: 1.6;">
      ${body.replace(/\n/g, "<br>")}
    </div>
    <hr style="border: none; border-top: 1px solid #2a3040; margin: 24px 0;">
    <p style="text-align: center; font-size: 11px; color: #666;">
      Enviado automaticamente por Cortex Forense • ${new Date().toLocaleString("pt-BR")}
    </p>
  </div>
</body>
</html>`;

      await client.send({
        from: `${smtpConfig.from_name} <${smtpConfig.from_email}>`,
        to: recipient,
        subject: subject,
        content: "auto",
        html: htmlBody,
      });

      await client.close();

      // Update status
      if (notif) {
        await supabase.from("notification_queue")
          .update({ status: "sent", sent_at: new Date().toISOString() } as any)
          .eq("id", notif.id);
      }

      return new Response(JSON.stringify({ success: true, message: "E-mail enviado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (smtpError: any) {
      // Update status to failed
      if (notif) {
        await supabase.from("notification_queue")
          .update({ status: "failed", error_message: smtpError.message } as any)
          .eq("id", notif.id);
      }
      throw new Error(`Falha SMTP: ${smtpError.message}`);
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
