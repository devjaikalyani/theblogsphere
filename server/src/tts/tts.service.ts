import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

/** The OpenAI voice used for narration — a warm, natural female reader. */
const VOICE = 'nova';
/** tts-1 (not tts-1-hd): half the price ($15 vs $30 / 1M chars) for a voice
 *  that is still natural. Halving the per-character cost is what lets Writer
 *  Pro's monthly narration budget stay comfortably profitable. */
const MODEL = 'tts-1';
/** OpenAI TTS rejects input longer than 4096 chars, so we narrate in chunks
 *  and concatenate the mp3s (mp3 frames are self-contained → plays back fine). */
const MAX_CHUNK = 3800;

/** What one narration request needs to know before spending provider credits:
 *  the target URL/key, the exact billable text (and its character count), and
 *  whether the audio is already cached (a free re-listen). */
export interface NarrationPrep {
  url: string;
  key: string;
  text: string;
  chars: number;
  cached: boolean;
}

@Injectable()
export class TtsService {
  // Same R2/S3 setup as UploadService; audio is cached in the same bucket.
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

  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  /** Narration is optional — without an OpenAI key the endpoint 400s and the
   *  client falls back to the on-device browser voice. */
  get enabled(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  /** Resolve a story to its narration URL + the billable text, and report
   *  whether the audio is already cached. Keyed by content hash so an edited
   *  story re-narrates. Does NOT generate — the caller meters `chars` against
   *  the plan first, then calls generateNarration only on a cache miss. */
  async prepareNarration(blogId: number): Promise<NarrationPrep> {
    if (!this.enabled) throw new BadRequestException('Narration is not configured on this server.');

    const blog = await this.prisma.blog.findFirst({
      where: { id: blogId, deletedAt: null },
      select: { title: true, content: true },
    });
    if (!blog) throw new NotFoundException('Story not found.');

    const text = this.cleanText(blog.title, blog.content);
    if (!text) throw new BadRequestException('Nothing to narrate.');

    const hash = createHash('sha256').update(`${VOICE}|${text}`).digest('hex').slice(0, 16);
    const key = `narrations/${blogId}-${hash}.mp3`;
    const url = `${this.publicUrl}/${key}`;

    // Cache hit? Re-listens (by anyone) cost nothing to generate, so they are
    // free and unmetered — only a cache miss draws down the plan budget.
    let cached = false;
    try {
      const head = await fetch(url, { method: 'HEAD' });
      cached = head.ok;
    } catch {
      // Treat a failed HEAD as a miss and (re)generate.
    }

    return { url, key, text, chars: text.length, cached };
  }

  /** Generate the narration audio and cache it in R2. Call only after the
   *  caller has confirmed a cache miss and charged the character budget. */
  async generateNarration(key: string, text: string): Promise<void> {
    const audio = await this.synthesize(text);
    await this.store(key, audio);
  }

  /** Markdown/HTML → clean prose the narrator can read naturally. */
  private cleanText(title: string, content: string): string {
    const body = (content ?? '')
      .replace(/```[\s\S]*?```/g, ' ')          // fenced code
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')     // images
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // links -> link text
      .replace(/<[^>]+>/g, ' ')                  // html tags
      .replace(/&(#\d+|#x[0-9a-fA-F]+|[a-z]+);/gi, ' ') // html entities
      .replace(/[#>*_`~|]+/g, ' ')               // md punctuation
      .replace(/\s+/g, ' ')
      .trim();
    return `${title}. ${body}`.slice(0, 30000); // safety ceiling
  }

  private async synthesize(text: string): Promise<Buffer> {
    const buffers: Buffer[] = [];
    for (const chunk of this.chunk(text)) {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: MODEL, voice: VOICE, input: chunk, response_format: 'mp3' }),
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).slice(0, 200);
        throw new HttpException(`Narration provider error (${res.status}). ${detail}`, HttpStatus.BAD_GATEWAY);
      }
      buffers.push(Buffer.from(await res.arrayBuffer()));
    }
    return Buffer.concat(buffers);
  }

  /** Pack whole sentences into <=MAX_CHUNK blocks (hard-splitting any single
   *  sentence that somehow exceeds the limit). */
  private chunk(text: string): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) ?? [text];
    const out: string[] = [];
    let cur = '';
    for (const s of sentences) {
      if ((cur + s).length > MAX_CHUNK) {
        if (cur.trim()) out.push(cur.trim());
        cur = '';
        let rest = s;
        while (rest.length > MAX_CHUNK) { out.push(rest.slice(0, MAX_CHUNK)); rest = rest.slice(MAX_CHUNK); }
        cur = rest;
      } else {
        cur += s;
      }
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  /** Store via a presigned PUT + fetch — same workaround UploadService uses to
   *  dodge the OpenSSL-3/Node-20 handshake bug in the SDK's HTTP handler. */
  private async store(key: string, audio: Buffer): Promise<void> {
    const presigned = await getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: 'audio/mpeg' }),
      { expiresIn: 120 },
    );
    const res = await fetch(presigned, {
      method: 'PUT',
      body: audio,
      headers: { 'Content-Type': 'audio/mpeg' },
    });
    if (!res.ok) throw new HttpException('Failed to store narration audio.', HttpStatus.BAD_GATEWAY);
  }
}
