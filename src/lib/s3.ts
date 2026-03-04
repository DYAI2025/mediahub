import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3_CONFIG, PRESIGNED_URL_EXPIRY } from "./config";

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
      forcePathStyle: true, // needed for R2 and most S3-compatible stores
    });
  }
  return _client;
}

export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
  contentLength: number
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: S3_CONFIG.bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
    // Security headers
    Metadata: {
      "uploaded-via": "mediahub",
    },
  });

  return getSignedUrl(getClient(), command, {
    expiresIn: PRESIGNED_URL_EXPIRY,
  });
}

export async function deleteObject(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: S3_CONFIG.bucket,
    Key: key,
  });
  await getClient().send(command);
}

export async function listObjects(
  prefix: string = "uploads/",
  maxKeys: number = 50
): Promise<Array<{ key: string; size: number; lastModified: Date | undefined }>> {
  const command = new ListObjectsV2Command({
    Bucket: S3_CONFIG.bucket,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  const response = await getClient().send(command);

  return (response.Contents || [])
    .sort((a, b) => {
      const da = a.LastModified?.getTime() || 0;
      const db = b.LastModified?.getTime() || 0;
      return db - da; // newest first
    })
    .map((obj) => ({
      key: obj.Key || "",
      size: obj.Size || 0,
      lastModified: obj.LastModified,
    }));
}
