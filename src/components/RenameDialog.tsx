"use client";

import { useState, useEffect } from "react";

export interface RenameDecision {
  file: File;
  finalName: string; // with extension
  wasRenamed: boolean;
}

interface PendingFile {
  file: File;
  previewUrl: string;
  suggestedName: string | null;
  analyzing: boolean;
  error: string | null;
}

interface RenameDialogProps {
  files: File[];
  onComplete: (decisions: RenameDecision[]) => void;
  onCancel: () => void;
}

function getExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

function isAnalyzable(file: File): boolean {
  return file.type.startsWith("image/") || file.type.startsWith("video/");
}

/** Extract a frame from a video file as base64 JPEG */
function extractVideoFrame(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadeddata = () => {
      // Seek to 1 second or 10% of duration
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(video.videoWidth, 1024);
      canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas context failed"));
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      URL.revokeObjectURL(url);
      resolve(dataUrl.split(",")[1]); // base64 only
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Video load failed"));
    };
  });
}

/** Resize image to max 1024px and return base64 JPEG */
function resizeImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    img.onload = () => {
      const maxDim = 1024;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round(h * (maxDim / w));
          w = maxDim;
        } else {
          w = Math.round(w * (maxDim / h));
          h = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas context failed"));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      URL.revokeObjectURL(url);
      resolve(dataUrl.split(",")[1]);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Image load failed"));
    };
  });
}

export default function RenameDialog({ files, onComplete, onCancel }: RenameDialogProps) {
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [decisions, setDecisions] = useState<RenameDecision[]>([]);
  const [editedName, setEditedName] = useState("");

  // Initialize pending files & start analysis
  useEffect(() => {
    const items: PendingFile[] = files.map((file) => ({
      file,
      previewUrl: file.type.startsWith("image/") || file.type.startsWith("video/")
        ? URL.createObjectURL(file)
        : "",
      suggestedName: null,
      analyzing: isAnalyzable(file),
      error: null,
    }));
    setPending(items);

    // Analyze all analyzable files in parallel
    items.forEach((item, idx) => {
      if (!isAnalyzable(item.file)) {
        // Audio files: skip analysis, mark not analyzing
        setPending((prev) =>
          prev.map((p, i) => (i === idx ? { ...p, analyzing: false } : p))
        );
        return;
      }

      (async () => {
        try {
          const isVideo = item.file.type.startsWith("video/");
          const base64 = isVideo
            ? await extractVideoFrame(item.file)
            : await resizeImageToBase64(item.file);

          const res = await fetch("/api/analyze-media", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageBase64: base64,
              originalName: item.file.name,
              mediaType: isVideo ? "video" : "image",
            }),
          });

          if (res.ok) {
            const data = await res.json();
            setPending((prev) =>
              prev.map((p, i) =>
                i === idx
                  ? { ...p, suggestedName: data.suggestedName, analyzing: false }
                  : p
              )
            );
          } else {
            const data = await res.json().catch(() => ({ message: "Analyse fehlgeschlagen" }));
            setPending((prev) =>
              prev.map((p, i) =>
                i === idx
                  ? { ...p, analyzing: false, error: data.message || "Fehler" }
                  : p
              )
            );
          }
        } catch (err) {
          setPending((prev) =>
            prev.map((p, i) =>
              i === idx
                ? { ...p, analyzing: false, error: "Analyse fehlgeschlagen" }
                : p
            )
          );
        }
      })();
    });

    return () => {
      items.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update editedName when current item changes or suggestion arrives
  useEffect(() => {
    if (pending.length === 0 || currentIndex >= pending.length) return;
    const item = pending[currentIndex];
    if (item.suggestedName) {
      setEditedName(item.suggestedName);
    }
  }, [currentIndex, pending]);

  const current = pending[currentIndex];
  if (!current) return null;

  const ext = getExtension(current.file.name);
  const isCurrentAnalyzable = isAnalyzable(current.file);
  const allDone = decisions.length === files.length;

  const handleDecision = (rename: boolean) => {
    const finalName = rename && editedName.trim()
      ? `${editedName.trim()}.${ext}`
      : current.file.name;

    const decision: RenameDecision = {
      file: current.file,
      finalName,
      wasRenamed: rename && editedName.trim() !== "",
    };

    const newDecisions = [...decisions, decision];
    setDecisions(newDecisions);

    if (newDecisions.length === files.length) {
      // All decided
      onComplete(newDecisions);
    } else {
      setCurrentIndex(currentIndex + 1);
      setEditedName("");
    }
  };

  // Skip non-analyzable files automatically
  const handleSkipAudio = () => handleDecision(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div className="text-sm text-gray-400">
            Datei {currentIndex + 1} von {files.length}
          </div>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-white transition text-lg"
            title="Abbrechen"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Preview */}
          {current.file.type.startsWith("image/") && current.previewUrl && (
            <div className="flex justify-center">
              <img
                src={current.previewUrl}
                alt=""
                className="max-h-48 rounded-lg object-contain bg-gray-800"
              />
            </div>
          )}
          {current.file.type.startsWith("video/") && current.previewUrl && (
            <div className="flex justify-center">
              <video
                src={current.previewUrl}
                className="max-h-48 rounded-lg bg-gray-800"
                muted
                playsInline
              />
            </div>
          )}

          {/* Original name */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Originaler Dateiname</label>
            <div className="text-sm font-mono text-gray-300 bg-gray-800 px-3 py-2 rounded-lg truncate">
              {current.file.name}
            </div>
          </div>

          {/* AI Analysis */}
          {isCurrentAnalyzable && (
            <>
              {current.analyzing ? (
                <div className="flex items-center gap-3 py-3">
                  <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
                  <span className="text-sm text-gray-400">KI analysiert {current.file.type.startsWith("video/") ? "Video" : "Bild"}…</span>
                </div>
              ) : current.error ? (
                <div className="text-sm text-yellow-400 bg-yellow-900/20 px-3 py-2 rounded-lg">
                  ⚠ {current.error} – Datei wird mit Originalnamen gespeichert
                </div>
              ) : current.suggestedName ? (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    🤖 KI-Vorschlag (editierbar)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="flex-1 px-3 py-2 bg-gray-800 border border-blue-500/50 rounded-lg text-sm text-white font-mono focus:border-blue-400 focus:outline-none"
                      spellCheck={false}
                    />
                    <span className="text-sm text-gray-500">.{ext}</span>
                  </div>
                </div>
              ) : null}
            </>
          )}

          {!isCurrentAnalyzable && (
            <div className="text-sm text-gray-400 bg-gray-800 px-3 py-2 rounded-lg">
              🎵 Audio-Datei – keine KI-Analyse möglich
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-800 bg-gray-900/50">
          {isCurrentAnalyzable && current.suggestedName && !current.analyzing ? (
            <>
              <button
                onClick={() => handleDecision(true)}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition"
              >
                ✓ Umbenennen
              </button>
              <button
                onClick={() => handleDecision(false)}
                className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition"
              >
                Ohne Änderung speichern
              </button>
            </>
          ) : isCurrentAnalyzable && current.analyzing ? (
            <button
              onClick={() => handleDecision(false)}
              className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition"
            >
              Überspringen (Originalname behalten)
            </button>
          ) : isCurrentAnalyzable && current.error ? (
            <button
              onClick={() => handleDecision(false)}
              className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition"
            >
              Ohne Änderung speichern
            </button>
          ) : (
            /* Audio */
            <button
              onClick={handleSkipAudio}
              className="flex-1 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition"
            >
              Ohne Änderung speichern
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${((currentIndex) / files.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
