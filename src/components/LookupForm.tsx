import { useState, type FormEvent } from 'react';
import type { ReturnsApi } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { validateLookup } from '../lib/returns';
import type { FieldErrors, Order } from '../lib/types';
import { ErrorSummary } from './ErrorSummary';
import { TextField } from './fields';

interface Props {
  api: ReturnsApi;
  onFound: (order: Order) => void;
}

export function LookupForm({ api, onFound }: Props) {
  const [values, setValues] = useState({ orderNumber: '', email: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validateLookup(values);
    setErrors(found);
    setServerError('');
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      onFound(await api.lookupOrder(values.orderNumber, values.email));
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel stack" onSubmit={submit} noValidate aria-labelledby="lookup-title">
      <div>
        <h2 id="lookup-title">Find your order</h2>
        <p className="muted">Use the order number from your confirmation email.</p>
      </div>
      <ErrorSummary errors={errors} />
      {serverError && (
        <p className="alert alert--error" role="alert">
          {serverError}
        </p>
      )}
      <TextField
        id="orderNumber"
        label="Order number"
        hint="For example ORD-10421"
        autoComplete="off"
        value={values.orderNumber}
        error={errors.orderNumber}
        onChange={(e) => setValues((v) => ({ ...v, orderNumber: e.target.value }))}
      />
      <TextField
        id="email"
        type="email"
        label="Email address"
        autoComplete="email"
        value={values.email}
        error={errors.email}
        onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
      />
      <div>
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? 'Looking up…' : 'Find order'}
        </button>
      </div>
      <details className="demo-hint">
        <summary>Demo orders</summary>
        <ul>
          <li>
            <code>ORD-10421</code> / <code>sanne@example.com</code>: returnable, one final sale item
          </li>
          <li>
            <code>ORD-10388</code> / <code>daan@example.com</code>: outside the 30-day window
          </li>
          <li>
            <code>ORD-10455</code> / <code>emma@example.com</code>: not delivered yet
          </li>
          <li>
            <code>ORD-99999</code> with any email: simulates the service being down
          </li>
        </ul>
      </details>
    </form>
  );
}
