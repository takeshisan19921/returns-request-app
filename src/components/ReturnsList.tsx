import { formatCents, reasonLabels, refundLabels } from '../lib/returns';
import type { ReturnRequest } from '../lib/types';

export type ListState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; requests: ReturnRequest[] };

interface Props {
  state: ListState;
  cancellingId: string | null;
  notice: string;
  onCancel: (id: string) => void;
  onRetry: () => void;
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function ReturnsList({ state, cancellingId, notice, onCancel, onRetry }: Props) {
  return (
    <section className="panel stack" aria-labelledby="requests-title" aria-busy={state.kind === 'loading'}>
      <h2 id="requests-title">Your return requests</h2>
      <p className="notice" role="status">
        {notice}
      </p>

      {state.kind === 'loading' && <p className="muted">Loading return requests…</p>}

      {state.kind === 'error' && (
        <div className="alert alert--error" role="alert">
          <p>{state.message}</p>
          <button type="button" className="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {state.kind === 'ready' && state.requests.length === 0 && (
        <p className="empty">No return requests yet. Find an order to start one.</p>
      )}

      {state.kind === 'ready' && state.requests.length > 0 && (
        <ul className="requests">
          {state.requests.map((request) => (
            <li key={request.id} className="request">
              <div className="request__head">
                <span className="mono">{request.id}</span>
                <span className={`badge badge--${request.status}`}>
                  {request.status === 'requested' ? 'Requested' : 'Cancelled'}
                </span>
              </div>
              <p className="muted">
                Order {request.orderNumber} · {dateFormat.format(new Date(request.createdAt))}
              </p>
              <ul className="request__items">
                {request.items.map((item) => (
                  <li key={item.sku}>
                    {item.quantity} × {item.name} <span className="muted">({reasonLabels[item.reason]})</span>
                  </li>
                ))}
              </ul>
              <div className="request__foot">
                <span>
                  {formatCents(request.refundCents)} to {refundLabels[request.refundMethod]}
                </span>
                {request.status === 'requested' && (
                  <button
                    type="button"
                    className="button button--small"
                    disabled={cancellingId === request.id}
                    aria-label={`${cancellingId === request.id ? 'Cancelling' : 'Cancel return'} ${request.id}`}
                    onClick={() => onCancel(request.id)}
                  >
                    {cancellingId === request.id ? 'Cancelling…' : 'Cancel return'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
