"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import RenameDialog, { RenameDecision } from "./RenameDialog";

interface FileUpload {
  file: File;
  displayName: string;
  state: "pending" | "uploading" | "success" | "error";
  progress: number;
  publicUrl?: string;
  errorMsg?: string;
}

const ALLOWED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".webp", ".gif",
  ".mp3", ".wav", ".m4a",
  ".mp4", ".webm",
];

const ACCEPT_STRING = ALLOWED_EXTENSIONS.join(",");

interface UploadCardProps {
  onUploadComplete?: () => void;
}

export default function UploadCard({ onUploadComplete }: UploadCardProps) {
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateUpload = (index: number, update: Partial<FileUpload>) => {
    setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, ...update } : u)));
  };

  const uploadSingleFile = async (
    file: File,
    displayName: string,
    index: number
  ) => {
    updateUpload(index, { state: "uploading", progress: 0 });

    try {
      // Step 1: Get presigned URL (use displayName as filename for S3 key)
      const metaRes = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: displayName,
          contentType: file.type,
          size: file.size,
        }),
      });

      if (!metaRes.ok) {
        const err = await metaRes.json();
        throw new Error(err.message || `Fehler ${metaRes.status}`);
      }

      const { uploadUrl, publicUrl } = await metaRes.json();

      // Step 2: Upload to S3
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            updateUpload(index, {
              progress: Math.round((e.loaded / e.total) * 100),
            });
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`HTTP ${xhr.status}`));
        });

        xhr.addEventListener("error", () => reject(new Error("Netzwerkfehler")));
        xhr.addEventListener("abort", () => reject(new Error("Abgebrochen")));

        xhr.send(file);
      });

      updateUpload(index, { state: "success", progress: 100, publicUrl });
    } catch (err: unknown) {
      updateUpload(index, {
        state: "error",
        errorMsg: err instanceof Error ? err.message : "Unbekannter Fehler",
      });
    }
  };

  const startUpload = async (decisions: RenameDecision[]) => {
    if (decisions.length === 0) return;

    const newUploads: FileUpload[] = decisions.map((d) => ({
      file: d.file,
      displayName: d.finalName,
      state: "pending" as const,
      progress: 0,
    }));

    setUploads(newUploads);
    setIsUploading(true);

    // Upload with concurrency limit of 3
    const CONCURRENCY = 3;
    let nextIndex = 0;

    const runNext = async (): Promise<void> => {
      while (nextIndex < decisions.length) {
        const idx = nextIndex++;
        await uploadSingleFile(decisions[idx].file, decisions[idx].finalName, idx);
      }
    };

    const workers = Array.from(
      { length: Math.min(CONCURRENCY, decisions.length) },
      () => runNext()
    );
    await Promise.all(workers);

    setIsUploading(false);
    onUploadComplete?.();
  };

  const handleFilesSelected = (files: File[]) => {
    if (files.length === 0) return;

    // Check if any files are images or videos (analyzable)
    const hasAnalyzable = files.some(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );

    if (hasAnalyzable) {
      // Show rename dialog
      setPendingFiles(files);
    } else {
      // Audio-only: skip dialog, upload directly
      const decisions: RenameDecision[] = files.map((f) => ({
        file: f,
        finalName: f.name,
        wasRenamed: false,
      }));
      startUpload(decisions);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleFilesSelected(files);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFilesSelected(files);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleRenameComplete = (decisions: RenameDecision[]) => {
    setPendingFiles(null);
    startUpload(decisions);
  };

  const handleRenameCancel = () => {
    setPendingFiles(null);
  };

  const clearUploads = () => setUploads([]);

  const hasResults = uploads.length > 0;
  const successCount = uploads.filter((u) => u.state === "success").length;
  const errorCount = uploads.filter((u) => u.state === "error").length;

  return (
    <>
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Dateien hochladen</h2>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
            ${dragOver ? "border-blue-400 bg-blue-950/30" : "border-gray-700 hover:border-gray-500"}
            ${isUploading ? "pointer-events-none opacity-60" : ""}
          `}
        >
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_STRING}
            onChange={handleFileChange}
            className="hidden"
            multiple
          />

          <p className="text-gray-300 mb-1">
            Dateien hierher ziehen oder klicken
          </p>
          <p className="text-xs text-gray-500">
            Mehrere Dateien möglich · Bilder &amp; Videos werden per KI erkannt
            · Namensvorschlag automatisch
          </p>
        </div>

        {/* Upload Progress List */}
        {hasResults && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">
                {isUploading
                  ? `Lade hoch… (${successCount}/${uploads.length})`
                  : `${successCount} erfolgreich${errorCount > 0 ? `, ${errorCount} fehlgeschlagen` : ""}`}
              </span>
              {!isUploading && (
                <button
                  onClick={clearUploads}
                  className="text-xs text-gray-500 hover:text-white transition"
                >
                  Schließen
                </button>
              )}
            </div>

            {uploads.map((u, i) => (
              <div
                key={`${u.displayName}-${i}`}
                className="flex items-center gap-3 px-3 py-2 bg-gray-800/50 rounded-lg text-sm"
              >
                {/* Status */}
                <span className="flex-shrink-0 w-5 text-center">
                  {u.state === "pending" && (
                    <span className="text-gray-500">⏳</span>
                  )}
                  {u.state === "uploading" && (
                    <span className="text-blue-400">↑</span>
                  )}
                  {u.state === "success" && (
                    <span className="text-green-400">✓</span>
                  )}
                  {u.state === "error" && (
                    <span className="text-red-400">✗</span>
                  )}
                </span>

                {/* Filename */}
                <span className="flex-1 min-w-0 truncate font-mono text-gray-300">
                  {u.displayName}
                </span>

                {/* Progress bar */}
                {u.state === "uploading" && (
                  <div className="w-24 flex-shrink-0">
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${u.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {u.state === "error" && (
                  <span className="text-xs text-red-400 flex-shrink-0">
                    {u.errorMsg}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rename Dialog (Modal) */}
      {pendingFiles && (
        <RenameDialog
          files={pendingFiles}
          onComplete={handleRenameComplete}
          onCancel={handleRenameCancel}
        />
      )}
    </>
  );
}
