export function getTrackingBarcodeValue(trackingNumber: string): string {
  return trackingNumber.trim().toUpperCase().replace(/\s+/g, '');
}

export function getOrderQrPayload(order: { id: string; orderNumber: string }): string {
  return JSON.stringify({ orderId: order.id, orderNumber: order.orderNumber });
}
