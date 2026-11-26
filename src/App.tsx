import { useState } from 'react';
import Upload from './components/Upload';
import Dashboard from './components/Dashboard';
import type { ParseResult } from './lib/types';

export default function App() {
  const [data, setData] = useState<ParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = (files: File[]) => {
    setLoading(true);
    setError(null);
    const worker = new Worker(new URL('./lib/parse.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      setLoading(false);
      worker.terminate();
      if (e.data.ok) {
        if (!e.data.result.plays.length) setError('That export has no plays in it.');
        else setData(e.data.result);
      } else setError(e.data.error);
    };
    worker.onerror = (e) => {
      setLoading(false);
      worker.terminate();
      setError(e.message || 'Something went wrong reading that file.');
    };
    worker.postMessage(files);
  };

  return data ? (
    <Dashboard data={data} onReset={() => setData(null)} />
  ) : (
    <Upload onFiles={load} loading={loading} error={error} />
  );
}
