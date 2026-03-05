import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

// POST /api/analyze-media – Analyze image/video frame via Vision AI
export async function POST(req: NextRequest) {
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
    const body = await req.json();
    const { imageBase64, originalName, mediaType } = body;

    if (!imageBase64 || !originalName) {
      return NextResponse.json(
        { error: "INVALID_ARGUMENT", message: "imageBase64 and originalName required" },
        { status: 400 }
      );
    }

    // Check AI config
    const apiKey = process.env.VISION_API_KEY || process.env.OPENAI_API_KEY;
    const apiEndpoint = process.env.VISION_API_ENDPOINT || "https://api.openai.com/v1/chat/completions";
    const model = process.env.VISION_MODEL || "gpt-4o-mini";

    if (!apiKey) {
      return NextResponse.json(
        { error: "NOT_CONFIGURED", message: "Vision AI not configured (set VISION_API_KEY or OPENAI_API_KEY)" },
        { status: 501 }
      );
    }

    const mediaLabel = mediaType === "video" ? "Video-Frame" : "Bild";

    // Build headers – add OpenRouter-specific headers if using openrouter.ai
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    if (apiEndpoint.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = process.env.PUBLIC_BASE_URL || "https://mediahub.local";
      headers["X-Title"] = "MediaHub";
    }

    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analysiere dieses ${mediaLabel} und generiere einen kurzen, beschreibenden Dateinamen auf Deutsch.

Regeln:
- Maximal 3-5 Wörter, getrennt durch Bindestriche
- Nur Kleinbuchstaben, keine Sonderzeichen außer Bindestrichen
- Beschreibe WAS im Bild zu sehen ist (Hauptmotiv)
- Falls ein Ort erkennbar ist, nenne ihn
- Falls Personen zu sehen sind, beschreibe die Szene (z.B. "gruppe-am-strand", "portrait-frau-park")
- Falls ein Schild/Text zu sehen ist, integriere den Text
- KEINE Dateiendung anfügen

Beispiele guter Namen:
- sonnenuntergang-am-meer
- cafe-terrasse-paris
- hund-im-schnee
- stadtpanorama-berlin-nacht
- gruppe-feier-garten

Antworte NUR mit dem vorgeschlagenen Dateinamen, nichts anderes.`,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 60,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Vision AI error:", response.status, errText);
      return NextResponse.json(
        { error: "AI_ERROR", message: `Vision AI returned ${response.status}` },
        { status: 502 }
      );
    }

    const result = await response.json();
    const suggestedName = result.choices?.[0]?.message?.content?.trim();

    if (!suggestedName) {
      return NextResponse.json(
        { error: "AI_ERROR", message: "No suggestion returned" },
        { status: 502 }
      );
    }

    // Sanitize the suggestion
    const sanitized = suggestedName
      .toLowerCase()
      .replace(/[^a-z0-9äöüß\-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 80);

    return NextResponse.json({ suggestedName: sanitized });
  } catch (err) {
    console.error("Analyze media failed:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Analysis failed" },
      { status: 500 }
    );
  }
}
