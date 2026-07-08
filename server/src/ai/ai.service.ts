import { Injectable } from '@nestjs/common';
import { createGroq } from '@ai-sdk/groq';
import { streamText, generateText } from 'ai';
import { Response } from 'express';

@Injectable()
export class AiService {
  private groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

  // Summaries rarely change, so cache per blog to keep Groq spend bounded.
  private summaryCache = new Map<string, { data: string[]; expiresAt: number }>();

  async streamBlogContent(prompt: string, res: Response, writingStyle?: string) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const styleContext = writingStyle
      ? `\n\nThe writer has described their personal writing style. Match it closely:\n"${writingStyle}"`
      : '';

    const result = await streamText({
      model: this.groq('llama-3.3-70b-versatile'),
      system: `You are a creative blog assistant. Write engaging, well-structured blog content.${styleContext}`,
      prompt,
    });

    for await (const chunk of result.textStream) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  }

  /** Generate 3-5 plain-text "key takeaways" for an article. Cached per blog id
   *  for a day so only the first reader spends Groq budget. */
  async summarize(blogId: number, content: string): Promise<string[]> {
    const key = `sum:${blogId}`;
    const hit = this.summaryCache.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.data;

    const plain = content
      .replace(/<[^>]+>/g, ' ')
      .replace(/&[a-z]+;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 8000);
    if (plain.length < 200) return [];

    const { text } = await generateText({
      model: this.groq('llama-3.3-70b-versatile'),
      maxOutputTokens: 500,
      system:
        'You distil blog posts into 3 to 5 crisp key takeaways. Return ONLY a JSON array of ' +
        'plain-text strings, no prose, no markdown, no code fences. Each string is one short sentence.',
      prompt: `Summarise the key takeaways of this article:\n\n${plain}`,
    });

    let bullets: string[] = [];
    const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) bullets = parsed.filter((x) => typeof x === 'string');
    } catch {
      bullets = cleaned
        .split('\n')
        .map((l) => l.replace(/^[-*\d.\s]+/, '').trim())
        .filter(Boolean);
    }
    bullets = bullets.slice(0, 5);

    this.summaryCache.set(key, { data: bullets, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
    return bullets;
  }
}
