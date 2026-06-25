import { Injectable } from '@nestjs/common';
import { createGroq } from '@ai-sdk/groq';
import { streamText } from 'ai';
import { Response } from 'express';

@Injectable()
export class AiService {
  private groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

  async streamBlogContent(prompt: string, res: Response, writingStyle?: string) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const styleContext = writingStyle
      ? `\n\nThe writer has described their personal writing style — match it closely:\n"${writingStyle}"`
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
}
