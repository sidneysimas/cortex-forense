import { supabase } from "@/integrations/supabase/client";

export async function sendNotification({
  type,
  subject,
  body,
  evidenceId,
  caseId,
}: {
  type: string;
  subject: string;
  body: string;
  evidenceId?: string;
  caseId?: string;
}) {
  try {
    // Check if SMTP is configured before attempting
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: smtpConfig } = await supabase
      .from("smtp_config")
      .select("id, is_verified")
      .eq("user_id", user.id)
      .maybeSingle();

    // Silently skip if SMTP not configured
    if (!smtpConfig) return;

    await supabase.functions.invoke("send-notification", {
      body: { type, subject, body, evidenceId, caseId },
    });
  } catch {
    // Fail silently — notifications are non-critical
    console.warn("Notification send failed (non-critical)");
  }
}
