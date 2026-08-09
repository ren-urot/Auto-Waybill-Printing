'use client';

import { useCallback, useRef } from 'react';
import { Truck } from 'lucide-react';
import { BarcodeBlock } from './barcode-block';
import { QRBlock } from './qr-block';
import { getTrackingBarcodeValue, getOrderQrPayload } from '@/lib/print/codes';

// A colored badge, not a reproduction of any courier's actual logo — we have
// no licensing/API partnership with these couriers to use their real marks,
// and a hand-drawn recreation of a trademarked wordmark would misrepresent
// this as an official courier document. Falls back to a neutral color for
// couriers not in this list.
const COURIER_COLORS: Record<string, string> = {
  'j&t express': '#ED1C24',
  'ninja van': '#6F2DBD',
  'lbc express': '#00A99D',
  'flash express': '#FFC629',
  'spx express': '#EE4D2D',
  'lazada logistics': '#0F146D',
};

function courierColor(courier: string | null): string {
  return COURIER_COLORS[courier?.trim().toLowerCase() ?? ''] ?? '#374151';
}

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
  createdAt?: string | Date | null;
  // The store this order actually synced from — the "ship from" identity on
  // a waybill should reflect the order's own store, not a single app-wide
  // company name, since one merchant can run several connected stores.
  storeName?: string | null;
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
            <div className="mb-1.5 flex items-center justify-between border-b-2 border-black pb-1.5">
              <span
                className="flex items-center gap-1.5 rounded px-2 py-1 text-sm font-bold tracking-tight text-white uppercase"
                style={{ backgroundColor: courierColor(order.courier) }}
              >
                <Truck className="h-3.5 w-3.5" />
                {order.courier ?? 'Courier not assigned'}
              </span>
              {order.createdAt && (
                <span className="text-right text-[9px] text-gray-500">
                  Ship Date
                  <br />
                  <span className="font-medium text-black">
                    {new Date(order.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </span>
              )}
            </div>

            {order.trackingNumber && (
              <div className="mb-1.5 flex flex-col items-center border-b border-black pb-1.5">
                <BarcodeBlock value={getTrackingBarcodeValue(order.trackingNumber)} onRendered={handleRendered} />
              </div>
            )}

            <div className="mb-1.5 grid grid-cols-2 gap-3 border-b border-black pb-1.5">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold tracking-wide text-gray-500 uppercase">From</p>
                {order.storeName || company ? (
                  <>
                    <p className="font-medium">{order.storeName ?? company?.name}</p>
                    {company?.address && <p>{company.address}</p>}
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

            <div className="mb-1.5 flex items-center justify-between gap-3 border-b border-dashed border-black pb-1.5">
              <div>
                <p className="text-[9px] font-semibold tracking-wide text-gray-500 uppercase">Order ID</p>
                <p className="font-mono font-medium">{order.orderNumber}</p>
              </div>
              <div className="w-24 border border-black py-1 text-center text-[8px] text-gray-400">Signature</div>
            </div>

            {items.length > 0 && (
              <div>
                <p className="text-[9px] font-semibold tracking-wide text-gray-500 uppercase">Product Details</p>
                <ul>
                  {items.map((item, i) => (
                    <li key={i}>
                      {item?.quantity ?? 0}× {item?.title ?? 'Item'} {item?.sku ? `(${item.sku})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
