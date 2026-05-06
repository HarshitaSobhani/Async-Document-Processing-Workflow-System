import React, { useEffect, useState } from "react";
import { api, ProgressEvent } from "../lib/api";

const EVENT_LABELS: Record<string, string> = {
  job_queued: "Queued",
  job_started: "Starting...",
  document_received: "Document received",
  parsing_started: "Parsing document",
  parsing_completed: "Parsing complete",
  field_extraction_started: "Extracting fields",
  field_extraction_completed: "Fields extracted",
  storing_result: "Storing result",
  job_completed: "Complete!",
  job_failed: "Failed",
};

export default function ProgressTracker({
  documentId,
  onComplete,
}: {
  documentId: string;
  onComplete?: () => void;
}) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [latest, setLatest] = useState<ProgressEvent | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const unsub = api.subscribeProgress(documentId, (e) => {
      setLatest(e);
      setEvents((prev) => [...prev.slice(-10), e]);
      if (e.event === "job_completed" || e.event === "job_failed") {
        setDone(true);
        onComplete?.();
      }
    });
    return unsub;
  }, [documentId]);

  const progress = latest?.progress ?? 0;
  const failed = latest?.event === "job_failed";

  return (
    <div style={{ background: "var(--bg3)", borderRadius: "var(--radius)", padding: 16, marginTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
        <span style={{ color: "var(--muted)" }}>
          {latest ? (EVENT_LABELS[latest.event] || latest.message) : "Waiting..."}
        </span>
        <span style={{ color: failed ? "var(--red)" : "var(--accent2)", fontWeight: 600 }}>
          {progress}%
        </span>
      </div>
      <div style={{
        background: "var(--bg2)", borderRadius: 99, height: 6, overflow: "hidden"
      }}>
        <div style={{
          width: `${progress}%`,
          height: "100%",
          background: failed ? "var(--red)" : "linear-gradient(90deg, var(--accent), var(--accent2))",
          borderRadius: 99,
          transition: "width 0.4s ease",
        }} />
      </div>
      {events.length > 0 && (
        <div style={{ marginTop: 10, maxHeight: 80, overflowY: "auto" }}>
          {events.slice().reverse().map((e, i) => (
            <div key={i} style={{
              fontSize: 11, color: "var(--muted)",
              padding: "1px 0",
              opacity: i === 0 ? 1 : 0.5,
            }}>
              {new Date(e.timestamp).toLocaleTimeString()} — {e.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
