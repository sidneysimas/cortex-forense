import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { GeoExifRecord, TILE_LAYERS, TileLayerKey } from "@/lib/geo-forensics";

// Fix default marker icon paths (Leaflet bundler quirk)
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [points, map]);
  return null;
}

type Props = {
  records: GeoExifRecord[];
  showTimeline?: boolean;
};

export default function GeoMap({ records, showTimeline = true }: Props) {
  const [layer, setLayer] = useState<TileLayerKey>("dark");
  const withGps = useMemo(
    () => records.filter((r) => r.lat != null && r.lng != null),
    [records]
  );
  const points = useMemo<[number, number][]>(
    () => withGps.map((r) => [r.lat!, r.lng!]),
    [withGps]
  );
  const timelinePath = useMemo<[number, number][]>(() => {
    return withGps
      .filter((r) => r.takenAt)
      .sort((a, b) => new Date(a.takenAt!).getTime() - new Date(b.takenAt!).getTime())
      .map((r) => [r.lat!, r.lng!]);
  }, [withGps]);

  if (withGps.length === 0) {
    return (
      <div className="flex items-center justify-center h-[500px] rounded-2xl border border-white/5 bg-white/[0.02] text-white/40 text-sm">
        Nenhuma imagem com coordenadas GPS foi encontrada.
      </div>
    );
  }

  const tile = TILE_LAYERS[layer];

  return (
    <div className="relative">
      <div className="absolute top-3 right-3 z-[400] flex flex-wrap gap-1 rounded-xl border border-white/10 bg-black/70 backdrop-blur-md p-1.5">
        {(Object.keys(TILE_LAYERS) as TileLayerKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setLayer(k)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium tracking-wide transition-all ${
              layer === k
                ? "bg-primary text-black"
                : "text-white/60 hover:text-white hover:bg-white/10"
            }`}
          >
            {TILE_LAYERS[k].name}
          </button>
        ))}
      </div>
      <MapContainer
        center={points[0]}
        zoom={12}
        className="h-[560px] rounded-2xl border border-white/5 overflow-hidden"
        style={{ background: "#020202" }}
      >
        <TileLayer url={tile.url} attribution={tile.attribution} />
        <FitBounds points={points} />
        {showTimeline && timelinePath.length > 1 && (
          <Polyline positions={timelinePath} pathOptions={{ color: "#facc15", weight: 2, dashArray: "6 6", opacity: 0.7 }} />
        )}
        {withGps.map((r, i) => (
          <Marker key={`${r.hash}-${i}`} position={[r.lat!, r.lng!]}>
            <Popup>
              <div className="text-xs space-y-1 min-w-[200px]">
                {r.thumbnailUrl && (
                  <img src={r.thumbnailUrl} alt={r.fileName} className="w-full max-h-32 object-cover rounded" />
                )}
                <div className="font-bold break-all">{r.fileName}</div>
                {r.takenAt && (
                  <div className="text-neutral-600">
                    {new Date(r.takenAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                  </div>
                )}
                <div className="text-neutral-500">
                  {r.lat!.toFixed(6)}, {r.lng!.toFixed(6)}
                  {r.altitude != null && ` · ${r.altitude.toFixed(0)}m`}
                </div>
                {(r.make || r.model) && (
                  <div className="text-neutral-500">{[r.make, r.model].filter(Boolean).join(" ")}</div>
                )}
                {r.anomalies.length > 0 && (
                  <div className="text-red-600 text-[10px] mt-1">
                    ⚠ {r.anomalies.join("; ")}
                  </div>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}