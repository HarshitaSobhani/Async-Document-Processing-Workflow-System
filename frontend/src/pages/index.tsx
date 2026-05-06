import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import { api, Document } from "../lib/api";

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUSES = ["", "queued", "processing", "completed", "failed", "finalized"];

export default function Dashboard() {
  const router = useRouter();
  const [docs, setDocs] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("created_at");
  const [page, setPage] = useState(1);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.listDocuments({ status: status || undefined, search: search || undefined, sort, page });
      setDocs(res.items);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [status, search, sort, page]);

  useEffect(() => { fetch(); }, [fetch]);

  // Auto-refresh for processing jobs
  useEffect(() => {
    const hasProcessing = docs.some(d => d.status === "queued" || d.status === "processing");
    if (!hasProcessing) return;
    const t = setTimeout(fetch, 3000);
    return () => clearTimeout(t);
  }, [docs, fetch]);

  const totalPages = Math.ceil(total / 20);

  return (
    <Layout>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700 }}>Documents</h1>
            <p style={{ color: "var(--muted)", marginTop: 4 }}>{total} total documents</p>
          </div>
          <Link href="/upload">
            <button className="btn-primary">+ Upload</button>
          </Link>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <input
            placeholder="Search by name or category..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ maxWidth: 280 }}
          />
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={{ width: "auto", minWidth: 140 }}>
            {STATUSES.map(s => (
              <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : "All statuses"}</option>
            ))}
          </select>
          <select value={sort} onChange={e => setSort(e.target.value)} style={{ width: "auto", minWidth: 160 }}>
            <option value="created_at">Newest first</option>
            <option value="updated_at">Recently updated</option>
            <option value="original_filename">Name A-Z</option>
            <option value="file_size">File size</option>
          </select>
          <button className="btn-ghost" onClick={fetch}>↻ Refresh</button>
        </div>

        {/* Table */}
        {loading && docs.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--muted)" }}>Loading...</div>
        ) : docs.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <p style={{ color: "var(--muted)", marginBottom: 16 }}>No documents found.</p>
            <Link href="/upload"><button className="btn-primary">Upload your first document</button></Link>
          </div>
        ) : (
          <div style={{ background: "var(--bg2)", borderRadius: "var(--radius)", border: "1px solid var(--border)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Document", "Type", "Size", "Status", "Created", ""].map((h, i) => (
                    <th key={i} style={{
                      padding: "12px 16px", textAlign: "left",
                      fontSize: 12, fontWeight: 600,
                      color: "var(--muted)", letterSpacing: 0.5,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr
                    key={doc.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      cursor: "pointer",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg3)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    onClick={() => router.push(`/documents/${doc.id}`)}
                  >
                    <td style={{ padding: "12px 16px" }}>
                      <p style={{ fontWeight: 500, fontSize: 14 }}>{doc.original_filename}</p>
                      {doc.extracted_title && doc.extracted_title !== doc.original_filename && (
                        <p style={{ fontSize: 12, color: "var(--muted)" }}>{doc.extracted_title}</p>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>
                      {doc.file_type.split("/").pop()}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>
                      {formatBytes(doc.file_size)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <StatusBadge status={doc.status} />
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>
                      {timeAgo(doc.created_at)}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 13, color: "var(--accent2)" }}>View →</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24 }}>
            <button className="btn-ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <span style={{ padding: "8px 16px", color: "var(--muted)", fontSize: 14 }}>
              Page {page} of {totalPages}
            </span>
            <button className="btn-ghost" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </Layout>
  );
}
