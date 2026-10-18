import { describe, expect, it } from 'vitest';
import { itemEligibility, refundEstimate, validateDraft, validateLookup } from './returns';
import { sampleOrders } from './sampleData';
import type { Order, ReturnDraft, ReturnRequest } from './types';

const order: Order = sampleOrders[0];
const shirt = order.items[0];
const draft = (overrides: Partial<ReturnDraft> = {}): ReturnDraft => ({
  orderNumber: order.number,
  refundMethod: 'original',
  items: [{ sku: shirt.sku, quantity: 1, reason: 'too-small', comment: '' }],
  ...overrides,
});
const openReturn = (quantity: number, status: ReturnRequest['status'] = 'requested'): ReturnRequest => ({
  id: 'RET-1001',
  orderNumber: order.number,
  createdAt: '2026-10-17T10:00:00Z',
  status,
  refundMethod: 'original',
  refundCents: 0,
  idempotencyKey: 'k',
  items: [{ sku: shirt.sku, name: shirt.name, quantity, reason: 'too-small', comment: '' }],
});

describe('itemEligibility', () => {
  it('accepts a return on day 30 and refuses it on day 31', () => {
    const delivered = { ...order, deliveredOn: '2026-09-18' };
    expect(itemEligibility(delivered, shirt, '2026-10-18', []).eligible).toBe(true);
    expect(itemEligibility(delivered, shirt, '2026-10-19', [])).toEqual({
      eligible: false,
      reason: 'The 30-day return window has closed',
    });
  });

  it('refuses undelivered orders and final sale items', () => {
    expect(itemEligibility({ ...order, deliveredOn: null }, shirt, '2026-10-18', []).eligible).toBe(false);
    expect(itemEligibility(order, order.items[1], '2026-10-18', []).eligible).toBe(false);
  });

  it('subtracts units in open returns but ignores cancelled ones', () => {
    expect(itemEligibility(order, shirt, '2026-10-18', [openReturn(1)])).toEqual({ eligible: true, returnableQuantity: 1 });
    expect(itemEligibility(order, shirt, '2026-10-18', [openReturn(2)]).eligible).toBe(false);
    expect(itemEligibility(order, shirt, '2026-10-18', [openReturn(2, 'cancelled')])).toEqual({
      eligible: true,
      returnableQuantity: 2,
    });
  });
});

describe('validateLookup', () => {
  it('accepts lowercase order numbers with surrounding spaces', () => {
    expect(validateLookup({ orderNumber: ' ord-10421 ', email: 'sanne@example.com' })).toEqual({});
  });

  it('distinguishes a missing value from a malformed one', () => {
    expect(validateLookup({ orderNumber: '', email: '' })).toEqual({
      orderNumber: 'Enter your order number, for example ORD-10421.',
      email: 'Enter the email address used for the order.',
    });
    expect(validateLookup({ orderNumber: '10421', email: 'sanne@' })).toEqual({
      orderNumber: 'Order numbers look like ORD-10421.',
      email: 'Enter an email address like name@example.com.',
    });
  });
});

describe('validateDraft', () => {
  it('requires at least one item', () => {
    expect(validateDraft(draft({ items: [] }), order, '2026-10-18', [])).toEqual({
      items: 'Choose at least one item to return.',
    });
  });

  it('keys errors by field id and caps quantity at what is still returnable', () => {
    const errors = validateDraft(
      draft({ items: [{ sku: shirt.sku, quantity: 2, reason: 'damaged', comment: 'torn' }] }),
      order,
      '2026-10-18',
      [openReturn(1)],
    );
    expect(Object.keys(errors)).toEqual(['qty-SHIRT-LIN-M', 'comment-SHIRT-LIN-M']);
  });
});

describe('refundEstimate', () => {
  it('charges return shipping once for a refund to the original payment method', () => {
    expect(refundEstimate(draft({ items: [{ ...draft().items[0], quantity: 2 }] }), order)).toEqual({
      subtotalCents: 7990,
      feeCents: 495,
      totalCents: 7495,
    });
  });

  it('waives the fee for store credit and when the shop made a mistake', () => {
    expect(refundEstimate(draft({ refundMethod: 'store-credit' }), order).feeCents).toBe(0);
    const mixed = draft({
      items: [
        { sku: shirt.sku, quantity: 1, reason: 'too-small', comment: '' },
        { sku: 'SOCK-WOOL-3', quantity: 1, reason: 'wrong-item', comment: '' },
      ],
    });
    expect(refundEstimate(mixed, order)).toEqual({ subtotalCents: 5490, feeCents: 0, totalCents: 5490 });
  });

  it('charges nothing for an empty selection', () => {
    expect(refundEstimate(draft({ items: [] }), order)).toEqual({ subtotalCents: 0, feeCents: 0, totalCents: 0 });
  });
});
