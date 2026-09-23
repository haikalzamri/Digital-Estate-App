"use client";
import { useRef, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { FIELD_SHAPES, MAP_BOUNDS } from "@/lib/minamas-harvesting-interval/field-map-data";
import { STATUS, divisionLabel } from "@/lib/minamas-harvesting-interval/report";
import type { DivisionFilter, FieldInterval, MinamasField } from "@/lib/minamas-harvesting-interval/types";
import styles from "./dashboard.module.css";

type Props = { fields: MinamasField[]; division: DivisionFilter; statuses: Record<string, FieldInterval>; selected: string | null; onSelect: (code: string) => void };
export function FieldMap(props: Props) {
  // A division change remounts this component to fit the newly selected area.
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; panX: number; panY: number; moved: boolean } | null>(null);
  const bounds = MAP_BOUNDS[props.division];
  const width = bounds.width / zoom;
  const height = bounds.height / zoom;
  const x = bounds.x + (bounds.width - width) / 2 + pan.x;
  const y = bounds.y + (bounds.height - height) / 2 + pan.y;
  const lookup = new Map(props.fields.map((field) => [field.code, field]));
  function select(code: string) { if (!drag.current?.moved) props.onSelect(code); }
  return <div className={styles.mapFrame}>
    <div className={styles.mapStamp}><span className={styles.liveDot} />TELUK SIAK<span>{divisionLabel(props.division)}</span></div>
    <div className={styles.mapTools} aria-label="Map controls">
      <button type="button" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom(Math.min(3, zoom + .35))}><Plus size={18} /></button>
      <button type="button" aria-label="Zoom out" disabled={zoom <= .8} onClick={() => setZoom(Math.max(.8, zoom - .35))}><Minus size={18} /></button>
      <button type="button" aria-label="Reset map view" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><RotateCcw size={17} /></button>
    </div>
    <svg className={styles.mapSvg} viewBox={`${x} ${y} ${width} ${height}`} aria-label="Teluk Siak illustrative field map"
      onPointerDown={(event) => { drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y, moved: false }; }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (!start || event.buttons !== 1) return;
        const dx = event.clientX - start.x, dy = event.clientY - start.y;
        if (Math.abs(dx) + Math.abs(dy) < 6) return;
        start.moved = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        const rect = event.currentTarget.getBoundingClientRect();
        const scale = Math.max(width / rect.width, height / rect.height);
        setPan({ x: Math.max(-bounds.width, Math.min(bounds.width, start.panX - dx * scale)), y: Math.max(-bounds.height, Math.min(bounds.height, start.panY - dy * scale)) });
      }}
      onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
      onPointerCancel={() => { drag.current = null; }}>
      <defs>
        <pattern id="minamas-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#cdd9d1" strokeWidth="1" /></pattern>
        <pattern id="minamas-major-grid" width="250" height="250" patternUnits="userSpaceOnUse"><rect width="250" height="250" fill="url(#minamas-grid)" /><path d="M250 0H0V250" fill="none" stroke="#b7c8bd" strokeWidth="1.3" /></pattern>
        <pattern id="minamas-uncertain" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="10" height="10" fill="#c0c8c2" /><path d="M0 0V10" stroke="#919d94" strokeWidth="2" /></pattern>
      </defs>
      <rect x="-2000" y="-2000" width="6000" height="6000" fill="#eaf0e8" />
      <rect x="-2000" y="-2000" width="6000" height="6000" fill="url(#minamas-major-grid)" />
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1657 325L1650 506Q1654 552 1611 563Q1574 580 1548 569Q1507 568 1480 574Q1438 556 1400 566Q1360 560 1358 593Q1361 627 1329 645Q1320 686 1255 682L1218 684L1136 696Q1082 730 1040 787L1001 824L946 909L887 998L867 1030" stroke="#9cc7d9" strokeWidth="22" />
        <path d="M1657 325L1650 506Q1654 552 1611 563Q1574 580 1548 569Q1507 568 1480 574Q1438 556 1400 566Q1360 560 1358 593Q1361 627 1329 645Q1320 686 1255 682L1218 684L1136 696Q1082 730 1040 787L1001 824L946 909L887 998L867 1030" stroke="#75b1ca" strokeWidth="3" />
        <path d="M275 135L253 205L230 260L190 295L120 380L35 463" stroke="#89bfd2" strokeWidth="5" />
        <path d="M810 165L874 192H1038M900 192V278L925 292L930 316L895 350L889 387L852 404L847 432L800 451L768 497L711 540L679 567Q660 583 677 617L691 655L674 678Q710 713 674 734L644 753L646 795L642 848L611 879M200 667Q325 825 411 867L501 900L611 879L672 878" stroke="#eee4ce" strokeWidth="17" />
        <path d="M810 165L874 192H1038M900 192V278L925 292L930 316L895 350L889 387L852 404L847 432L800 451L768 497L711 540L679 567Q660 583 677 617L691 655L674 678Q710 713 674 734L644 753L646 795L642 848L611 879M200 667Q325 825 411 867L501 900L611 879L672 878" stroke="#c8bfa9" strokeWidth="3" strokeDasharray="5 7" />
      </g>
      {FIELD_SHAPES.map((shape) => {
        const field = lookup.get(shape.code);
        if (!field) return null;
        const active = props.division === "all" || field.division === props.division;
        const state = props.statuses[shape.code];
        const status = state?.status || "noData";
        const selected = props.selected === shape.code;
        const label = `${field.label}, YoP ${field.yop}, ${divisionLabel(field.division)}, ${STATUS[status].label}`;
        return <g key={shape.code} className={active ? styles.mapField : undefined} opacity={active ? 1 : .13}>
          <polygon points={shape.points} fill={status === "uncertain" ? "url(#minamas-uncertain)" : STATUS[status].color} fillOpacity={active ? .85 : .5}
            stroke={selected ? "#102f22" : "#425d4b"} strokeWidth={selected ? 4 : 1.2} vectorEffect="non-scaling-stroke"
            role={active ? "button" : undefined} tabIndex={active ? 0 : undefined} aria-label={active ? label : undefined} aria-pressed={active ? selected : undefined}
            onClick={() => { if (active) select(shape.code); }}
            onKeyDown={(event) => { if (active && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); drag.current = null; props.onSelect(shape.code); } }}>
            <title>{`${label}${state?.interval !== null && state?.interval !== undefined ? ` · ${state.interval} days` : ""}`}</title>
          </polygon>
          <text x={shape.labelX} y={shape.labelY} className={styles.fieldLabel} textAnchor="middle" pointerEvents="none">{field.label}</text>
          {field.label === "E014" && <text x={shape.labelX} y={shape.labelY + 13} className={styles.mapYop} textAnchor="middle" pointerEvents="none">{field.yop}</text>}
        </g>;
      })}
      <g fill="#526c5a" className={styles.mapContext} pointerEvents="none">
        <text x="555" y="287" textAnchor="middle">DIVISION I</text>
        <text x="652" y="815" textAnchor="middle">DIVISION II</text>
        <text x="1250" y="311" textAnchor="middle">DIVISION III</text>
        <text x="1435" y="842" textAnchor="middle">KEBUN APE</text>
        <text x="455" y="1030" textAnchor="middle">↓ PEKANBARU</text>
        <text x="1050" y="940" textAnchor="middle" transform="rotate(-53 1050 940)">SUNGAI PINGAI</text>
      </g>
    </svg>
    <div className={styles.mapCaption}>Illustrative map · Based on the supplied estate layout</div>
    <div className={styles.compass} aria-label="North">N<span>↑</span></div>
  </div>;
}
