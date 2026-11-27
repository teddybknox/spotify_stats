import { useCallback, useEffect, useState } from 'react';
import Upload from './components/Upload';
import Dashboard from './components/Dashboard';
import type { ParseResult } from './lib/types';
import { deleteSaved, listSaved, loadSaved, saveUpload, type SavedMeta } from './lib/saved';

export default function App() {
  const [data, setData] = useState<ParseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedMeta[]>([]);

  const refreshSaved = useCallback(() => {
    listSaved().then(setSaved);
  }, []);
  useEffect(refreshSaved, [refreshSaved]);

  const load = (files: File[], save = true) => {
    setLoading(true);
    setError(null);
    const worker = new Worker(new URL('./lib/parse.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      setLoading(false);
      worker.terminate();
      if (e.data.ok) {
        const result: ParseResult = e.data.result;
        if (!result.plays.length) return setError('That export has no plays in it.');
        setData(result);
        if (save) {
          const plays = result.plays;
          saveUpload(files, { plays: plays.length, from: plays[0].day, to: plays[plays.length - 1].day }).then(
            refreshSaved,
          );
        }
      } else setError(e.data.error);
    };
    worker.onerror = (e) => {
      setLoading(false);
      worker.terminate();
      setError(e.message || 'Something went wrong reading that file.');
    };
    worker.postMessage(files);
  };

  const openSaved = async (id: string) => {
    const files = await loadSaved(id);
    if (files) load(files, false);
    else {
      setError('That saved file could not be opened. Please choose it again.');
      refreshSaved();
    }
  };

  const forget = async (id: string) => {
    await deleteSaved(id);
    refreshSaved();
  };

  return data ? (
    <Dashboard data={data} onReset={() => setData(null)} />
  ) : (
    <Upload onFiles={load} loading={loading} error={error} saved={saved} onOpenSaved={openSaved} onForget={forget} />
  );
}
