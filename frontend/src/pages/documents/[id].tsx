import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Layout from "../../components/Layout";
import StatusBadge from "../../components/StatusBadge";
import ProgressTracker from "../../components/ProgressTracker";
import { api, Document } from "../../lib/api";

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export default function DocumentDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", category: "", summary: "", keywords: "" });
  const [msg, setMsg] = useState("");

  const load = async () => {
    if (!id || typeof id !== "string") return;
    try {
      const d = await api.getDocument(id);
      setDoc(d);
      const out = (d.reviewed_output || d.structured_output || {}) as Record<string, unknown>;
      setForm({
        title: (out.title as string) || d.extracted_title || "",
        category: (out.category as string) || d.extracted_category || "",
        summary: (out.summary as string) || d.extracted_summary || "",
        keywords: ((out.keywords || d.extracted_keywords || []) as string[]).join(", "),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      const updated = await api.updateReview(doc.id, {
        title: form.title,
        category: form.category,
        summary: form.summary,
        keywords: form.keywords.split(",").map(k => k.trim()).filter(Boolean),
      });
      setDoc(updated);
      setEditing(false);
      setMsg("Saved!");
      setTimeout(() => setMsg(""), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!doc) return;
    if (!confirm("Finalize this document? This marks it as reviewed.")) return;
    const updated = await api.finalize(doc.id);
    setDoc(updated);
    setMsg("Finalized!");
    setTimeout(() => setMsg(""), 2000);
  };

  const handleRetry = async () => {
    if (!doc) return;
    const updated = await api.retry(doc.id);
    setDoc(updated);
  };

  if (loading) return <Layout><p style={{ color: "var(--muted)", padding: 40 }}>Loading...</p></Layout>;
  if (!doc) return <Layout><p style={{ color: "var(--red)", padding: 40 }}>Document not found.</p></Layout>;

  const isProcessing = doc.status === "queued" || doc.status === "processing";
  const canEdit = doc.status === "completed" || doc.status === "finalized";
  const output = (doc.reviewed_output || doc.structured_output || {}) as Record<string, unknown>;
  const meta = (output.metadata || {}) as Record<string, unknown>;

  return (
    <Layout>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        {/* Back */}
        <button className="btn-ghost" style={{ marginBottom: 24, fontSize: 13 }} onClick={() => router.push("/")}>
          ← Dashboard
        </button>

        {/* Header */}
        <div style={{
          background: "var(--bg2)", borderRadius: "var(--radius)",
          border: "1px solid var(--border)", padding: 24, marginBottom: 24
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{doc.original_filename}</h1>
              <p style={{ color: "var(--muted)", fontSize: 13 }}>
                {formatBytes(doc.file_size)} · {doc.file_type} ·
                Uploaded {new Date(doc.created_at).toLocaleString()}
              </p>
            </div>
            <StatusBadge status={doc.status} />
          </div>

          {/* Actions */}
          {!isProcessing && (
            <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
              {canEdit && !editing && (
                <button className="btn-ghost" onClick={() => setEditing(true)}>✏ Edit</button>
              )}
              {doc.status !== "finalized" && canEdit && (
                <button className="btn-success" onClick={handleFinalize}>✓ Finalize</button>
              )}
              {doc.status === "failed" && (
                <button className="btn-danger" onClick={handleRetry}>↻ Retry</button>
              )}
              {canEdit && (
                <>
                  <a href={api.exportUrl(doc.id, "json")} download>
                    <button className="btn-ghost">↓ JSON</button>
                  </a>
                  <a href={api.exportUrl(doc.id, "csv")} download>
                    <button className="btn-ghost">↓ CSV</button>
                  </a>
                </>
              )}
            </div>
          )}

          {msg && (
            <div style={{ marginTop: 12, color: "var(--green)", fontSize: 14, fontWeight: 500 }}>{msg}</div>
          )}
        </div>

        {/* Progress for active jobs */}
        {isProcessing && (
          <div style={{ background: "var(--bg2)", borderRadius: "var(--radius)", border: "1px solid var(--border)", padding: 24, marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Processing</h2>
            <ProgressTracker documentId={doc.id} onComplete={load} />
          </div>
        )}

        {/* Error */}
        {doc.status === "failed" && doc.error_message && (
          <div style={{
            background: "#450a0a", border: "1px solid var(--red)",
            borderRadius: "var(--radius)", padding: 16, marginBottom: 24
          }}>
            <p style={{ color: "var(--red)", fontWeight: 600, marginBottom: 4 }}>Processing Failed</p>
            <p style={{ color: "#f87171", fontSize: 13 }}>{doc.error_message}</p>
          </div>
        )}

        {/* Extracted data */}
        {canEdit && (
          <div style={{ background: "var(--bg2)", borderRadius: "var(--radius)", border: "1px solid var(--border)", padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600 }}>Extracted Fields</h2>
              {editing && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              )}
            </div>

            <div style={{ display: "grid", gap: 16 }}>
              <Field label="Title" value={form.title} editing={editing}
                onChange={v => setForm(f => ({ ...f, title: v }))} />
              <Field label="Category" value={form.category} editing={editing}
                onChange={v => setForm(f => ({ ...f, category: v }))} />
              <Field label="Summary" value={form.summary} editing={editing} multiline
                onChange={v => setForm(f => ({ ...f, summary: v }))} />
              <Field label="Keywords" value={form.keywords} editing={editing}
                placeholder="comma-separated"
                onChange={v => setForm(f => ({ ...f, keywords: v }))} />
            </div>

            {/* Metadata */}
            {meta && Object.keys(meta).length > 0 && (
              <div style={{ marginTop: 24, padding: 16, background: "var(--bg3)", borderRadius: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", marginBottom: 10, letterSpacing: 0.5 }}>
                  METADATA
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 20px" }}>
                  {Object.entries(meta).map(([k, v]) => (
                    <div key={k} style={{ fontSize: 13, padding: "3px 0" }}>
                      <span style={{ color: "var(--muted)" }}>{k}: </span>
                      <span style={{ color: "var(--text)" }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Raw text */}
            {doc.raw_text && (
              <details style={{ marginTop: 20 }}>
                <summary style={{ cursor: "pointer", fontSize: 13, color: "var(--muted)", userSelect: "none" }}>
                  Raw extracted text
                </summary>
                <pre style={{
                  marginTop: 10, background: "var(--bg3)", padding: 12,
                  borderRadius: 6, fontSize: 12, color: "var(--muted)",
                  whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto"
                }}>
                  {doc.raw_text}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function Field({
  label, value, editing, multiline, placeholder, onChange
}: {
  label: string;
  value: string;
  editing: boolean;
  multiline?: boolean;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
        {label.toUpperCase()}
      </label>
      {editing ? (
        multiline ? (
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            rows={4}
            style={{ resize: "vertical" }}
          />
        ) : (
          <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        )
      ) : (
        <p style={{ fontSize: 14, color: value ? "var(--text)" : "var(--muted)", padding: "8px 0", minHeight: 28 }}>
          {value || "—"}
        </p>
      )}
    </div>
  );
}
