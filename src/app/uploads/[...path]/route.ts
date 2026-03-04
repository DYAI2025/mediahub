import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { S3_CONFIG } from "@/lib/config";

let _client: S3Client | null = null;
function getClient(): S3Client {
  if (!_client) {
    _client = new S3Client({
      endpoint: S3_CONFIG.endpoint,
      region: S3_CONFIG.region,
      credentials: {
        accessKeyId: S3_CONFIG.accessKeyId,
        secretAccessKey: S3_CONFIG.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }
  return _client;
}

// Cache-friendly headers for immutable media files
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=31536000, immutable",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const key = `uploads/${params.path.join("/")}`;

  try {
    const command = new GetObjectCommand({
      Bucket: S3_CONFIG.bucket,
      Key: key,
    });

    const response = await getClient().send(command);

    if (!response.Body) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Stream the body through
    const stream = response.Body as ReadableStream;

    return new NextResponse(stream as any, {
      status: 200,
      headers: {
        "Content-Type": response.ContentType || "application/octet-stream",
        ...(response.ContentLength && {
          "Content-Length": String(response.ContentLength),
        }),
        ...CACHE_HEADERS,
      },
    });
  } catch (err: any) {
    if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
      return new NextResponse("Not Found", { status: 404 });
    }
    console.error("File proxy error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
