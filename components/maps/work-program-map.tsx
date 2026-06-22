"use client";

import { useEffect, useRef } from "react";
import type { GeoJsonObject } from "geojson";
import type { FieldFeatureCollection, MapFieldStatus } from "@/lib/work-program/analytics";
import { formatDate, formatNumber } from "@/lib/work-program/analytics";
import { PROGRAM_COLORS, type MapStatus } from "@/lib/work-program/config";
import type { WorkProgramRecord } from "@/lib/types/work-program";

const statusColours: Record<MapStatus, string> = {
  green: "#22a65a",
  yellow: "#f4c542",
  red: "#d94a38",
  grey: "#9da5a0",
};

type DashboardFieldMapProps = {
  fieldMap: FieldFeatureCollection;
  statuses: MapFieldStatus[];
  selectedField: string;
  onSelectField: (fieldGis: string) => void;
};

export function DashboardFieldMap({ fieldMap, statuses, selectedField, onSelectField }: DashboardFieldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let mapInstance: import("leaflet").Map | null = null;
    const renderMap = async () => {
      if (!containerRef.current || !fieldMap.features.length) return;
      const L = await import("leaflet");
      if (disposed || !containerRef.current) return;
      const lookup = new Map(statuses.map((item) => [item.field.properties.field_gis, item]));
      mapInstance = L.map(containerRef.current, { scrollWheelZoom: false, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 22,
      }).addTo(mapInstance);
      const layer = L.geoJSON(fieldMap as unknown as GeoJsonObject, {
        style: (feature) => {
          const fieldGis = String(feature?.properties?.field_gis || "");
          const status = lookup.get(fieldGis)?.status || "grey";
          const selected = fieldGis === selectedField;
          return {
            color: selected ? "#ffffff" : "#263a2f",
            fillColor: statusColours[status],
            fillOpacity: selected ? 0.86 : 0.68,
            weight: selected ? 4 : 1.4,
          };
        },
        onEachFeature: (feature, featureLayer) => {
          const fieldGis = String(feature.properties?.field_gis || "");
          const item = lookup.get(fieldGis);
          const fieldName = String(feature.properties?.field_no || fieldGis);
          featureLayer.bindTooltip(fieldName, {
            className: "field-map-tooltip",
            direction: "center",
            permanent: true,
          });
          featureLayer.bindPopup(
            `<div class="map-popup"><strong>${escapeHtml(fieldName)}</strong><span>${escapeHtml(item?.label || "No interval")}</span><dl><div><dt>GIS ha</dt><dd>${formatNumber(feature.properties?.ha_gis)}</dd></div><div><dt>Proposed</dt><dd>${escapeHtml(formatDate(item?.proposedNextDate || ""))}</dd></div><div><dt>Interval</dt><dd>${escapeHtml(formatInterval(item?.intervalValue))}</dd></div></dl></div>`,
          );
          featureLayer.on("click", () => onSelectField(fieldGis));
        },
      }).addTo(mapInstance);
      const bounds = layer.getBounds();
      if (bounds.isValid()) mapInstance.fitBounds(bounds, { maxZoom: 16, padding: [22, 22] });
    };
    void renderMap();
    return () => {
      disposed = true;
      mapInstance?.remove();
    };
  }, [fieldMap, onSelectField, selectedField, statuses]);

  return fieldMap.features.length ? (
    <div className="leaflet-map" ref={containerRef} aria-label="Work Program estate status map" />
  ) : (
    <div className="map-empty">Field map data is loading.</div>
  );
}

type RecordsFieldMapProps = {
  fieldMap: FieldFeatureCollection;
  records: WorkProgramRecord[];
  selectedRecordId: string;
  onSelectRecord: (record: WorkProgramRecord) => void;
};

export function RecordsFieldMap({ fieldMap, records, selectedRecordId, onSelectRecord }: RecordsFieldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let mapInstance: import("leaflet").Map | null = null;
    const renderMap = async () => {
      if (!containerRef.current || !fieldMap.features.length) return;
      const L = await import("leaflet");
      if (disposed || !containerRef.current) return;
      mapInstance = L.map(containerRef.current, { scrollWheelZoom: false, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 22,
      }).addTo(mapInstance);
      const fieldLayer = L.geoJSON(fieldMap as unknown as GeoJsonObject, {
        style: { color: "#526159", fillColor: statusColours.grey, fillOpacity: 0.24, weight: 1.2 },
        onEachFeature: (feature, layer) => {
          const fieldName = String(feature.properties?.field_no || feature.properties?.field_gis || "Field");
          layer.bindTooltip(fieldName, { className: "field-map-tooltip", sticky: true });
        },
      }).addTo(mapInstance);
      const combinedBounds = fieldLayer.getBounds();
      records.forEach((record) => {
        const latitude = Number(record.latitude);
        const longitude = Number(record.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
        const selected = record.id === selectedRecordId;
        const marker = L.marker([latitude, longitude], {
          icon: recordPinIcon(L, PROGRAM_COLORS[record.programType] || "#176b4d", selected),
          title: `${record.blockField} - ${record.programType}`,
        })
          .bindTooltip(`${record.blockField} - ${record.programType}`, { direction: "top", sticky: true })
          .bindPopup(
            `<div class="map-popup"><strong>${escapeHtml(record.blockField)} - ${escapeHtml(record.programType)}</strong><dl><div><dt>Date</dt><dd>${escapeHtml(formatDate(record.actualCompletionDate))}</dd></div><div><dt>Hectares</dt><dd>${formatNumber(record.hectares)}</dd></div><div><dt>Reporter</dt><dd>${escapeHtml(record.reporterName)}</dd></div><div><dt>Status</dt><dd>${escapeHtml(record.approvalStatus || "Pending Approval")}</dd></div></dl></div>`,
          )
          .addTo(mapInstance!);
        marker.on("click", () => onSelectRecord(record));
        combinedBounds.extend([latitude, longitude]);
        if (selected) {
          marker.setZIndexOffset(1000);
          marker.openTooltip();
        }
      });
      if (combinedBounds.isValid()) mapInstance.fitBounds(combinedBounds, { maxZoom: 16, padding: [22, 22] });
    };
    void renderMap();
    return () => {
      disposed = true;
      mapInstance?.remove();
    };
  }, [fieldMap, onSelectRecord, records, selectedRecordId]);

  return fieldMap.features.length ? (
    <div className="leaflet-map" ref={containerRef} aria-label="Work Program records map" />
  ) : (
    <div className="map-empty">Field map data is loading.</div>
  );
}

function recordPinIcon(leaflet: typeof import("leaflet"), colour: string, selected: boolean) {
  const size = selected ? [34, 42] : [28, 36];
  const anchor = selected ? [17, 41] : [14, 35];
  return leaflet.divIcon({
    className: `record-pin-icon${selected ? " selected" : ""}`,
    html: `<svg class="record-pin" viewBox="0 0 24 24" style="--pin-color:${colour}" aria-hidden="true"><path d="M12 22s7-6.1 7-12A7 7 0 0 0 5 10c0 5.9 7 12 7 12Z"></path><circle cx="12" cy="10" r="3.2"></circle></svg>`,
    iconSize: size as [number, number],
    iconAnchor: anchor as [number, number],
    popupAnchor: [0, -anchor[1] + 4],
  });
}

function formatInterval(value: number | null | undefined) {
  if (value == null) return "-";
  return `${formatNumber(value)} month${value === 1 ? "" : "s"}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
