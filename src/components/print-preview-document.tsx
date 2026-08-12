'use client';

import { useCallback, useRef } from 'react';
import { Truck } from 'lucide-react';
import { BarcodeBlock } from './barcode-block';
import { QRBlock } from './qr-block';
import { getTrackingBarcodeValue, getOrderQrPayload } from '@/lib/print/codes';

// Real courier logos (from each courier's own Wikimedia Commons upload) —
// showing which courier is actually handling this specific shipment is
// standard, functional labeling (the same reason every Shopify/Lazada/Amazon
// shipping label shows the real carrier's mark), not a claim of partnership
// with them. Couriers without a matched logo fall back to a plain colored
// text badge instead.
const COURIER_LOGOS: Record<string, string> = {
  'j&t express': '/couriers/jt-express.svg',
  'ninja van': '/couriers/ninja-van.svg',
  'lbc express': '/couriers/lbc-express.svg',
  'flash express': '/couriers/flash-express.svg',
  'lazada logistics': '/couriers/lazada.svg',
};

const COURIER_COLORS: Record<string, string> = {
  'j&t express': '#ED1C24',
  'ninja van': '#6F2DBD',
  'lbc express': '#00A99D',
  'flash express': '#FFC629',
  'spx express': '#EE4D2D',
  'lazada logistics': '#0F146D',
};

function courierLogo(courier: string | null): string | undefined {
  return COURIER_LOGOS[courier?.trim().toLowerCase() ?? ''];
}

function courierColor(courier: string | null): string {
  return COURIER_COLORS[courier?.trim().toLowerCase() ?? ''] ?? '#374151';
}

export type PaperSize = '4x6' | 'a6' | 'a5' | 'letter';
export type Orientation = 'portrait' | 'landscape';
export type LabelsPerPage = 1 | 2;

export const PAPER_SIZES: PaperSize[] = ['4x6', 'a6', 'a5', 'letter'];

// Physical page dimensions in portrait orientation — swapped for landscape.
const PAGE_DIMENSIONS_MM: Record<PaperSize, { w: number; h: number }> = {
  '4x6': { w: 101.6, h: 152.4 },
  a6: { w: 105, h: 148 },
  a5: { w: 148, h: 210 },
  letter: { w: 215.9, h: 279.4 },
};

const PAGE_MARGIN_MM = 8;
const CUT_LINE_GAP_MM = 6;

export function pageDimensions(paperSize: PaperSize, orientation: Orientation) {
  const { w, h } = PAGE_DIMENSIONS_MM[paperSize];
  return orientation === 'landscape' ? { w: h, h: w } : { w, h };
}

function labelContentHeightMm(paperSize: PaperSize, orientation: Orientation, labelsPerPage: LabelsPerPage) {
  const { h } = pageDimensions(paperSize, orientation);
  const usable = h - PAGE_MARGIN_MM * 2;
  return labelsPerPage === 2 ? (usable - CUT_LINE_GAP_MM) / 2 : usable;
}

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
  orientation?: Orientation;
  labelsPerPage?: LabelsPerPage;
  /** Each selected order is repeated this many times in the printed batch. */
  copies?: number;
  /** Converts the whole document to grayscale — useful for thermal/mono printers. */
  grayscale?: boolean;
  /**
   * When true (default), the exact physical page size is enforced via
   * `@page { size }`. Turning it off omits that rule so the browser's print
   * dialog / printer default paper handling takes over instead.
   */
  fitToPage?: boolean;
  /** Draws a dashed cut line between the two labels when labelsPerPage is 2. */
  cutLine?: boolean;
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

