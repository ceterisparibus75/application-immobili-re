"use client";

import { useEffect, useRef } from "react";
import { formatCurrency } from "@/lib/utils";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapComparable {
  id: string;
  address: string;
  city: string;
  salePrice: number;
  pricePerSqm: number | null;
  builtArea: number | null;
  latitude: number | null;
  longitude: number | null;
  saleDate: string;
}

interface ComparablesMapProps {
  comparables: MapComparable[];
  buildingLat?: number | null;
  buildingLng?: number | null;
  buildingName?: string;
}

export function ComparablesMap({ comparables, buildingLat, buildingLng, buildingName }: ComparablesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const geoComparables = comparables.filter((c) => c.latitude && c.longitude);

  useEffect(() => {
    if (!mapRef.current || geoComparables.length === 0) return;

    // Destroy existing map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Center: building coords or first comparable
    const centerLat = buildingLat ?? geoComparables[0].latitude!;
    const centerLng = buildingLng ?? geoComparables[0].longitude!;

    const map = L.map(mapRef.current).setView([centerLat, centerLng], 14);
    mapInstanceRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Building marker (blue)
    if (buildingLat && buildingLng) {
      const buildingIcon = L.divIcon({
        className: "",
        html: `<div style="background:#1B4F8A;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      L.marker([buildingLat, buildingLng], { icon: buildingIcon })
        .addTo(map)
        .bindPopup(`<strong>${buildingName ?? "Bien évalué"}</strong>`);
    }

    // Comparable markers (orange)
    const compIcon = L.divIcon({
      className: "",
      html: `<div style="background:#E07B39;width:10px;height:10px;border-radius:50%;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2)"></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });

    const bounds = L.latLngBounds([]);
    if (buildingLat && buildingLng) {
      bounds.extend([buildingLat, buildingLng]);
    }

    for (const c of geoComparables) {
      const latlng: L.LatLngExpression = [c.latitude!, c.longitude!];
      bounds.extend(latlng);
      L.marker(latlng, { icon: compIcon })
        .addTo(map)
        .bindPopup(
          `<div style="font-size:12px;line-height:1.4">
            <strong>${c.address}</strong><br/>
            ${formatCurrency(c.salePrice)}${c.builtArea ? ` · ${c.builtArea} m²` : ""}
            ${c.pricePerSqm ? `<br/>${c.pricePerSqm} €/m²` : ""}
          </div>`
        );
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [geoComparables, buildingLat, buildingLng, buildingName]);

  if (geoComparables.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-brand overflow-hidden">
      <div className="p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
            <span className="inline-block w-3 h-3 rounded-full bg-[#1B4F8A] border-2 border-white shadow" /> Bien évalué
          </div>
          <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#E07B39] border-2 border-white shadow" /> Transactions comparables ({geoComparables.length})
          </div>
        </div>
      </div>
      <div ref={mapRef} style={{ height: 350 }} />
    </div>
  );
}
