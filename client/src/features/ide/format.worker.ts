import { formatJavaScript } from './format';

self.onmessage = async (event: MessageEvent<string>): Promise<void> => {
  try { self.postMessage({ code: await formatJavaScript(event.data) }); }
  catch { self.postMessage({ error: true }); }
};
