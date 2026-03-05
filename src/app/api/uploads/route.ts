import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { validateUpload } from "@/lib/validation";
import { createPresignedUploadUrl, listObjects } from "@/lib/s3";
import { PUBLIC_BASE_URL, PRESIGNED_URL_EXPIRY } from "@/lib/config";

// POST /api/uploads – Create a presigned upload URL
export async function POST(req: NextRequest) {
  // Auth check
  if (!isAuthenticated(req)) {
    return unauthorizedResponse();
  }

  // Rate limit
  const rl = checkRateLimit(req);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many requests, try again later" },
      {
        status: 429,
        headers: { "X-RateLimit-Remaining": String(rl.remaining) },
      }
    );
  }

  try {
    const body = await req.json();

    // Validate
    const validationError = validateUpload(body);
    if (validationError) {
      return NextResponse.json(
        { error: validationError.code, message: validationError.message },
        { status: validationError.status }
      );
    }

    // Generate key: uploads/YYYY/MM/<uuid>.<ext>
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const ext = body.filename.split(".").pop()?.toLowerCase();
    const uuid = randomUUID();
    const key = `uploads/${year}/${month}/${uuid}.${ext}`;

    // Create presigned URL
    const uploadUrl = await createPresignedUploadUrl(
      key,
      body.contentType,
      body.size
    );

    const baseUrl = PUBLIC_BASE_URL().replace(/\/$/, "");
    const publicUrl = `${baseUrl}/${key}`;

    console.log(
      JSON.stringify({
        event: "upload_created",
        key,
        size: body.size,
        contentType: body.contentType,
        timestamp: now.toISOString(),
      })
    );

    return NextResponse.json(
      {
        key,
        publicUrl,
        uploadUrl,
        expiresIn: PRESIGNED_URL_EXPIRY,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Upload creation failed:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to create upload" },
      { status: 500 }
    );
  }
}

// GET /api/uploads – List recent uploads
export async function GET(req: NextRequest) {
  if (!isAuthenticated(req)) {
    return unauthorizedResponse();
  }

  try {
    const objects = await listObjects("uploads/", 500);
    const baseUrl = PUBLIC_BASE_URL().replace(/\/$/, "");

    const items = objects.map((obj) => ({
      key: obj.key,
      publicUrl: `${baseUrl}/${obj.key}`,
      size: obj.size,
      lastModified: obj.lastModified?.toISOString(),
    }));

    return NextResponse.json({ items, count: items.length });
  } catch (err) {
    console.error("List uploads failed:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to list uploads" },
      { status: 500 }
    );
  }
}
