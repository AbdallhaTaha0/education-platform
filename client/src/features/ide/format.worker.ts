import { formatSource } from './format';

self.onmessage = async (event: MessageEvent<string | { code: string; language: string }>): Promise<void> => {
  try {
    const data = event.data;
    const code = typeof data === 'string' ? data : data.code;
    const language = typeof data === 'string' ? 'javascript' : data.language;
    const formatted = await formatSource(code, language);
    self.postMessage({ code: formatted });
  }
  catch { self.postMessage({ error: true }); }
};
