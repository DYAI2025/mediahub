import { NextRequest, NextResponse } from "next/server";
import { ADMIN_PASSWORD } from "@/lib/config";
import { createSessionToken, setSessionCookie } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // Rate limit login attempts
  const rl = checkRateLimit(req);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many attempts, try again later" },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const { password } = body;

    if (!password || password !== ADMIN_PASSWORD()) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Invalid password" },
        { status: 401 }
      );
    }

    const token = createSessionToken();
    const response = NextResponse.json({ ok: true });
    setSessionCookie(response, token);

    return response;
  } catch {
    return NextResponse.json(
      { error: "INVALID_ARGUMENT", message: "Invalid request body" },
      { status: 400 }
    );
  }
}