function WaybillLabel({
  order,
  heightMm,
  compact,
  landscape,
  company,
  onRendered,
}: {
  order: PrintOrder;
  heightMm: number;
  compact: boolean;
  landscape: boolean;
  company?: { name: string; address: string | null };
  onRendered: () => void;
}) {
  const items = Array.isArray(order.items) ? order.items : [];
  const shrink = compact || landscape;
  const barcodeHeight = shrink ? 40 : 64;
  const barcodeFontSize = shrink ? 12 : 14;
  const qrSize = shrink ? 88 : 128;
  const textSize = shrink ? 'text-[11px]' : 'text-[13px]';
  const labelSize = shrink ? 'text-[9px]' : 'text-[10px]';
  const sectionPad = landscape ? 'py-1.5' : 'py-3';

  const header = (
    <div className={`flex items-center justify-between border-b-2 border-black pb-2 ${landscape ? 'col-span-2' : ''}`}>
      {courierLogo(order.courier) ? (
        // eslint-disable-next-line @next/next/no-img-element -- static SVG from /public, printed output doesn't benefit from next/image
        <img
          src={courierLogo(order.courier)}
          alt={order.courier ?? ''}
          className={shrink ? 'h-6 max-w-[130px] object-contain object-left' : 'h-9 max-w-[180px] object-contain object-left'}
        />
      ) : (
        <span
          className={`flex items-center gap-1.5 rounded font-bold tracking-tight text-white uppercase ${shrink ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-base'}`}
          style={{ backgroundColor: courierColor(order.courier) }}
        >
          <Truck className={shrink ? 'h-3 w-3' : 'h-4 w-4'} />
          {order.courier ?? 'Courier not assigned'}
        </span>
      )}
      {order.createdAt && (
        <span className={`text-right text-gray-500 ${labelSize}`}>
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
  );

  const barcode = order.trackingNumber && (
    <div className={`flex flex-col items-center border-b border-black ${sectionPad}`}>
      <BarcodeBlock
        value={getTrackingBarcodeValue(order.trackingNumber)}
        onRendered={onRendered}
        height={barcodeHeight}
        fontSize={barcodeFontSize}
      />
    </div>
  );

  const fromTo = (
    <div className={`grid grid-cols-2 gap-3 border-b border-black ${sectionPad}`}>
      <div className="min-w-0">
        <p className={`font-semibold tracking-wide text-gray-500 uppercase ${labelSize}`}>From</p>
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
        <p className={`font-semibold tracking-wide text-gray-500 uppercase ${labelSize}`}>To</p>
        <p className="font-medium">{order.customerName}</p>
        <p>{addressLine(order.address)}</p>
        {order.phone && <p>{order.phone}</p>}
      </div>
    </div>
  );

  const paymentQr = (
    <div className={`flex items-center justify-between gap-3 border-b border-black ${sectionPad}`}>
      <div>
        <p className={`font-semibold tracking-wide text-gray-500 uppercase ${labelSize}`}>Payment</p>
        <p className="font-medium">{order.paymentMethod ?? '—'}</p>
      </div>
      <QRBlock value={getOrderQrPayload(order)} onRendered={onRendered} size={qrSize} />
    </div>
  );

  const orderIdSignature = (
    <div className={`flex items-center justify-between gap-3 border-b border-dashed border-black ${sectionPad}`}>
      <div>
        <p className={`font-semibold tracking-wide text-gray-500 uppercase ${labelSize}`}>Order ID</p>
        <p className="font-mono font-medium">{order.orderNumber}</p>
      </div>
      <div className={`border border-black text-center text-gray-400 ${shrink ? 'w-20 py-1 text-[8px]' : 'w-28 py-2 text-[9px]'}`}>
        Signature
      </div>
    </div>
  );

  const productDetails = items.length > 0 && (
    <div className={landscape ? 'col-span-2 pt-1.5' : 'pt-3'}>
      <p className={`font-semibold tracking-wide text-gray-500 uppercase ${labelSize}`}>Product Details</p>
      <ul>
        {items.map((item, i) => (
          <li key={i}>
            {item?.quantity ?? 0}× {item?.title ?? 'Item'} {item?.sku ? `(${item.sku})` : ''}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div
      className={`waybill-label font-sans ${textSize} leading-snug text-black ${landscape ? 'grid grid-cols-2 gap-x-4' : 'flex flex-col'}`}
      style={{ minHeight: `${heightMm}mm` }}
    >
      {landscape ? (
        <>
          {header}
          {barcode}
          {fromTo}
          {paymentQr}
          {orderIdSignature}
          {productDetails}
        </>
      ) : (
        <div className="flex flex-1 flex-col justify-between">
          {header}
          {barcode}
          {fromTo}
          {paymentQr}
          {orderIdSignature}
          {productDetails}
        </div>
      )}
    </div>
  );
}

export function PrintPreviewDocument({
  orders,
  paperSize,
  documentType,
  company,
  onAllRendered,
  orientation = 'portrait',
  labelsPerPage = 1,
  copies = 1,
  grayscale = false,
  fitToPage = true,
  cutLine = false,
}: PrintPreviewDocumentProps) {
  const expandedOrders = copies > 1 ? orders.flatMap((order) => Array(copies).fill(order) as PrintOrder[]) : orders;

  // One QR per order, plus one barcode per waybill order that actually has a
  // tracking number to encode.
  const expectedRenders =
    expandedOrders.length +
    (documentType === 'waybill' ? expandedOrders.filter((order) => order.trackingNumber).length : 0);

  const renderedCount = useRef(0);
  const alreadyFired = useRef(false);

  const handleRendered = useCallback(() => {
    renderedCount.current += 1;
    if (!alreadyFired.current && renderedCount.current >= expectedRenders) {
      alreadyFired.current = true;
      onAllRendered?.();
    }
  }, [expectedRenders, onAllRendered]);

  if (documentType !== 'waybill') {
    return (
      <div>
        <style>{`@page { ${fitToPage ? `size: ${PAGE_DIMENSIONS_MM[paperSize].w}mm ${PAGE_DIMENSIONS_MM[paperSize].h}mm; ` : ''}margin: ${PAGE_MARGIN_MM}mm; } .print-section:not(:last-child) { page-break-after: always; } ${grayscale ? '.print-section { filter: grayscale(1); }' : ''}`}</style>
        {expandedOrders.map((order, i) => {
          const items = Array.isArray(order.items) ? order.items : [];
          return (
            <section key={`${order.id}-${i}`} className="print-section p-2 font-sans text-sm">
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
                {items.map((item, j) => (
                  <li key={j}>
                    {item?.quantity ?? 0}× {item?.title ?? 'Item'} {item?.sku ? `(${item.sku})` : ''}
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <QRBlock value={getOrderQrPayload(order)} onRendered={handleRendered} />
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  const heightMm = labelContentHeightMm(paperSize, orientation, labelsPerPage);
  const { w: pageW, h: pageH } = pageDimensions(paperSize, orientation);
  const pages: PrintOrder[][] = [];
  for (let i = 0; i < expandedOrders.length; i += labelsPerPage) {
    pages.push(expandedOrders.slice(i, i + labelsPerPage));
  }

  return (
    <div>
      <style>{`@page { ${fitToPage ? `size: ${pageW}mm ${pageH}mm; ` : ''}margin: ${PAGE_MARGIN_MM}mm; } .print-section:not(:last-child) { page-break-after: always; } ${grayscale ? '.print-section { filter: grayscale(1); }' : ''}`}</style>
      {pages.map((page, pageIndex) => (
        <section
          key={pageIndex}
          className="print-section p-4"
          style={{ width: `${pageW - PAGE_MARGIN_MM * 2}mm`, boxSizing: 'border-box' }}
        >
          {page.map((order, i) => (
            <div key={`${order.id}-${pageIndex}-${i}`}>
              {i > 0 && (
                <div
                  className={cutLine ? 'my-1 border-t border-dashed border-gray-400' : 'my-1'}
                  style={{ height: `${CUT_LINE_GAP_MM}mm` }}
                >
                  {cutLine && <p className="text-center text-[8px] text-gray-400">✂ cut here</p>}
                </div>
              )}
              <WaybillLabel
                order={order}
                heightMm={heightMm}
                compact={labelsPerPage === 2}
                landscape={orientation === 'landscape'}
                company={company}
                onRendered={handleRendered}
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
