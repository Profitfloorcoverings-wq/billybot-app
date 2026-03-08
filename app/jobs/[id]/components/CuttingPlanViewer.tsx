"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface CuttingPlanViewerProps {
  svg: string;
  summary?: {
    rooms: Array<{
      name: string;
      area_m2: number;
      material_m2: number;
      waste_m2: number;
      waste_percent: number;
      drops: number;
      seams: number;
    }>;
    totals: {
      total_room_area_m2: number;
      total_material_m2: number;
      total_waste_m2: number;
      overall_waste_percent: number;
    };
    roll_length_required_m?: number;
  };
  pngBase64?: string;
  onClose?: () => void;
}

export default function CuttingPlanViewer({
  svg,
  summary,
  pngBase64,
  onClose,
}: CuttingPlanViewerProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom with mouse wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((prev) => Math.max(0.2, Math.min(5, prev * delta)));
  }, []);

  // Pan with mouse drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    },
    [pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    },
    [isPanning]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) onClose();
      if (e.key === "0") resetView();
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(5, s * 1.2));
      if (e.key === "-") setScale((s) => Math.max(0.2, s * 0.8));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, resetView]);

  // Download PNG
  const downloadPng = useCallback(() => {
    if (!pngBase64) return;
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${pngBase64}`;
    link.download = "cutting-plan.png";
    link.click();
  }, [pngBase64]);

  return (
    <div className="fixed inset-0 z-50 flex bg-black/80">
      {/* Toolbar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2 bg-[var(--bg2)]/90 backdrop-blur border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-[var(--text1)]">
            Cutting Plan
          </h3>
          <span className="text-xs text-[var(--muted)]">
            {Math.round(scale * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale((s) => Math.min(5, s * 1.2))}
            className="px-2 py-1 text-xs rounded bg-[var(--bg3)] text-[var(--text2)] hover:bg-[var(--bg4)]"
          >
            Zoom In
          </button>
          <button
            onClick={() => setScale((s) => Math.max(0.2, s * 0.8))}
            className="px-2 py-1 text-xs rounded bg-[var(--bg3)] text-[var(--text2)] hover:bg-[var(--bg4)]"
          >
            Zoom Out
          </button>
          <button
            onClick={resetView}
            className="px-2 py-1 text-xs rounded bg-[var(--bg3)] text-[var(--text2)] hover:bg-[var(--bg4)]"
          >
            Reset
          </button>
          {pngBase64 && (
            <button
              onClick={downloadPng}
              className="px-2 py-1 text-xs rounded bg-[var(--brand1)] text-white hover:bg-[var(--brand2)]"
            >
              Download PNG
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-2 py-1 text-xs rounded bg-[var(--bg3)] text-[var(--text2)] hover:bg-[var(--bg4)]"
          >
            Print
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs rounded bg-red-600/20 text-red-400 hover:bg-red-600/30"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* SVG viewport */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing pt-12"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: isPanning ? "none" : "transform 0.1s ease-out",
          }}
          className="w-full h-full flex items-center justify-center"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {/* Summary sidebar */}
      {summary && (
        <div className="w-72 bg-[var(--bg2)] border-l border-[var(--border)] overflow-y-auto pt-12 px-4 py-4">
          <h4 className="text-sm font-semibold text-[var(--text1)] mb-3">
            Material Summary
          </h4>

          {summary.rooms.map((room, i) => (
            <div
              key={i}
              className="mb-4 p-3 rounded-lg bg-[var(--bg3)] text-xs"
            >
              <p className="font-semibold text-[var(--text1)] mb-2">
                {room.name}
              </p>
              <div className="space-y-1 text-[var(--text2)]">
                <Row label="Room area" value={`${room.area_m2} m²`} />
                <Row label="Material" value={`${room.material_m2} m²`} />
                <Row
                  label="Waste"
                  value={`${room.waste_m2} m² (${room.waste_percent}%)`}
                />
                <Row label="Drops" value={String(room.drops)} />
                {room.seams > 0 && (
                  <Row label="Seams" value={String(room.seams)} />
                )}
              </div>
            </div>
          ))}

          <div className="p-3 rounded-lg bg-[var(--brand1)]/10 text-xs">
            <p className="font-semibold text-[var(--text1)] mb-2">Totals</p>
            <div className="space-y-1 text-[var(--text2)]">
              <Row
                label="Room area"
                value={`${summary.totals.total_room_area_m2} m²`}
              />
              <Row
                label="Material"
                value={`${summary.totals.total_material_m2} m²`}
              />
              <Row
                label="Waste"
                value={`${summary.totals.total_waste_m2} m² (${summary.totals.overall_waste_percent}%)`}
              />
              {summary.roll_length_required_m && (
                <Row
                  label="Roll length"
                  value={`${summary.roll_length_required_m}m`}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
