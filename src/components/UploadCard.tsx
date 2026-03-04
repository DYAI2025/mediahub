"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";

type UploadState = "idle" | "uploading" | "success" | "error";

const ALLOWED_EXTENSIONS = [
  ".jpg", ".jpeg", ".png", ".webp", ".gif",
  ".mp3", ".wav", ".m4a",
  ".mp4", ".webm",
];

const ACCEPT_STRING = ALLOWED_EXTENSIONS.join(",");

export default function UploadCard() {
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [publicUrl, setPublicUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [fileName, setFileName] = useState("");
  const [copied, setCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setState("idle");
    setProgress(0);
    setPublicUrl("");
    setErrorMsg("");
    setFileName("");
    setCopied(false);
  };

  const uploadFile = async (file: File) => {
    reset();
    setFileName(file.name);
    setState("uploading");

    try {
      // Step 1: Get presigned URL
      const metaRes = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });

      if (!metaRes.ok) {
        const err = await metaRes.json();
        throw new Error(err.message || `Fehler ${metaRes.status}`);
      }

      const { uploadUrl, publicUrl: url } = await metaRes.json();

      // Step 2: Upload to S3 via presigned URL with progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", file.type);

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload fehlgeschlagen (HTTP ${xhr.status})`));
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Netzwerkfehler beim Upload")));
        xhr.addEventListener("abort", () => reject(new Error("Upload abgebrochen")));

        xhr.send(file);
      });

      setPublicUrl(url);
      setState("success");
    } catch (err: unknown) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Unbekannter Fehler");
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = "";
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = publicUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Datei hochladen</h2>

      {/* Drop Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => state !== "uploading" && fileRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
          ${dragOver ? "border-blue-400 bg-blue-950/30" : "border-gray-700 hover:border-gray-500"}
          ${state === "uploading" ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_STRING}
          onChange={handleFileChange}
          className="hidden"
        />

        {state === "idle" && (
          <div>
            <p className="text-gray-300 mb-1">Datei hierher ziehen oder klicken</p>
            <p className="text-xs text-gray-500">
              Bilder (20 MB) · Audio (200 MB) · Video (2 GB)
            </p>
          </div>
        )}

        {state === "uploading" && (
          <div>
            <p className="text-gray-300 mb-2">
              {fileName} wird hochgeladen… {progress}%
            </p>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {state === "success" && (
          <div>
            <p className="text-green-400 mb-1">✓ Upload erfolgreich!</p>
            <p className="text-xs text-gray-500">{fileName}</p>
          </div>
        )}

        {state === "error" && (
          <div>
            <p className="text-red-400 mb-1">✗ {errorMsg}</p>
            <p className="text-xs text-gray-500">Klicken für neuen Versuch</p>
          </div>
        )}
      </div>

      {/* Success: URL + Copy */}
      {state === "success" && publicUrl && (
        <div className="mt-4 flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={publicUrl}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 font-mono"
          />
          <button
            onClick={copyUrl}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition whitespace-nowrap"
          >
            {copied ? "Kopiert ✓" : "URL kopieren"}
          </button>
          <button
            onClick={reset}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
          >
            Neu
          </button>
        </div>
      )}

      {/* Screen reader announcement */}
      <div aria-live="polite" className="sr-only">
        {state === "success" && "Upload erfolgreich. URL wurde generiert."}
        {state === "error" && `Fehler: ${errorMsg}`}
      </div>
    </div>
  );
}
