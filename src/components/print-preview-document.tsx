'use client';

import { useCallback, useRef } from 'react';
import { BarcodeBlock } from './barcode-block';
import { QRBlock } from './qr-block';
import { getTrackingBarcodeValue, getOrderQrPayload } from '@/lib/print/codes';

export type PaperSize = '4x6' | 'a6' | 'a5' | 'letter';

export const PAPER_SIZES: PaperSize[] = ['4x6', 'a6', 'a5', 'letter'];

const PAGE_SIZES: Record<PaperSize, string> = {
  '4x6': '4in 6in',
  a6: '105mm 148mm',
  a5: '148mm 210mm',
  letter: '8.5in 11in',
};

export interface PrintOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string | null;
  // `address` and `items` are jsonb at the DB layer, so their shape is only a
  // convention — a hand-edited row or an unusual Shopify payload can hand us
  // null or something that isn't an array. Typed loosely on purpose and
  // narrowed defensively below; a throw here breaks the whole print batch.
  address?: Record<string, unknown> | null;
  items?: Array<{ sku?: string | null; title?: string | null; quantity?: number | null }> | null;
  courier: string | null;
  trackingNumber: string | null;
  paymentMethod?: string | null;
}

interface PrintPreviewDocumentProps {
  orders: PrintOrder[];
  paperSize: PaperSize;
  documentType: 'waybill' | 'packing_slip';
  company?: { name: string; address: string | null };
  /**
   * Fired once every barcode and QR code in the document has finished drawing.
   * The print page uses this instead of a blind timeout so window.print()
   * can't capture half-drawn canvases.
   */
  onAllRendered?: () => void;
}

function addressLine(address: Record<string, unknown> | null | undefined): string {
  const source = address ?? {};
  const street = [source.address1, source.address2].filter(Boolean).join(' ');
  const region = [source.city, source.province].filter(Boolean).join(', ');
  return [street, region, source.zip, source.country]
    .map((part) => (part == null ? '' : String(part).trim()))
    .filter(Boolean)
    .join(', ');
}

export function PrintPreviewDocument({
  orders,
  paperSize,
  documentType,
  company,
  onAllRendered,
}: PrintPreviewDocumentProps) {
  // One QR per order, plus one barcode per waybill order that actually has a
  // tracking number to encode.
  const expectedRenders =
    orders.length +
    (documentType === 'waybill' ? orders.filter((order) => order.trackingNumber).length : 0);

  const renderedCount = useRef(0);
  const alreadyFired = useRef(false);

  const handleRendered = useCallback(() => {
    renderedCount.current += 1;
    if (!alreadyFired.current && renderedCount.current >= expectedRenders) {
      alreadyFired.current = true;
      onAllRendered?.();
    }
  }, [expectedRenders, onAllRendered]);

  return (
    <div>
      <style>{`@page { size: ${PAGE_SIZES[paperSize]}; margin: 8mm; } .print-section:not(:last-child) { page-break-after: always; }`}</style>
      {orders.map((order) => {
        const items = Array.isArray(order.items) ? order.items : [];

        if (documentType !== 'waybill') {
          return (
            <section key={order.id} className="print-section p-2 font-sans text-sm">
              {company && (
                <header className="mb-2 border-b pb-1">
                  <p className="font-semibold">{company.name}</p>
                  {company.address && <p className="text-xs">{company.address}</p>}
                </header>
              )}
              <h2 className="font-mono font-semibold text-base">Order #{order.orderNumber}</h2>
              <p>{order.customerName}</p>
              <p>{order.phone ?? ''}</p>
              <p>{addressLine(order.address)}</p>
              <ul className="mt-2">
                {items.map((item, i) => (
                  <li key={i}>
                    {item?.quantity ?? 0}× {item?.title ?? 'Item'} {item?.sku ? `(${item.sku})` : ''}
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <QRBlock value={getOrderQrPayload(order)} onRendered={handleRendered} />
              </div>
            </section>
          );
        }

        return (
          <section key={order.id} className="print-section p-3 font-sans text-[11px] leading-tight text-black">
            <div className="mb-1.5 border-b-2 border-black pb-1.5">
              <p className="text-sm font-bold tracking-tight uppercase">{order.courier ?? 'Courier not assigned'}</p>
            </div>

            {order.trackingNumber && (
              <div className="mb-1.5 flex flex-col items-center border-b border-black pb-1.5">
                <BarcodeBlock value={getTrackingBarcodeValue(order.trackingNumber)} onRendered={handleRendered} />
              </div>
            )}

            <div className="mb-1.5 grid grid-cols-2 gap-3 border-b border-black pb-1.5">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold tracking-wide text-gray-500 uppercase">From</p>
                {company ? (
                  <>
                    <p className="font-medium">{company.name}</p>
                    {company.address && <p>{company.address}</p>}
                  </>
                ) : (
                  <p className="text-gray-400">—</p>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold tracking-wide text-gray-500 uppercase">To</p>
                <p className="font-medium">{order.customerName}</p>
                <p>{addressLine(order.address)}</p>
                {order.phone && <p>{order.phone}</p>}
              </div>
            </div>

            <div className="mb-1.5 flex items-center justify-between gap-3 border-b border-black pb-1.5">
              <div>
                <p className="text-[9px] font-semibold tracking-wide text-gray-500 uppercase">Payment</p>
                <p className="font-medium">{order.paymentMethod ?? '—'}</p>
              </div>
              <QRBlock value={getOrderQrPayload(order)} onRendered={handleRendered} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-semibold tracking-wide text-gray-500 uppercase">Order ID</p>
                <p className="font-mono font-medium">{order.orderNumber}</p>
              </div>
              <div className="w-24 border border-black py-1 text-center text-[8px] text-gray-400">Signature</div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
