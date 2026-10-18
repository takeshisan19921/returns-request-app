export type ReturnReason = 'damaged' | 'wrong-item' | 'too-small' | 'too-large' | 'changed-mind' | 'other';
export type RefundMethod = 'original' | 'store-credit';
export type ReturnStatus = 'requested' | 'cancelled';

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  /** Price per unit in euro cents. */
  unitPriceCents: number;
  finalSale: boolean;
}

export interface Order {
  number: string;
  email: string;
  /** ISO date (YYYY-MM-DD), or null while the parcel is still in transit. */
  deliveredOn: string | null;
  items: OrderItem[];
}

/** One line of a return the customer is still editing. `reason` is empty until they pick one. */
export interface ItemSelection {
  sku: string;
  quantity: number;
  reason: ReturnReason | '';
  comment: string;
}

export interface ReturnDraft {
  orderNumber: string;
  items: ItemSelection[];
  refundMethod: RefundMethod;
}

export interface ReturnRequest {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: ReturnStatus;
  refundMethod: RefundMethod;
  refundCents: number;
  /** Key sent by the client so a retried submission returns the same request instead of a duplicate. */
  idempotencyKey: string;
  items: { sku: string; name: string; quantity: number; reason: ReturnReason; comment: string }[];
}

/** Field id -> message. Ids match the DOM ids so the error summary can link to each field. */
export type FieldErrors = Record<string, string>;
