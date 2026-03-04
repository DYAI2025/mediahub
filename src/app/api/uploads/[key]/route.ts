import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { deleteObject } from "@/lib/s3";
import { checkRateLimit } from "@/lib/rate-limit";

// DELETE /api/uploads/:key – Delete a file
export async function DELETE(
  req: NextRequest,
  { params }: { params: { key: string } }
) {
  if (!isAuthenticated(req)) {
    return unauthorizedResponse();
  }

  const rl = checkRateLimit(req);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many requests" },
      { status: 429 }
    );
  }

  try {
    // The key comes URL-encoded from the path param
    const key = decodeURIComponent(params.key);

    // Validate key format (must start with uploads/)
    if (!key.startsWith("uploads/")) {
      return NextResponse.json(
        { error: "INVALID_ARGUMENT", message: "Invalid key" },
        { status: 400 }
      );
    }

    await deleteObject(key);

    console.log(
      JSON.stringify({
        event: "upload_deleted",
        key,
        timestamp: new Date().toISOString(),
      })
    );

    return NextResponse.json({ ok: true, key });
  } catch (err) {
    console.error("Delete failed:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to delete file" },
      { status: 500 }
    );
  }
}
