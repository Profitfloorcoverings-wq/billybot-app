"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import CuttingPlanViewer from "./CuttingPlanViewer";

type JobFile = {
  id: string;
  job_id: string;
  client_id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  file_category: string;
  uploaded_via: string;
  ai_analysis: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  signed_url: string | null;
};

type RoomData = {
  name: string;
  shape: string;
  area_m2: number;
  finish: string;
  bounding_box?: { w_m: number; l_m: number };
  features?: string[];
};

const CATEGORY_STYLES: Record<string, { bg: string; border: string; color: string; label: string }> = {
  floor_plan: { bg: "rgba(56,189,248,0.12)", border: "rgba(56,189,248,0.3)", color: "#38bdf8", label: "Floor Plan" },
  site_photo: { bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)", color: "#22c55e", label: "Site Photo" },
  cutting_plan: { bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)", color: "#f97316", label: "Cutting Plan" },
  document: { bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.3)", color: "#94a3b8", label: "Document" },
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(mimeType: string | null): boolean {
  return !!mimeType && mimeType.startsWith("image/");
}

export default function JobFilesPanel({ jobId }: { jobId: string }) {
  const [files, setFiles] = useState<JobFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [category, setCategory] = useState("document");
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [cuttingPlanView, setCuttingPlanView] = useState<{
    svg: string;
    pngBase64: string;
    summary: Record<string, unknown>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const imageFiles = useMemo(
    () => files.filter((f) => isImage(f.mime_type) && f.signed_url),
    [files]
  );

  /** Floor plan files that have ai_analysis with room data */
  const floorPlanFiles = useMemo(
    () =>
      files.filter(
        (f) =>
          f.file_category === "floor_plan" &&
          f.ai_analysis &&
          Array.isArray((f.ai_analysis as Record<string, unknown>).rooms) &&
          ((f.ai_analysis as Record<string, unknown>).rooms as unknown[]).length > 0
      ),
    [files]
  );

  const canGenerateCuttingPlan = floorPlanFiles.length > 0;

  async function handleGenerateCuttingPlan() {
    if (!canGenerateCuttingPlan) return;
    setGeneratingPlan(true);
    try {
      // Build rooms from ai_analysis data
      const rooms: Array<{
        name: string;
        walls?: Array<{ x_mm: number; y_mm: number }>;
        bounding_box?: { w_m: number; l_m: number };
      }> = [];

      for (const file of floorPlanFiles) {
        const analysis = file.ai_analysis as Record<string, unknown>;
        const fileRooms = (analysis.rooms ?? []) as Array<Record<string, unknown>>;
        for (const room of fileRooms) {
          rooms.push({
            name: (room.name as string) ?? "Room",
            walls: room.walls as Array<{ x_mm: number; y_mm: number }> | undefined,
            bounding_box: room.bounding_box as { w_m: number; l_m: number } | undefined,
          });
        }
      }

      if (rooms.length === 0) return;

      const res = await fetch("/api/cutting-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          client_id: "", // Will be filled from auth
          rooms,
          flooring_type: "carpet",
          material: { format: "roll", width_m: 4 },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Cutting plan generation failed:", err);
        return;
      }

      const data = await res.json();
      setCuttingPlanView({
        svg: data.svg,
        pngBase64: data.png_base64,
        summary: data.summary,
      });
    } catch (err) {
      console.error("Cutting plan generation failed:", err);
    } finally {
      setGeneratingPlan(false);
    }
  }

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(`/api/job-files?job_id=${jobId}`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data.files ?? []);
      }
    } catch (err) {
      console.error("Failed to load job files", err);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft") setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i));
      if (e.key === "ArrowRight") setLightboxIndex((i) => (i !== null && i < imageFiles.length - 1 ? i + 1 : i));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, imageFiles.length]);

  // Realtime: listen for changes to job_files for this job
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`job-files-${jobId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_files", filter: `job_id=eq.${jobId}` },
        () => void loadFiles()
      )
      .subscribe();

    return () => void supabase.removeChannel(channel);
  }, [jobId, loadFiles]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = e.target.files;
    if (!selectedFiles?.length) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("job_id", jobId);
      formData.append("file_category", category);
      for (const file of Array.from(selectedFiles)) {
        formData.append("files", file);
      }

      const res = await fetch("/api/job-files", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        setFiles((prev) => [...(data.files ?? []), ...prev]);
      }
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete(fileId: string) {
    setDeleting(fileId);
    try {
      const res = await fetch(`/api/job-files/${fileId}`, { method: "DELETE" });
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      }
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setDeleting(null);
    }
  }

  function renderAnalysis(file: JobFile) {
    const analysis = file.ai_analysis;
    if (!analysis) return null;

    const rooms = (analysis.rooms ?? []) as RoomData[];
    const totalArea = analysis.total_area_m2 as number | undefined;
    const confidence = analysis.confidence as number | undefined;
    const isExpanded = expandedAnalysis === file.id;

    if (!rooms.length) return null;

    return (
      <div style={{ marginTop: "8px" }}>
        <button
          type="button"
          onClick={() => setExpandedAnalysis(isExpanded ? null : file.id)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "12px", color: "#38bdf8", fontWeight: 600, padding: 0,
          }}
        >
          {isExpanded ? "Hide" : "Show"} room data ({rooms.length} room{rooms.length !== 1 ? "s" : ""})
          {totalArea ? ` - ${totalArea.toFixed(1)}m\u00B2 total` : ""}
        </button>

        {isExpanded ? (
          <div style={{
            marginTop: "8px", background: "rgba(15,23,42,0.6)",
            border: "1px solid rgba(148,163,184,0.1)", borderRadius: "8px",
            overflow: "hidden",
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(148,163,184,0.15)" }}>
                  {["Room", "Shape", "Area", "Finish", "Dimensions"].map((h) => (
                    <th key={h} style={{
                      padding: "8px 10px", textAlign: "left", fontWeight: 700,
                      color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "10px",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map((room, i) => (
                  <tr key={`${room.name}-${i}`} style={{ borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
                    <td style={{ padding: "7px 10px", color: "#e2e8f0", fontWeight: 600 }}>{room.name}</td>
                    <td style={{ padding: "7px 10px", color: "#94a3b8" }}>{room.shape}</td>
                    <td style={{ padding: "7px 10px", color: "#e2e8f0" }}>{room.area_m2?.toFixed(1)}m&sup2;</td>
                    <td style={{ padding: "7px 10px", color: "#94a3b8" }}>{room.finish}</td>
                    <td style={{ padding: "7px 10px", color: "#94a3b8" }}>
                      {room.bounding_box ? `${room.bounding_box.w_m}m x ${room.bounding_box.l_m}m` : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {confidence != null ? (
              <p style={{ padding: "6px 10px", margin: 0, fontSize: "11px", color: "#475569" }}>
                AI confidence: {Math.round(confidence * 100)}%
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  if (loading) {
    return <p style={{ fontSize: "14px", color: "#64748b" }}>Loading files...</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Upload bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap",
      }}>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{
            padding: "8px 12px", borderRadius: "8px", fontSize: "13px", fontWeight: 500,
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(148,163,184,0.15)",
            color: "#e2e8f0", cursor: "pointer",
          }}
        >
          <option value="document">Document</option>
          <option value="floor_plan">Floor Plan</option>
          <option value="site_photo">Site Photo</option>
          <option value="cutting_plan">Cutting Plan</option>
        </select>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.heic,.heif"
          multiple
          onChange={handleUpload}
          style={{ display: "none" }}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="btn btn-primary"
          style={{ padding: "8px 16px", fontSize: "13px" }}
        >
          {uploading ? "Uploading..." : "+ Upload files"}
        </button>

        {canGenerateCuttingPlan && (
          <button
            type="button"
            onClick={() => void handleGenerateCuttingPlan()}
            disabled={generatingPlan}
            style={{
              padding: "8px 16px", fontSize: "13px", fontWeight: 600,
              borderRadius: "8px", cursor: generatingPlan ? "not-allowed" : "pointer",
              background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)",
              color: "#f97316",
            }}
          >
            {generatingPlan ? "Generating..." : "Generate Cutting Plan"}
          </button>
        )}
      </div>

      {/* File grid */}
      {files.length === 0 ? (
        <p style={{ fontSize: "14px", color: "#64748b" }}>No files attached to this job yet.</p>
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "12px",
        }}>
          {files.map((file) => {
            const catStyle = CATEGORY_STYLES[file.file_category] ?? CATEGORY_STYLES.document;
            return (
              <div
                key={file.id}
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(148,163,184,0.1)",
                  borderRadius: "12px",
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                {/* Thumbnail / icon */}
                {isImage(file.mime_type) && file.signed_url ? (
                  <button
                    type="button"
                    onClick={() => {
                      // Cutting plan files with ai_analysis → open in CuttingPlanViewer
                      // (If SVG data is stored, it would go here. For now, open in lightbox.)
                      const idx = imageFiles.findIndex((img) => img.id === file.id);
                      if (idx >= 0) setLightboxIndex(idx);
                    }}
                    style={{
                      width: "100%", height: "140px", borderRadius: "8px",
                      overflow: "hidden", background: "rgba(0,0,0,0.2)",
                      border: "none", padding: 0, cursor: "zoom-in", display: "block",
                    }}
                  >
                    <img
                      src={file.signed_url}
                      alt={file.file_name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </button>
                ) : (
                  <div style={{
                    width: "100%", height: "60px", borderRadius: "8px",
                    background: "rgba(148,163,184,0.06)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "24px", color: "#475569",
                  }}>
                    {file.mime_type?.includes("pdf") ? "PDF" : "FILE"}
                  </div>
                )}

                {/* File info */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{
                      fontSize: "13px", fontWeight: 600, color: "#e2e8f0", margin: 0,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {file.file_name}
                    </p>
                    <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 0" }}>
                      {formatBytes(file.size_bytes)}
                      {file.created_at ? ` \u00B7 ${new Date(file.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
                    </p>
                  </div>

                  {/* Category badge */}
                  <span style={{
                    fontSize: "10px", fontWeight: 700, padding: "2px 8px",
                    borderRadius: "999px", flexShrink: 0,
                    background: catStyle.bg, border: `1px solid ${catStyle.border}`,
                    color: catStyle.color, textTransform: "uppercase", letterSpacing: "0.04em",
                  }}>
                    {catStyle.label}
                  </span>
                </div>

                {/* AI analysis (floor plans) */}
                {file.file_category === "floor_plan" && file.ai_analysis ? renderAnalysis(file) : null}

                {/* Actions */}
                <div style={{ display: "flex", gap: "8px", marginTop: "auto" }}>
                  {file.signed_url ? (
                    <a
                      href={file.signed_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        flex: 1, padding: "6px 0", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                        textAlign: "center", textDecoration: "none",
                        background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)",
                        color: "#38bdf8",
                      }}
                    >
                      Open
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleDelete(file.id)}
                    disabled={deleting === file.id}
                    style={{
                      flex: 1, padding: "6px 0", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                      background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                      color: "#f87171", cursor: deleting === file.id ? "not-allowed" : "pointer",
                    }}
                  >
                    {deleting === file.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Cutting plan viewer */}
      {cuttingPlanView && (
        <CuttingPlanViewer
          svg={cuttingPlanView.svg}
          pngBase64={cuttingPlanView.pngBase64}
          summary={cuttingPlanView.summary as Parameters<typeof CuttingPlanViewer>[0]["summary"]}
          onClose={() => setCuttingPlanView(null)}
        />
      )}

      {/* Image lightbox */}
      {lightboxIndex !== null && imageFiles[lightboxIndex] && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 50,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.9)", padding: "16px",
          }}
          onClick={() => setLightboxIndex(null)}
        >
          <div
            style={{
              position: "relative", width: "100%", maxWidth: "1000px",
              borderRadius: "20px", border: "1px solid rgba(148,163,184,0.15)",
              background: "#020617", padding: "16px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imageFiles[lightboxIndex].signed_url!}
              alt={imageFiles[lightboxIndex].file_name}
              style={{ maxHeight: "75vh", width: "100%", borderRadius: "12px", objectFit: "contain" }}
            />
            <p style={{
              fontSize: "13px", fontWeight: 600, color: "#e2e8f0", margin: "10px 0 0",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {imageFiles[lightboxIndex].file_name}
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "10px", gap: "8px" }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "8px 16px" }}
                onClick={() => setLightboxIndex((i) => (i !== null && i > 0 ? i - 1 : i))}
                disabled={lightboxIndex === 0}
              >
                ← Prev
              </button>
              <span style={{ fontSize: "13px", color: "#64748b" }}>
                {lightboxIndex + 1} / {imageFiles.length}
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "8px 16px" }}
                onClick={() => setLightboxIndex((i) => (i !== null && i < imageFiles.length - 1 ? i + 1 : i))}
                disabled={lightboxIndex >= imageFiles.length - 1}
              >
                Next →
              </button>
              <a
                href={imageFiles[lightboxIndex].signed_url!}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ padding: "8px 16px", textDecoration: "none" }}
              >
                Open ↗
              </a>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: "8px 16px" }}
                onClick={() => setLightboxIndex(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
