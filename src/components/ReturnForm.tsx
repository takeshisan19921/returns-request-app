import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { ReturnsApi } from '../lib/api';
import { errorMessage } from '../lib/errors';
import {
  formatCents,
  itemEligibility,
  MIN_COMMENT_LENGTH,
  needsComment,
  reasonLabels,
  refundEstimate,
  RETURN_SHIPPING_CENTS,
  validateDraft,
} from '../lib/returns';
import type { FieldErrors, ItemSelection, Order, RefundMethod, ReturnDraft, ReturnReason, ReturnRequest } from '../lib/types';
import { ErrorSummary } from './ErrorSummary';
import { SelectField, TextAreaField } from './fields';

interface Props {
  api: ReturnsApi;
  order: Order;
  today: string;
  existingRequests: readonly ReturnRequest[];
  onCreated: (request: ReturnRequest) => void;
  onBack: () => void;
}

const reasons = Object.entries(reasonLabels) as [ReturnReason, string][];

export function ReturnForm({ api, order, today, existingRequests, onCreated, onBack }: Props) {
  const [selected, setSelected] = useState<Record<string, ItemSelection>>({});
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('original');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  // One key per form. If a request times out after the server saved it, the
  // retry carries the same key and gets the saved request back, not a duplicate.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => headingRef.current?.focus(), []);

  const draft: ReturnDraft = useMemo(
    () => ({
      orderNumber: order.number,
      refundMethod,
      items: order.items.filter((item) => selected[item.sku]).map((item) => selected[item.sku]),
    }),
    [order, refundMethod, selected],
  );
  const estimate = refundEstimate(draft, order);

  const toggle = (sku: string, checked: boolean) =>
    setSelected((current) => {
      const next = { ...current };
      if (checked) next[sku] = { sku, quantity: 1, reason: '', comment: '' };
      else delete next[sku];
      return next;
    });

  const update = (sku: string, patch: Partial<ItemSelection>) =>
    setSelected((current) => ({ ...current, [sku]: { ...current[sku], ...patch } }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validateDraft(draft, order, today, existingRequests);
    setErrors(found);
    setServerError('');
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      onCreated(await api.createReturn(draft, idempotencyKey));
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel stack" onSubmit={submit} noValidate aria-labelledby="return-title">
      <div>
        <h2 id="return-title" ref={headingRef} tabIndex={-1}>
          Return items from {order.number}
        </h2>
        <p className="muted">
          {order.deliveredOn ? `Delivered on ${order.deliveredOn}.` : 'Not delivered yet.'} Returns are accepted for 30
          days after delivery.
        </p>
      </div>

      <ErrorSummary errors={errors} />
      {serverError && (
        <p className="alert alert--error" role="alert">
          {serverError}
        </p>
      )}

      <fieldset id="items" tabIndex={-1} className="items" aria-describedby={errors.items ? 'items-error' : undefined}>
        <legend>Which items are you returning?</legend>
        {errors.items && (
          <p id="items-error" className="field__error">
            {errors.items}
          </p>
        )}
        <ul className="item-list">
          {order.items.map((item) => {
            const eligibility = itemEligibility(order, item, today, existingRequests);
            const selection = selected[item.sku];
            const checkboxId = `item-${item.sku}`;
            const classes = ['item', selection && 'item--selected', !eligibility.eligible && 'item--disabled'];
            return (
              <li key={item.sku} className={classes.filter(Boolean).join(' ')}>
                <div className="item__head">
                  <input
                    type="checkbox"
                    id={checkboxId}
                    checked={Boolean(selection)}
                    disabled={!eligibility.eligible}
                    aria-describedby={eligibility.eligible ? undefined : `${checkboxId}-why`}
                    onChange={(e) => toggle(item.sku, e.target.checked)}
                  />
                  <label htmlFor={checkboxId}>
                    <span className="item__name">{item.name}</span>
                    <span className="muted">
                      {formatCents(item.unitPriceCents)} · ordered {item.quantity}
                    </span>
                  </label>
                </div>
                {!eligibility.eligible && (
                  <p id={`${checkboxId}-why`} className="item__why">
                    {eligibility.reason}
                  </p>
                )}
                {selection && eligibility.eligible && (
                  <div className="item__details">
                    <SelectField
                      id={`qty-${item.sku}`}
                      label="Quantity"
                      aria-label={`Quantity of ${item.name}`}
                      value={String(selection.quantity)}
                      error={errors[`qty-${item.sku}`]}
                      onChange={(e) => update(item.sku, { quantity: Number(e.target.value) })}
                    >
                      {Array.from({ length: eligibility.returnableQuantity }, (_, i) => (
                        <option key={i + 1} value={i + 1}>
                          {i + 1}
                        </option>
                      ))}
                    </SelectField>
                    <SelectField
                      id={`reason-${item.sku}`}
                      label="Reason"
                      aria-label={`Reason for ${item.name}`}
                      value={selection.reason}
                      error={errors[`reason-${item.sku}`]}
                      onChange={(e) => update(item.sku, { reason: e.target.value as ReturnReason | '' })}
                    >
                      <option value="">Choose a reason</option>
                      {reasons.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </SelectField>
                    {needsComment(selection.reason) && (
                      <TextAreaField
                        id={`comment-${item.sku}`}
                        className="wide"
                        label={`What went wrong with ${item.name}?`}
                        hint={`At least ${MIN_COMMENT_LENGTH} characters. This helps us fix it for the next customer.`}
                        value={selection.comment}
                        error={errors[`comment-${item.sku}`]}
                        onChange={(e) => update(item.sku, { comment: e.target.value })}
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset className="radios">
        <legend>How would you like your refund?</legend>
        <label className="radio">
          <input
            type="radio"
            name="refundMethod"
            value="original"
            checked={refundMethod === 'original'}
            onChange={() => setRefundMethod('original')}
          />
          <span>
            Original payment method
            <span className="muted">
              {formatCents(RETURN_SHIPPING_CENTS)} return shipping, free if an item arrived damaged or wrong
            </span>
          </span>
        </label>
        <label className="radio">
          <input
            type="radio"
            name="refundMethod"
            value="store-credit"
            checked={refundMethod === 'store-credit'}
            onChange={() => setRefundMethod('store-credit')}
          />
          <span>
            Store credit
            <span className="muted">Free return shipping</span>
          </span>
        </label>
      </fieldset>

      <dl className="estimate" aria-live="polite">
        <div>
          <dt>Items</dt>
          <dd>{formatCents(estimate.subtotalCents)}</dd>
        </div>
        <div>
          <dt>Return shipping</dt>
          <dd>{estimate.feeCents > 0 ? `− ${formatCents(estimate.feeCents)}` : 'Free'}</dd>
        </div>
        <div className="estimate__total">
          <dt>Estimated refund</dt>
          <dd>{formatCents(estimate.totalCents)}</dd>
        </div>
      </dl>

      <div className="actions">
        <button type="button" className="button" onClick={onBack} disabled={busy}>
          Back
        </button>
        <button type="submit" className="button button--primary" disabled={busy}>
          {busy ? 'Sending…' : 'Request return'}
        </button>
      </div>
    </form>
  );
}
