import React from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <nav style={{
        background: "var(--bg2)",
        borderBottom: "1px solid var(--border)",
        padding: "0 32px",
        display: "flex",
        alignItems: "center",
        gap: 32,
        height: 60,
      }}>
        <Link href="/" style={{ fontWeight: 700, fontSize: 18, color: "var(--accent2)", letterSpacing: -0.5 }}>
          ⚡ DocFlow
        </Link>
        <Link href="/" style={{ color: router.pathname === "/" ? "var(--text)" : "var(--muted)", fontSize: 14 }}>
          Dashboard
        </Link>
        <Link href="/upload" style={{ color: router.pathname === "/upload" ? "var(--text)" : "var(--muted)", fontSize: 14 }}>
          Upload
        </Link>
      </nav>
      <main style={{ flex: 1, padding: "32px" }}>
        {children}
      </main>
    </div>
  );
}
