"use client";

import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";

interface MediaItem {
  key: string;
  publicUrl: string;
  size: number;
  lastModified?: string;
  category: "image" | "video" | "audio" | "other";
}

export interface MediaLibraryHandle {
  refresh: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function categorizeFile(key: string): MediaItem["category"] {
  const ext = key.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) return "image";
  if (["mp4", "webm"].includes(ext || "")) return "video";
  if (["mp3", "wav", "m4a"].includes(ext || "")) return "audio";
  return "other";
}

const CATEGORY_CONFIG = {
  image: { label: "🖼️ Bilder", emoji: "🖼️", color: "blue" },
  video: { label: "🎬 Videos", emoji: "🎬", color: "purple" },
  audio: { label: "🎵 Audio", emoji: "🎵", color: "green" },
} as const;

type Category = keyof typeof CATEGORY_CONFIG;

const MediaLibrary = forwardRef<MediaLibraryHandle>(function MediaLibrary(_, ref) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<Category>>(new Set());

  const fetchUploads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/uploads");
      if (res.ok) {
        const data = await res.json();
        const enriched: MediaItem[] = (data.items || []).map((item: Omit<MediaItem, "category">) => ({
          ...item,
          category: categorizeFile(item.key),
        }));
        setItems(enriched);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  // Expose refresh to parent
  useImperativeHandle(ref, () => ({
    refresh: fetchUploads,
  }));

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
    if (!confirm(`Datei wirklich löschen?\n${key.split("/").pop()}`)) return;
    try {
      const encodedKey = encodeURIComponent(key);
      const res = await fetch(`/api/uploads/${encodedKey}`, { method: "DELETE" });
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

  const toggleSection = (cat: Category) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Group by category
  const grouped: Record<Category, MediaItem[]> = { image: [], video: [], audio: [] };
  for (const item of items) {
    if (item.category in grouped) {
      grouped[item.category as Category].push(item);
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="animate-pulse text-gray-500">Lade Mediathek…</div>
      </div>
    );
  }

  const totalCount = items.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Mediathek
          <span className="text-sm font-normal text-gray-500 ml-2">
            {totalCount} {totalCount === 1 ? "Datei" : "Dateien"}
          </span>
        </h2>
        <button
          onClick={fetchUploads}
          className="text-sm text-gray-400 hover:text-white transition"
        >
          ↻ Aktualisieren
        </button>
      </div>

      {totalCount === 0 ? (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
          <p className="text-gray-500">Noch keine Dateien vorhanden.</p>
        </div>
      ) : (
        (Object.keys(CATEGORY_CONFIG) as Category[]).map((cat) => {
          const catItems = grouped[cat];
          if (catItems.length === 0) return null;
          const config = CATEGORY_CONFIG[cat];
          const isCollapsed = collapsedSections.has(cat);

          return (
            <div
              key={cat}
              className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden"
            >
              {/* Section Header */}
              <button
                onClick={() => toggleSection(cat)}
                className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-800/50 transition"
              >
                <span className="font-medium">
                  {config.label}
                  <span className="text-sm text-gray-500 ml-2">
                    ({catItems.length})
                  </span>
                </span>
                <span className="text-gray-500 text-sm">
                  {isCollapsed ? "▸" : "▾"}
                </span>
              </button>

              {/* File List */}
              {!isCollapsed && (
                <div className="border-t border-gray-800">
                  {catItems.map((item, idx) => (
                    <div
                      key={item.key}
                      className={`flex items-center gap-3 px-5 py-3 hover:bg-gray-800/40 transition ${
                        idx < catItems.length - 1 ? "border-b border-gray-800/50" : ""
                      }`}
                    >
                      {/* Thumbnail for images */}
                      {cat === "image" ? (
                        <img
                          src={item.publicUrl}
                          alt=""
                          className="w-10 h-10 rounded object-cover flex-shrink-0 bg-gray-800"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xl w-10 text-center flex-shrink-0">
                          {config.emoji}
                        </span>
                      )}

                      {/* File info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-mono text-gray-200 truncate">
                          {item.key.split("/").pop()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatSize(item.size)}
                          {item.lastModified && (
                            <>
                              {" · "}
                              {new Date(item.lastModified).toLocaleDateString("de-DE", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </>
                          )}
                        </p>
                      </div>

                      {/* Action buttons – always visible */}
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => copyUrl(item.publicUrl, item.key)}
                          className={`px-3 py-1.5 text-xs rounded transition font-medium ${
                            copiedKey === item.key
                              ? "bg-green-600 text-white"
                              : "bg-blue-600 hover:bg-blue-500 text-white"
                          }`}
                          title="URL kopieren"
                        >
                          {copiedKey === item.key ? "✓ Kopiert" : "📋 URL"}
                        </button>
                        <a
                          href={item.publicUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded transition"
                          title="Öffnen"
                        >
                          ↗
                        </a>
                        <button
                          onClick={() => deleteFile(item.key)}
                          className="px-3 py-1.5 text-xs bg-red-900/80 hover:bg-red-700 rounded transition"
                          title="Löschen"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
});

export default MediaLibrary;
