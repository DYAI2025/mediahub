import { ALLOWED_TYPES, ALLOWED_EXTENSIONS } from "./config";

export interface UploadRequest {
  filename: string;
  contentType: string;
  size: number;
}

export interface ValidationError {
  code: string;
  message: string;
  status: number;
}

export function validateUpload(body: UploadRequest): ValidationError | null {
  // Check filename
  if (!body.filename || typeof body.filename !== "string" || body.filename.length > 255) {
    return {
      code: "INVALID_ARGUMENT",
      message: "Invalid or missing filename",
      status: 400,
    };
  }

  // Extract and check extension
  const ext = body.filename.split(".").pop()?.toLowerCase();
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    return {
      code: "INVALID_ARGUMENT",
      message: `File extension '.${ext}' is not allowed. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}`,
      status: 400,
    };
  }

  // Check content type
  const typeConfig = ALLOWED_TYPES[body.contentType];
  if (!typeConfig) {
    return {
      code: "INVALID_ARGUMENT",
      message: `Content type '${body.contentType}' is not allowed. Allowed: ${Object.keys(ALLOWED_TYPES).join(", ")}`,
      status: 400,
    };
  }

  // Check size
  if (!body.size || typeof body.size !== "number" || body.size <= 0) {
    return {
      code: "INVALID_ARGUMENT",
      message: "Invalid file size",
      status: 400,
    };
  }

  if (body.size > typeConfig.maxSize) {
    const maxMB = Math.round(typeConfig.maxSize / (1024 * 1024));
    return {
      code: "PAYLOAD_TOO_LARGE",
      message: `File size exceeds maximum of ${maxMB} MB for ${typeConfig.category} files`,
      status: 413,
    };
  }

  // Sanitize: reject dangerous content types that could be spoofed
  const dangerousTypes = [
    "text/html",
    "application/javascript",
    "application/x-javascript",
    "text/javascript",
    "application/xhtml+xml",
    "application/xml",
    "text/xml",
  ];
  if (dangerousTypes.includes(body.contentType.toLowerCase())) {
    return {
      code: "INVALID_ARGUMENT",
      message: "This content type is not allowed for security reasons",
      status: 400,
    };
  }

  return null;
}
