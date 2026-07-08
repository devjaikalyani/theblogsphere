import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AiService {
  generateStream(prompt: string): Observable<string> {
    return new Observable((subscriber) => {
      fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      }).then(async (response) => {
        // Non-streaming error (e.g. 429 AI quota exceeded), surface the JSON
        // payload so the UI can prompt an upgrade instead of silently stalling.
        if (!response.ok || !response.body) {
          let body: any = null;
          try { body = await response.json(); } catch {}
          subscriber.error({ status: response.status, ...(body ?? {}) });
          return;
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const lines = decoder.decode(value).split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') {
              subscriber.complete();
              return;
            }
            try {
              const { chunk } = JSON.parse(payload);
              subscriber.next(chunk);
            } catch {}
          }
        }
        subscriber.complete();
      }).catch((err) => subscriber.error(err));
    });
  }
}
