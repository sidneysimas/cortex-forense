import { supabase } from "@/integrations/supabase/client";
import { generateSHA256 } from "@/lib/audit";

/**
 * Uploads an image (base64 or blob) to forensic-files bucket
 * and returns the storage path + hash for chain of custody.
 */
export async function uploadEvidenceImage({
  base64,
  fileName,
  module,
  label,
  evidenceId,
}: {
  base64: string;
  fileName: string;
  module: string;
  label?: string;
  evidenceId?: string;
}): Promise<{ path: string; hash: string; url: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Convert base64 to blob
  const res = await fetch(base64);
  const blob = await res.blob();

  // Generate hash of the image content
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const hashHex = await generateSHA256(
    Array.from(bytes).map(b => String.fromCharCode(b)).join("")
  );

  // Build path: user_id/module/timestamp_label_filename
  const ts = Date.now();
  const labelPart = label ? `_${label}` : "";
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${user.id}/${module}/${ts}${labelPart}_${safeName}`;

  const { error } = await supabase.storage
    .from("forensic-files")
    .upload(storagePath, blob, {
      contentType: blob.type || "image/png",
      upsert: false,
    });

  if (error) {
    console.error("Failed to upload evidence image:", error);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from("forensic-files")
    .getPublicUrl(storagePath);

  return {
    path: storagePath,
    hash: hashHex,
    url: urlData.publicUrl,
  };
}

/**
 * Uploads multiple evidence images in parallel and returns their metadata.
 */
export async function uploadEvidenceImages({
  images,
  module,
  evidenceId,
}: {
  images: { base64: string; fileName: string; label?: string }[];
  module: string;
  evidenceId?: string;
}): Promise<{ path: string; hash: string; url: string; fileName: string; label?: string }[]> {
  const results = await Promise.all(
    images.map(async (img) => {
      const result = await uploadEvidenceImage({
        base64: img.base64,
        fileName: img.fileName,
        module,
        label: img.label,
        evidenceId,
      });
      if (result) {
        return { ...result, fileName: img.fileName, label: img.label };
      }
      return null;
    })
  );

  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

/**
 * Uploads a canvas result as evidence image
 */
export async function uploadCanvasAsEvidence({
  canvas,
  fileName,
  module,
  label,
}: {
  canvas: HTMLCanvasElement;
  fileName: string;
  module: string;
  label?: string;
}): Promise<{ path: string; hash: string; url: string } | null> {
  return new Promise((resolve) => {
    canvas.toBlob(async (blob) => {
      if (!blob) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const result = await uploadEvidenceImage({
          base64,
          fileName,
          module,
          label,
        });
        resolve(result);
      };
      reader.readAsDataURL(blob);
    }, "image/png");
  });
}
