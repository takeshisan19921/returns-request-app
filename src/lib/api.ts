import { normalizeOrderNumber, refundEstimate, validateDraft } from './returns';
import { DEMO_TODAY, sampleOrders } from './sampleData';
import type { Order, ReturnDraft, ReturnReason, ReturnRequest } from './types';

export type ApiErrorKind = 'not-found' | 'network' | 'invalid' | 'storage' | 'conflict';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;

  constructor(kind: ApiErrorKind, message: string) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
  }
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

export interface ReturnsApi {
  lookupOrder(orderNumber: string, email: string): Promise<Order>;
  listReturns(): Promise<ReturnRequest[]>;
  createReturn(draft: ReturnDraft, idempotencyKey: string): Promise<ReturnRequest>;
  cancelReturn(id: string): Promise<ReturnRequest>;
}

export const STORAGE_KEY = 'returns-demo:v1';
/** Looking up this order always fails, so the demo can show the network error state. */
export const FAILING_ORDER_NUMBER = 'ORD-99999';

interface Options {
  storage: KeyValueStorage;
  orders?: readonly Order[];
  today?: string;
  delayMs?: number;
  now?: () => Date;
}

/**
 * A fake backend that persists to localStorage (or any key-value store) with
 * an artificial delay, so the UI has real loading and failure states.
 */
export function createLocalApi({
  storage,
  orders = sampleOrders,
  today = DEMO_TODAY,
  delayMs = 450,
  now = () => new Date(),
}: Options): ReturnsApi {
  const wait = () => new Promise<void>((resolve) => setTimeout(resolve, delayMs));

  const read = (): ReturnRequest[] => {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as ReturnRequest[];
    } catch {
      // Handled below.
    }
    // Stop here instead of treating unreadable data as an empty list,
    // which would overwrite the saved requests on the next write.
    throw new ApiError('storage', 'Saved return requests could not be read.');
  };

  const write = (requests: ReturnRequest[]) => storage.setItem(STORAGE_KEY, JSON.stringify(requests));
  const findOrder = (number: string) => orders.find((order) => order.number === number);

  return {
    async lookupOrder(orderNumber, email) {
      await wait();
      const number = normalizeOrderNumber(orderNumber);
      if (number === FAILING_ORDER_NUMBER) {
        throw new ApiError('network', "The returns service didn't respond. Try again in a moment.");
      }
      const order = findOrder(number);
      // One message for a wrong number or a wrong email, so the form can't be used to find out which orders exist.
      if (!order || order.email.toLowerCase() !== email.trim().toLowerCase()) {
        throw new ApiError('not-found', "We couldn't find an order with that number and email address.");
      }
      return order;
    },

    async listReturns() {
      await wait();
      return read().sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    },

    async createReturn(draft, idempotencyKey) {
      await wait();
      const requests = read();
      const existing = requests.find((request) => request.idempotencyKey === idempotencyKey);
      if (existing) return existing;

      const order = findOrder(draft.orderNumber);
      if (!order) throw new ApiError('invalid', 'This order could not be found.');
      // Validate again on the "server": the client's copy of existing returns may be stale.
      const errors = validateDraft(draft, order, today, requests);
      const firstError = Object.values(errors)[0];
      if (firstError) throw new ApiError('invalid', firstError);

      const lastNumber = requests.reduce((max, request) => Math.max(max, Number(request.id.slice(4))), 1000);
      const request: ReturnRequest = {
        id: `RET-${lastNumber + 1}`,
        orderNumber: order.number,
        createdAt: now().toISOString(),
        status: 'requested',
        refundMethod: draft.refundMethod,
        refundCents: refundEstimate(draft, order).totalCents,
        idempotencyKey,
        items: draft.items.map((selection) => ({
          sku: selection.sku,
          name: order.items.find((item) => item.sku === selection.sku)?.name ?? selection.sku,
          quantity: selection.quantity,
          // validateDraft has rejected empty reasons by this point.
          reason: selection.reason as ReturnReason,
          comment: selection.comment.trim(),
        })),
      };
      write([...requests, request]);
      return request;
    },

    async cancelReturn(id) {
      await wait();
      const requests = read();
      const target = requests.find((request) => request.id === id);
      if (!target) throw new ApiError('invalid', `Return ${id} was not found.`);
      if (target.status !== 'requested') throw new ApiError('conflict', `Return ${id} is already ${target.status}.`);
      const updated: ReturnRequest = { ...target, status: 'cancelled' };
      write(requests.map((request) => (request.id === id ? updated : request)));
      return updated;
    },
  };
}
