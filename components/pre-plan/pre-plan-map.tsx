"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Maximize2 } from "lucide-react";
import type { FieldFeature, FieldFeatureCollection } from "@/lib/work-program/analytics";
import type { GeoJsonObject } from "geojson";
import type * as Leaflet from "leaflet";
import styles from "./pre-plan.module.css";

export type PrePlanMapHandle = { fieldAtPoint: (x: number, y: number) => string | undefined };

type Props = {
  fieldMap: FieldFeatureCollection;
  counts: Record<string, number>;
  selectedField: string;
  hoverField: string;
  mapHandle: Ref<PrePlanMapHandle>;
  onSelect: (id: string) => void;
};

export function PrePlanMap(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const fieldLayers = useRef(new Map<string, Leaflet.Path>());
  const boundsRef = useRef<Leaflet.LatLngBounds | null>(null);
  const visibleLabels = useRef(new Set<string>());
  const latest = useRef(props);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [showAllLabels, setShowAllLabels] = useState(true);

  useImperativeHandle(props.mapHandle, () => ({
    fieldAtPoint(x, y) {
      const map = mapRef.current;
      const bounds = container.current?.getBoundingClientRect();
      if (!map || !bounds || x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) return undefined;
      const point = map.containerPointToLatLng([x - bounds.left, y - bounds.top]);
      return props.fieldMap.features.find((feature) => containsPoint(feature, point.lng, point.lat))?.properties.field_gis;
    },
  }), [props.fieldMap]);

  useEffect(() => { latest.current = props; }, [props]);

  useEffect(() => {
    let disposed = false;
    let map: Leaflet.Map | null = null;
    let observer: ResizeObserver | null = null;
    const layers = fieldLayers.current;
    async function initialise() {
      try {
        const L = await import("leaflet");
        if (disposed || !container.current || !props.fieldMap.features.length) return;
        map = L.map(container.current, { scrollWheelZoom: false, attributionControl: false, zoomSnap: 0.1, zoomDelta: 0.5 });
        mapRef.current = map;
        const group = L.geoJSON(props.fieldMap as unknown as GeoJsonObject, {
          style: { color: "#78887b", fillColor: "#dce5db", fillOpacity: 0.9, weight: 1.5 },
          onEachFeature(feature, layer) {
            const id = String(feature.properties.field_gis);
            const label = document.createElement("span");
            label.textContent = String(feature.properties.field_no || id);
            layer.bindTooltip(label, { permanent: true, direction: "center", className: styles.fieldLabel });
            layer.on("click", () => latest.current.onSelect(id));
            layer.on("mouseover", () => layer.openTooltip());
            layer.on("mouseout", () => { if (!visibleLabels.current.has(id)) layer.closeTooltip(); });
            layers.set(id, layer as Leaflet.Path);
          },
        }).addTo(map);
        const bounds = group.getBounds();
        boundsRef.current = bounds;
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
        const updateLabels = () => {
          if (!map) return;
          const overviewZoom = map.getBoundsZoom(bounds, false, L.point(60, 60));
          setShowAllLabels(map.getSize().x >= 450 || map.getZoom() >= overviewZoom + 0.4);
        };
        map.on("zoomend", updateLabels);
        observer = new ResizeObserver(() => {
          if (!map) return;
          map.invalidateSize();
          if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
          updateLabels();
        });
        observer.observe(container.current);
        setMapReady(true);
      } catch {
        if (!disposed) setMapError(true);
      }
    }
    void initialise();
    return () => {
      disposed = true;
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
      layers.clear();
    };
  }, [props.fieldMap]);

  useEffect(() => {
    if (!mapReady) return;
    for (const feature of props.fieldMap.features) {
      const id = feature.properties.field_gis;
      const count = props.counts[id] || 0;
      const selected = id === props.selectedField;
      const hovered = id === props.hoverField;
      const layer = fieldLayers.current.get(id);
      layer?.setStyle({
        color: hovered ? "#b97725" : selected ? "#0e4f39" : "#78887b",
        fillColor: hovered ? "#f8d89a" : selected ? "#9ccbad" : count ? "#c2dfc7" : "#dce5db",
        fillOpacity: 0.9,
        weight: hovered || selected ? 3 : 1.5,
      });
      const label = document.createElement("span");
      const name = document.createElement("strong");
      name.textContent = feature.properties.field_no || id;
      label.append(name);
      if (count) {
        const number = document.createElement("small");
        number.textContent = `${count} worker${count === 1 ? "" : "s"}`;
        label.append(number);
      }
      layer?.setTooltipContent(label);
      if (showAllLabels || count || selected || hovered) {
        visibleLabels.current.add(id);
        layer?.openTooltip();
      } else {
        visibleLabels.current.delete(id);
        layer?.closeTooltip();
      }
      if (selected || hovered) layer?.bringToFront();
    }
  }, [props.counts, props.fieldMap, props.selectedField, props.hoverField, mapReady, showAllLabels]);

  return (
    <div className={styles.mapWrap}>
      <div className={styles.mapCanvas} ref={container} aria-label="Estate field allocation map. Use the field selector for keyboard or touch assignment." />
      {mapError ? <div className={styles.mapNotice} role="alert">Map unavailable. Use the field selector to continue planning.</div> : null}
      {!mapReady && !mapError ? <div className={styles.mapNotice}>Loading field boundaries…</div> : null}
      <button className={styles.fitMap} type="button" aria-label="Show all fields" disabled={!mapReady} onClick={() => {
        if (boundsRef.current?.isValid()) mapRef.current?.fitBounds(boundsRef.current, { padding: [30, 30] });
      }}><Maximize2 size={16} aria-hidden="true" /> All fields</button>
      <span className={styles.north} aria-hidden="true">N ↑</span>
      <div className={styles.mapCaption}>{showAllLabels ? "Existing demo field boundaries" : "Zoom in for all field labels"} · {props.fieldMap.features.length} fields</div>
    </div>
  );
}

function inRing(ring: number[][], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function containsPoint(feature: FieldFeature, x: number, y: number) {
  const polygons = feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates as number[][][]]
    : feature.geometry.coordinates as number[][][][];
  return polygons.some((rings) => rings.length && inRing(rings[0], x, y) && !rings.slice(1).some((ring) => inRing(ring, x, y)));
}
