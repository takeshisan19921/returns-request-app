import type { Order } from './types';

/** The demo runs on a fixed date so the sample orders stay inside or outside the return window. */
export const DEMO_TODAY = '2026-10-18';

export const sampleOrders: readonly Order[] = [
  {
    number: 'ORD-10421',
    email: 'sanne@example.com',
    deliveredOn: '2026-10-09',
    items: [
      { sku: 'SHIRT-LIN-M', name: 'Linen shirt', quantity: 2, unitPriceCents: 3995, finalSale: false },
      { sku: 'TOTE-CNV', name: 'Canvas tote', quantity: 1, unitPriceCents: 1950, finalSale: true },
      { sku: 'SOCK-WOOL-3', name: 'Wool socks (3 pack)', quantity: 1, unitPriceCents: 1495, finalSale: false },
    ],
  },
  {
    number: 'ORD-10388',
    email: 'daan@example.com',
    deliveredOn: '2026-09-02',
    items: [{ sku: 'JACKET-RAIN-L', name: 'Rain jacket', quantity: 1, unitPriceCents: 8995, finalSale: false }],
  },
  {
    number: 'ORD-10455',
    email: 'emma@example.com',
    deliveredOn: null,
    items: [{ sku: 'MUG-CER-2', name: 'Ceramic mug (set of 2)', quantity: 1, unitPriceCents: 2450, finalSale: false }],
  },
];
