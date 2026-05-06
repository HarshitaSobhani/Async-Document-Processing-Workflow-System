import React from "react";

const COLORS: Record<string, { bg: string; color: string; label: string }> = {
  queued:     { bg: "#1e293b", color: "#94a3b8", label: "Queued" },
  processing: { bg: "#1e3a5f", color: "#60a5fa", label: "Processing" },
  completed:  { bg: "#064e3b", color: "#34d399", label: "Completed" },
  failed:     { bg: "#450a0a", color: "#f87171", label: "Failed" },
  finalized:  { bg: "#312e81", color: "#a5b4fc", label: "Finalized" },
};

export default function StatusBadge({ status }: { status: string }) {
  const s = COLORS[status] || COLORS.queued;
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: "2px 10px", borderRadius: 99,
      fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
      display: "inline-flex", alignItems: "center", gap: 5,
    }}>
      {status === "processing" && (
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: s.color, display: "inline-block",
          animation: "pulse 1.2s infinite",
        }} />
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
      {s.label}
    </span>
  );
}
