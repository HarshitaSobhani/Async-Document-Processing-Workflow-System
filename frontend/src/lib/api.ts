const API_URL = (typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_API_URL || "")
  : (process.env.NEXT_PUBLIC_API_URL || "")).replace(/\/$/, "");

export interface Document {
  id: string;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  status: "queued" | "processing" | "completed" | "failed" | "finalized";
  retry_count: number;
  extracted_title?: string;
  extracted_category?: string;
  extracted_summary?: string;
  extracted_keywords?: string[];
  raw_text?: string;
  structured_output?: Record<string, unknown>;
  reviewed_output?: Record<string, unknown>;
  is_finalized: string;
  finalized_at?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface DocumentList {
  items: Document[];
  total: number;
}

export interface ProgressEvent {
  document_id: string;
  event: string;
  message: string;
  progress: number;
  timestamp: string;
}

export const api = {
  async uploadFiles(files: File[]): Promise<Document[]> {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    const res = await fetch(`${API_URL}/api/documents/upload`, { method: "POST", body: form });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async listDocuments(params: { status?: string; search?: string; sort?: string; page?: number }): Promise<DocumentList> {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.search) q.set("search", params.search);
    if (params.sort) q.set("sort", params.sort);
    if (params.page) q.set("page", String(params.page));
    const res = await fetch(`${API_URL}/api/documents?${q}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getDocument(id: string): Promise<Document> {
    const res = await fetch(`${API_URL}/api/documents/${id}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getStatus(id: string): Promise<ProgressEvent> {
    const res = await fetch(`${API_URL}/api/documents/${id}/status`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateReview(id: string, data: { title?: string; category?: string; summary?: string; keywords?: string[] }): Promise<Document> {
    const res = await fetch(`${API_URL}/api/documents/${id}/review`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async finalize(id: string): Promise<Document> {
    const res = await fetch(`${API_URL}/api/documents/${id}/finalize`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async retry(id: string): Promise<Document> {
    const res = await fetch(`${API_URL}/api/documents/${id}/retry`, { method: "POST" });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  exportUrl(id: string, fmt: "json" | "csv"): string {
    return `${API_URL}/api/documents/${id}/export/${fmt}`;
  },

  subscribeProgress(id: string, onEvent: (e: ProgressEvent) => void): () => void {
    const es = new EventSource(`${API_URL}/api/documents/${id}/progress`);
    es.onmessage = (e) => {
      try { onEvent(JSON.parse(e.data)); } catch {}
    };
    return () => es.close();
  },
};
