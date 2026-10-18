import { describe, expect, it } from 'vitest';
import { ApiError, createLocalApi, createMemoryStorage, STORAGE_KEY } from './api';
import type { ReturnDraft } from './types';

const draft: ReturnDraft = {
  orderNumber: 'ORD-10421',
  refundMethod: 'original',
  items: [{ sku: 'SHIRT-LIN-M', quantity: 2, reason: 'too-small', comment: '' }],
};
const makeApi = (storage = createMemoryStorage()) => createLocalApi({ storage, delayMs: 0 });

describe('local returns API', () => {
  it('finds orders with a case-insensitive email and hides which field was wrong', async () => {
    const api = makeApi();
    await expect(api.lookupOrder('ord-10421', ' Sanne@Example.com ')).resolves.toMatchObject({ number: 'ORD-10421' });
    const wrongEmail = await api.lookupOrder('ORD-10421', 'someone@example.com').catch((e: ApiError) => e.message);
    const unknownOrder = await api.lookupOrder('ORD-11111', 'sanne@example.com').catch((e: ApiError) => e.message);
    expect(wrongEmail).toBe(unknownOrder);
  });

  it('returns the original request when a submission is retried with the same key', async () => {
    const api = makeApi();
    const first = await api.createReturn(draft, 'key-1');
    const retry = await api.createReturn(draft, 'key-1');
    expect(retry).toEqual(first);
    expect(await api.listReturns()).toHaveLength(1);
  });

  it('rejects a draft the client should not have sent', async () => {
    const api = makeApi();
    await api.createReturn(draft, 'key-1');
    await expect(api.createReturn(draft, 'key-2')).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('numbers requests in sequence and refuses to cancel twice', async () => {
    const api = makeApi();
    const first = await api.createReturn({ ...draft, items: [{ ...draft.items[0], quantity: 1 }] }, 'a');
    const second = await api.createReturn({ ...draft, items: [{ ...draft.items[0], quantity: 1 }] }, 'b');
    expect([first.id, second.id]).toEqual(['RET-1001', 'RET-1002']);
    await api.cancelReturn(first.id);
    await expect(api.cancelReturn(first.id)).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('refuses to overwrite storage it cannot read', async () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: '{not json' });
    const api = makeApi(storage);
    await expect(api.listReturns()).rejects.toMatchObject({ kind: 'storage' });
    await expect(api.createReturn(draft, 'key-1')).rejects.toMatchObject({ kind: 'storage' });
    expect(storage.getItem(STORAGE_KEY)).toBe('{not json');
  });
});
