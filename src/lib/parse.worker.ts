import { parseUploads } from './parse';

self.onmessage = async (e: MessageEvent<File[]>) => {
  try {
    const uploads = await Promise.all(
      e.data.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
    );
    const result = parseUploads(uploads);
    self.postMessage({ ok: true, result });
  } catch (err) {
    self.postMessage({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
