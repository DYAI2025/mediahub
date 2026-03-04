"use client";

import { useState, useEffect, useCallback } from "react";

interface UploadItem {
  key: string;
  publicUrl: string;
  size: number;
  lastModified?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getFileIcon(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) return "🖼️";
  if (["mp3", "wav", "m4a"].includes(ext || "")) return "🎵";
  if (["mp4", "webm"].includes(ext || "")) return "🎬";
  return "📄";
}

export default function RecentUploads() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchUploads = useCallback(async () => {
    try {
      const res = await fetch("/api/uploads");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch {
      // Ignore errors silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  const copyUrl = async (url: string, key: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const deleteFile = async (key: string) => {
    if (!confirm(`Datei wirklich löschen?\n${key}`)) return;

    try {
      const encodedKey = encodeURIComponent(key);
      const res = await fetch(`/api/uploads/${encodedKey}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((item) => item.key !== key));
      } else {
        const data = await res.json();
        alert(data.message || "Löschen fehlgeschlagen");
      }
    } catch {
      alert("Verbindungsfehler");
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse text-gray-500">Lade Uploads…</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Letzte Uploads</h2>
        <button
          onClick={() => { setLoading(true); fetchUploads(); }}
          className="text-sm text-gray-400 hover:text-white transition"
        >
          ↻ Aktualisieren
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-500 text-sm">Noch keine Uploads vorhanden.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition group"
            >
              <span className="text-xl">{getFileIcon(item.key)}</span>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono text-gray-200 truncate">
                  {item.key.split("/").pop()}
                </p>
                <p className="text-xs text-gray-500">
                  {formatSize(item.size)}
                  {item.lastModified && (
                    <> · {new Date(item.lastModified).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}</>
                  )}
                </p>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={() => copyUrl(item.publicUrl, item.key)}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 rounded transition"
                >
                  {copiedKey === item.key ? "✓" : "URL"}
                </button>
                <a
                  href={item.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded transition"
                >
                  ↗
                </a>
                <button
                  onClick={() => deleteFile(item.key)}
                  className="px-3 py-1 text-xs bg-red-900 hover:bg-red-700 rounded transition"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
