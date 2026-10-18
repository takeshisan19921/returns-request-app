import type { FieldErrors, Order, OrderItem, RefundMethod, ReturnDraft, ReturnReason, ReturnRequest } from './types';

export const RETURN_WINDOW_DAYS = 30;
export const RETURN_SHIPPING_CENTS = 495;
export const MIN_COMMENT_LENGTH = 10;

export const reasonLabels: Record<ReturnReason, string> = {
  damaged: 'Arrived damaged',
  'wrong-item': 'Wrong item sent',
  'too-small': 'Too small',
  'too-large': 'Too large',
  'changed-mind': 'Changed my mind',
  other: 'Other',
};

export const refundLabels: Record<RefundMethod, string> = {
  original: 'original payment method',
  'store-credit': 'store credit',
};

/** Reasons where the shop made the mistake. These waive the return shipping fee. */
const shopFaultReasons: ReadonlySet<ReturnReason> = new Set(['damaged', 'wrong-item']);
const reasonsNeedingComment: ReadonlySet<ReturnReason> = new Set(['damaged', 'other']);

export const needsComment = (reason: ReturnReason | ''): boolean => reason !== '' && reasonsNeedingComment.has(reason);

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
export const formatCents = (cents: number): string => euro.format(cents / 100);

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86_400_000);
}

export const normalizeOrderNumber = (value: string): string => value.trim().toUpperCase();

const ORDER_NUMBER = /^ORD-\d{5}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLookup(input: { orderNumber: string; email: string }): FieldErrors {
  const errors: FieldErrors = {};
  const orderNumber = normalizeOrderNumber(input.orderNumber);
  if (!orderNumber) errors.orderNumber = 'Enter your order number, for example ORD-10421.';
  else if (!ORDER_NUMBER.test(orderNumber)) errors.orderNumber = 'Order numbers look like ORD-10421.';

  const email = input.email.trim();
  if (!email) errors.email = 'Enter the email address used for the order.';
  else if (!EMAIL.test(email)) errors.email = 'Enter an email address like name@example.com.';
  return errors;
}

export type Eligibility = { eligible: true; returnableQuantity: number } | { eligible: false; reason: string };

/** Units of this SKU already covered by open (not cancelled) return requests. */
export function quantityInOpenReturns(orderNumber: string, sku: string, requests: readonly ReturnRequest[]): number {
  return requests
    .filter((request) => request.orderNumber === orderNumber && request.status === 'requested')
    .flatMap((request) => request.items)
    .filter((item) => item.sku === sku)
    .reduce((sum, item) => sum + item.quantity, 0);
}

export function itemEligibility(
  order: Order,
  item: OrderItem,
  today: string,
  requests: readonly ReturnRequest[],
): Eligibility {
  if (order.deliveredOn === null) return { eligible: false, reason: 'Not delivered yet' };
  if (daysBetween(order.deliveredOn, today) > RETURN_WINDOW_DAYS) {
    return { eligible: false, reason: `The ${RETURN_WINDOW_DAYS}-day return window has closed` };
  }
  if (item.finalSale) return { eligible: false, reason: 'Final sale, not returnable' };
  const remaining = item.quantity - quantityInOpenReturns(order.number, item.sku, requests);
  if (remaining <= 0) return { eligible: false, reason: 'Already in an open return' };
  return { eligible: true, returnableQuantity: remaining };
}

/**
 * Validates a draft against the order and existing requests. The client runs
 * this for instant feedback and the API runs it again before saving.
 */
export function validateDraft(
  draft: ReturnDraft,
  order: Order,
  today: string,
  requests: readonly ReturnRequest[],
): FieldErrors {
  const errors: FieldErrors = {};
  if (draft.items.length === 0) {
    errors.items = 'Choose at least one item to return.';
    return errors;
  }
  for (const selection of draft.items) {
    const item = order.items.find((candidate) => candidate.sku === selection.sku);
    if (!item) {
      errors.items = 'One of the selected items is not part of this order.';
      continue;
    }
    const eligibility = itemEligibility(order, item, today, requests);
    if (!eligibility.eligible) {
      errors[`qty-${item.sku}`] = `${item.name} can't be returned: ${eligibility.reason.toLowerCase()}.`;
      continue;
    }
    const { quantity } = selection;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > eligibility.returnableQuantity) {
      errors[`qty-${item.sku}`] = `You can return between 1 and ${eligibility.returnableQuantity} of ${item.name}.`;
    }
    if (selection.reason === '') {
      errors[`reason-${item.sku}`] = `Choose a reason for returning ${item.name}.`;
    } else if (needsComment(selection.reason) && selection.comment.trim().length < MIN_COMMENT_LENGTH) {
      errors[`comment-${item.sku}`] = `Describe the problem with ${item.name} in at least ${MIN_COMMENT_LENGTH} characters.`;
    }
  }
  return errors;
}

export interface RefundEstimate {
  subtotalCents: number;
  feeCents: number;
  totalCents: number;
}

/**
 * Return shipping is charged once per parcel, only for refunds to the original
 * payment method, and waived when any item arrived damaged or wrong.
 */
export function refundEstimate(draft: ReturnDraft, order: Order): RefundEstimate {
  const subtotalCents = draft.items.reduce((sum, selection) => {
    const item = order.items.find((candidate) => candidate.sku === selection.sku);
    return item ? sum + item.unitPriceCents * selection.quantity : sum;
  }, 0);
  const shopFault = draft.items.some((s) => s.reason !== '' && shopFaultReasons.has(s.reason));
  const feeCents = subtotalCents > 0 && draft.refundMethod === 'original' && !shopFault ? RETURN_SHIPPING_CENTS : 0;
  return { subtotalCents, feeCents, totalCents: Math.max(0, subtotalCents - feeCents) };
}
