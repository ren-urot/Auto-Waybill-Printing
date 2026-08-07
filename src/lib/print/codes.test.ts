import { describe, it, expect } from 'vitest';
import { getTrackingBarcodeValue, getOrderQrPayload } from './codes';

describe('getTrackingBarcodeValue', () => {
  it('strips whitespace and uppercases', () => {
    expect(getTrackingBarcodeValue(' lbc 123 456 ')).toBe('LBC123456');
  });
});

describe('getOrderQrPayload', () => {
  it('encodes order id and number as JSON', () => {
    const payload = getOrderQrPayload({ id: 'abc-123', orderNumber: '1001' });
    expect(JSON.parse(payload)).toEqual({ orderId: 'abc-123', orderNumber: '1001' });
  });
});
