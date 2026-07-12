import exifr from "exifr";

export type GeoExifRecord = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  hash: string;
  lat: number | null;
  lng: number | null;
  altitude: number | null;
  takenAt: string | null; // ISO
  make: string | null;
  model: string | null;
  lens: string | null;
  software: string | null;
  orientation: number | null;
  width: number | null;
  height: number | null;
  iso: number | null;
  fNumber: number | null;
  exposureTime: number | null;
  focalLength: number | null;
  thumbnailUrl: string | null;
  anomalies: string[];
  raw: Record<string, unknown>;
};

async function sha256(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function detectAnomalies(r: Partial<GeoExifRecord>, hasExif: boolean): string[] {
  const out: string[] = [];
  if (!hasExif) out.push("EXIF ausente ou removido (possível saneamento de metadados)");
  if (r.software && /photoshop|gimp|lightroom|snapseed|facetune|ai|stable diffusion|midjourney/i.test(r.software)) {
    out.push(`Editado por software: ${r.software}`);
  }
  if (r.takenAt) {
    const t = new Date(r.takenAt).getTime();
    if (isNaN(t)) out.push("Timestamp EXIF inválido");
    else if (t > Date.now() + 3600_000) out.push("Timestamp futuro (inconsistente)");
  }
  if (r.lat != null && (r.lat < -90 || r.lat > 90)) out.push("Latitude fora de faixa válida");
  if (r.lng != null && (r.lng < -180 || r.lng > 180)) out.push("Longitude fora de faixa válida");
  if ((r.lat === 0 && r.lng === 0)) out.push("Coordenada 0,0 (Null Island — provável reset)");
  return out;
}

export async function parseImageFile(file: File): Promise<GeoExifRecord> {
  const buf = await file.arrayBuffer();
  const hash = await sha256(buf);

  let exif: any = null;
  let hasExif = false;
  try {
    exif = await exifr.parse(buf, {
      gps: true,
      tiff: true,
      exif: true,
      xmp: true,
      icc: false,
      iptc: true,
      translateValues: true,
      reviveValues: true,
    } as any);
    hasExif = !!exif && Object.keys(exif).length > 0;
  } catch {
    exif = null;
  }

  let thumbnailUrl: string | null = null;
  try {
    const thumb = await exifr.thumbnail(buf);
    if (thumb) {
      const blob = new Blob([thumb as unknown as BlobPart], { type: "image/jpeg" });
      thumbnailUrl = URL.createObjectURL(blob);
    }
  } catch {}

  const lat = exif?.latitude ?? exif?.GPSLatitude ?? null;
  const lng = exif?.longitude ?? exif?.GPSLongitude ?? null;
  const takenAt =
    exif?.DateTimeOriginal || exif?.CreateDate || exif?.ModifyDate || null;

  const rec: GeoExifRecord = {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    hash,
    lat: typeof lat === "number" ? lat : null,
    lng: typeof lng === "number" ? lng : null,
    altitude: typeof exif?.GPSAltitude === "number" ? exif.GPSAltitude : null,
    takenAt: takenAt ? new Date(takenAt).toISOString() : null,
    make: exif?.Make ?? null,
    model: exif?.Model ?? null,
    lens: exif?.LensModel ?? exif?.Lens ?? null,
    software: exif?.Software ?? null,
    orientation: exif?.Orientation ?? null,
    width: exif?.ExifImageWidth ?? exif?.ImageWidth ?? null,
    height: exif?.ExifImageHeight ?? exif?.ImageHeight ?? null,
    iso: exif?.ISO ?? null,
    fNumber: exif?.FNumber ?? null,
    exposureTime: exif?.ExposureTime ?? null,
    focalLength: exif?.FocalLength ?? null,
    thumbnailUrl,
    anomalies: [],
    raw: exif || {},
  };
  rec.anomalies = detectAnomalies(rec, hasExif);
  return rec;
}

export function buildGeoReport(records: GeoExifRecord[]) {
  const withGps = records.filter((r) => r.lat != null && r.lng != null);
  const withTime = records.filter((r) => r.takenAt);
  const anomalies = records.filter((r) => r.anomalies.length > 0);

  const devices = new Map<string, number>();
  const softwares = new Map<string, number>();
  for (const r of records) {
    const dev = [r.make, r.model].filter(Boolean).join(" ") || "Desconhecido";
    devices.set(dev, (devices.get(dev) || 0) + 1);
    if (r.software) softwares.set(r.software, (softwares.get(r.software) || 0) + 1);
  }

  const timeline = withTime
    .map((r) => ({ file: r.fileName, at: r.takenAt!, lat: r.lat, lng: r.lng }))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return {
    totalFiles: records.length,
    withGps: withGps.length,
    withTimestamp: withTime.length,
    anomaliesCount: anomalies.length,
    devices: Array.from(devices.entries()).map(([k, v]) => ({ device: k, count: v })),
    softwares: Array.from(softwares.entries()).map(([k, v]) => ({ software: k, count: v })),
    timeline,
    bbox: withGps.length
      ? {
          minLat: Math.min(...withGps.map((r) => r.lat!)),
          maxLat: Math.max(...withGps.map((r) => r.lat!)),
          minLng: Math.min(...withGps.map((r) => r.lng!)),
          maxLng: Math.max(...withGps.map((r) => r.lng!)),
        }
      : null,
    files: records.map((r) => ({
      fileName: r.fileName,
      hash: r.hash,
      size: r.fileSize,
      lat: r.lat,
      lng: r.lng,
      takenAt: r.takenAt,
      device: [r.make, r.model].filter(Boolean).join(" ") || null,
      software: r.software,
      anomalies: r.anomalies,
    })),
  };
}

export const TILE_LAYERS = {
  dark: {
    name: "Forense Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
  light: {
    name: "Forense Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
  street: {
    name: "Ruas (OSM)",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  satellite: {
    name: "Satélite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
  },
  topo: {
    name: "Topográfico",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenTopoMap (CC-BY-SA)",
  },
  humanitarian: {
    name: "Humanitário",
    url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap France (HOT)",
  },
} as const;

export type TileLayerKey = keyof typeof TILE_LAYERS;