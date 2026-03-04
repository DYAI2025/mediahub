// Allowed MIME types and their max sizes in bytes
export const ALLOWED_TYPES: Record<string, { category: string; maxSize: number }> = {
  // Images – 20 MB
  "image/jpeg": { category: "image", maxSize: 20 * 1024 * 1024 },
  "image/png": { category: "image", maxSize: 20 * 1024 * 1024 },
  "image/webp": { category: "image", maxSize: 20 * 1024 * 1024 },
  "image/gif": { category: "image", maxSize: 20 * 1024 * 1024 },
  // Audio – 200 MB
  "audio/mpeg": { category: "audio", maxSize: 200 * 1024 * 1024 },
  "audio/wav": { category: "audio", maxSize: 200 * 1024 * 1024 },
  "audio/x-m4a": { category: "audio", maxSize: 200 * 1024 * 1024 },
  "audio/mp4": { category: "audio", maxSize: 200 * 1024 * 1024 },
  // Video – 2 GB
  "video/mp4": { category: "video", maxSize: 2 * 1024 * 1024 * 1024 },
  "video/webm": { category: "video", maxSize: 2 * 1024 * 1024 * 1024 },
};

// Allowed file extensions (mapped from MIME)
export const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif",
  "mp3", "wav", "m4a",
  "mp4", "webm",
]);

export function getEnvOrThrow(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const S3_CONFIG = {
  get endpoint() { return getEnvOrThrow("S3_ENDPOINT"); },
  get bucket() { return getEnvOrThrow("S3_BUCKET"); },
  get region() { return process.env.S3_REGION || "auto"; },
  get accessKeyId() { return getEnvOrThrow("S3_ACCESS_KEY_ID"); },
  get secretAccessKey() { return getEnvOrThrow("S3_SECRET_ACCESS_KEY"); },
};

export const PUBLIC_BASE_URL = () => getEnvOrThrow("PUBLIC_BASE_URL");
export const ADMIN_PASSWORD = () => getEnvOrThrow("ADMIN_PASSWORD");
export const SESSION_SECRET = () => process.env.SESSION_SECRET || getEnvOrThrow("ADMIN_PASSWORD");
export const RATE_LIMIT_RPM = () => parseInt(process.env.RATE_LIMIT_RPM || "30", 10);

export const PRESIGNED_URL_EXPIRY = 600; // 10 minutes
