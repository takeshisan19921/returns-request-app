import { useCallback, useEffect, useMemo, useState } from 'react';
import { Confirmation } from './components/Confirmation';
import { LookupForm } from './components/LookupForm';
import { ReturnForm } from './components/ReturnForm';
import { ReturnsList, type ListState } from './components/ReturnsList';
import { createLocalApi, type ReturnsApi } from './lib/api';
import { errorMessage } from './lib/errors';
import { DEMO_TODAY } from './lib/sampleData';
import type { Order, ReturnRequest } from './lib/types';

type View = { kind: 'lookup' } | { kind: 'form'; order: Order } | { kind: 'done'; request: ReturnRequest };

interface Props {
  api?: ReturnsApi;
  today?: string;
}

export default function App({ api: providedApi, today = DEMO_TODAY }: Props) {
  const api = useMemo(() => providedApi ?? createLocalApi({ storage: window.localStorage }), [providedApi]);
  const [view, setView] = useState<View>({ kind: 'lookup' });
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const loadReturns = useCallback(async () => {
    setList({ kind: 'loading' });
    try {
      setList({ kind: 'ready', requests: await api.listReturns() });
    } catch (error) {
      setList({ kind: 'error', message: errorMessage(error) });
    }
  }, [api]);

  useEffect(() => {
    void loadReturns();
  }, [loadReturns]);

  const created = (request: ReturnRequest) => {
    setView({ kind: 'done', request });
    setNotice('');
    void loadReturns();
  };

  const cancel = async (id: string) => {
    setCancellingId(id);
    setNotice('');
    try {
      const updated = await api.cancelReturn(id);
      setList((current) =>
        current.kind === 'ready'
          ? { kind: 'ready', requests: current.requests.map((r) => (r.id === id ? updated : r)) }
          : current,
      );
      setNotice(`Return ${id} cancelled.`);
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="layout">
      <header className="topbar">
        <p className="eyebrow">Linnen &amp; Co · customer service</p>
        <h1>Return an item</h1>
      </header>
      <main className="columns">
        <div>
          {view.kind === 'lookup' && <LookupForm api={api} onFound={(order) => setView({ kind: 'form', order })} />}
          {view.kind === 'form' && (
            <ReturnForm
              api={api}
              order={view.order}
              today={today}
              existingRequests={list.kind === 'ready' ? list.requests : []}
              onCreated={created}
              onBack={() => setView({ kind: 'lookup' })}
            />
          )}
          {view.kind === 'done' && <Confirmation request={view.request} onDone={() => setView({ kind: 'lookup' })} />}
        </div>
        <ReturnsList state={list} cancellingId={cancellingId} notice={notice} onCancel={cancel} onRetry={loadReturns} />
      </main>
      <footer className="footer muted">Demo shop. Requests are saved in your browser's local storage.</footer>
    </div>
  );
}
