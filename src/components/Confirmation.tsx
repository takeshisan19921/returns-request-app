import { useEffect, useRef } from 'react';
import { formatCents, refundLabels } from '../lib/returns';
import type { ReturnRequest } from '../lib/types';

export function Confirmation({ request, onDone }: { request: ReturnRequest; onDone: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);

  return (
    <section className="panel stack confirmation" aria-labelledby="confirmation-title">
      <h2 id="confirmation-title" ref={headingRef} tabIndex={-1}>
        Return requested
      </h2>
      <p>
        Your return number is <strong className="mono">{request.id}</strong>. Print the label from your email and drop
        the parcel off within 14 days.
      </p>
      <p>
        We'll refund <strong>{formatCents(request.refundCents)}</strong> to your {refundLabels[request.refundMethod]}{' '}
        once the parcel arrives.
      </p>
      <div>
        <button type="button" className="button button--primary" onClick={onDone}>
          Start another return
        </button>
      </div>
    </section>
  );
}
