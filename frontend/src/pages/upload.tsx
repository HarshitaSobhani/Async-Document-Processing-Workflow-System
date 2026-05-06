import React, { useState, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import ProgressTracker from "../components/ProgressTracker";
import StatusBadge from "../components/StatusBadge";
import { api, Document } from "../lib/api";

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<Document[]>([]);
  const [error, setError] = useState("");

  const addFiles = (newFiles: FileList | File[]) => {
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }, []);

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    setError("");
    try {
      const docs = await api.uploadFiles(files);
      setUploaded(docs);
      setFiles([]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Layout>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Upload Documents</h1>
        <p style={{ color: "var(--muted)", marginBottom: 32 }}>
          Upload one or more files. Each will be processed asynchronously.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? "var(--accent)" : "var(--border)"}`,
            borderRadius: "var(--radius)",
            padding: "48px 32px",
            textAlign: "center",
            cursor: "pointer",
            background: dragging ? "#1a1d3a" : "var(--bg2)",
            transition: "all 0.2s",
            marginBottom: 24,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 8 }}>📁</div>
          <p style={{ fontWeight: 600, marginBottom: 4 }}>Drop files here or click to browse</p>
          <p style={{ color: "var(--muted)", fontSize: 13 }}>PDF, TXT, CSV, JSON, HTML — max 50MB each</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>

        {/* File queue */}
        {files.length > 0 && (
          <div style={{ background: "var(--bg2)", borderRadius: "var(--radius)", padding: 16, marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: "var(--muted)" }}>
              {files.length} file(s) ready
            </p>
            {files.map((f, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 14,
              }}>
                <span>{f.name}</span>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>{formatBytes(f.size)}</span>
                  <button
                    className="btn-ghost"
                    style={{ padding: "2px 8px", fontSize: 12 }}
                    onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter((_, j) => j !== i)); }}
                  >✕</button>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <button className="btn-primary" onClick={handleUpload} disabled={uploading}>
                {uploading ? "Uploading..." : `Upload ${files.length} file(s)`}
              </button>
              <button className="btn-ghost" onClick={() => setFiles([])}>Clear</button>
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "#450a0a", color: "var(--red)", padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
            {error}
          </div>
        )}

        {/* Uploaded documents with live progress */}
        {uploaded.length > 0 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Processing</h2>
            {uploaded.map((doc) => (
              <div key={doc.id} style={{
                background: "var(--bg2)", borderRadius: "var(--radius)",
                padding: 16, marginBottom: 16,
                border: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontWeight: 600 }}>{doc.original_filename}</p>
                    <p style={{ fontSize: 12, color: "var(--muted)" }}>{formatBytes(doc.file_size)}</p>
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
                <ProgressTracker
                  documentId={doc.id}
                  onComplete={() => {}}
                />
                <div style={{ marginTop: 12 }}>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 13 }}
                    onClick={() => router.push(`/documents/${doc.id}`)}
                  >
                    View Document →
                  </button>
                </div>
              </div>
            ))}
            <button className="btn-ghost" onClick={() => router.push("/")}>
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
