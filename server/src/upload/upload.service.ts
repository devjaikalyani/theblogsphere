import { BadRequestException, Injectable } from '@nestjs/common';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

/**
 * Verify the file is actually one of the allowed raster images by inspecting
 * its magic bytes — the multer `mimetype` comes from the client and can be
 * spoofed. Returns the canonical extension (used as the object key) or null.
 * Note: SVG is intentionally NOT accepted (it can carry script payloads).
 */
function detectImageType(buf: Buffer): 'jpg' | 'png' | 'gif' | 'webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'gif';
  if (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp';
  return null;
}

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

@Injectable()
export class UploadService {
  private s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  private bucket = process.env.R2_BUCKET_NAME!;
  private publicUrl = process.env.R2_PUBLIC_URL!;

  async uploadFile(file: Express.Multer.File, folder = 'uploads'): Promise<string> {
    // Trust the bytes, not the client-supplied mimetype/filename.
    const detected = detectImageType(file.buffer);
    if (!detected) {
      throw new BadRequestException('File is not a valid JPEG, PNG, GIF, or WebP image.');
    }
    const contentType = EXT_TO_MIME[detected];
    const key = `${folder}/${randomUUID()}.${detected}`;

    // Generate presigned URL (pure crypto — no outbound connection, no TLS).
    // Then upload using Node's built-in fetch (undici) which has a separate
    // socket layer from the @aws-sdk https agent, bypassing the OpenSSL 3
    // handshake failure that affects the SDK's NodeHttpHandler on Node 20.
    const presignedUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn: 60 },
    );

    const res = await fetch(presignedUrl, {
      method: 'PUT',
      body: file.buffer,
      headers: { 'Content-Type': contentType },
    });

    if (!res.ok) {
      throw new Error(`R2 upload failed: ${res.status} ${res.statusText}`);
    }

    return `${this.publicUrl}/${key}`;
  }

  async deleteFile(url: string) {
    const key = url.replace(`${this.publicUrl}/`, '');
    await this.deleteKey(key);
  }

  /**
   * Best-effort deletion of several objects by their public URLs. Never throws —
   * orphan cleanup must not block the operation that triggered it (e.g. account
   * erasure). Only URLs that belong to our bucket are touched; anything else
   * (the default avatar, external links) is skipped.
   */
  async deleteFiles(urls: (string | null | undefined)[]) {
    if (!this.publicUrl) return;
    const prefix = `${this.publicUrl}/`;
    const keys = urls
      .filter((u): u is string => !!u && u.startsWith(prefix))
      .map((u) => u.slice(prefix.length));
    await Promise.all(
      keys.map((key) =>
        this.deleteKey(key).catch((e) =>
          console.error('[R2 cleanup] failed to delete', key, e?.message ?? e),
        ),
      ),
    );
  }

  // Presigned DELETE + fetch — the same undici path uploads use, which sidesteps
  // the OpenSSL-3/Node-20 handshake failure in the SDK's own HTTP transport.
  // A 404 is treated as success (the object is already gone).
  private async deleteKey(key: string) {
    const presignedUrl = await getSignedUrl(
      this.s3,
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 60 },
    );
    const res = await fetch(presignedUrl, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) {
      throw new Error(`R2 delete failed: ${res.status} ${res.statusText}`);
    }
  }
}
