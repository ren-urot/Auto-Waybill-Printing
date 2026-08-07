import { BarcodeBlock } from './barcode-block';
import { QRBlock } from './qr-block';
import { getTrackingBarcodeValue, getOrderQrPayload } from '@/lib/print/codes';

export type PaperSize = '4x6' | 'a6' | 'a5' | 'letter';

const PAGE_SIZES: Record<PaperSize, string> = {
  '4x6': '4in 6in',
  a6: '105mm 148mm',
  a5: '148mm 210mm',
  letter: '8.5in 11in',
};

interface PrintOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string | null;
  address: Record<string, string>;
  items: Array<{ sku: string | null; title: string; quantity: number }>;
  courier: string | null;
  trackingNumber: string | null;
}

interface PrintPreviewDocumentProps {
  orders: PrintOrder[];
  paperSize: PaperSize;
  documentType: 'waybill' | 'packing_slip';
}

export function PrintPreviewDocument({ orders, paperSize, documentType }: PrintPreviewDocumentProps) {
  return (
    <div>
      <style>{`@page { size: ${PAGE_SIZES[paperSize]}; margin: 8mm; } .print-section { page-break-after: always; }`}</style>
      {orders.map((order) => (
        <section key={order.id} className="print-section p-2 font-sans text-sm">
          <h2 className="font-mono font-semibold text-base">Order #{order.orderNumber}</h2>
          <p>{order.customerName}</p>
          <p>{order.phone}</p>
          <p>
            {order.address.address1}, {order.address.city}, {order.address.province} {order.address.zip}
          </p>

          {documentType === 'waybill' ? (
            <>
              <p>Courier: {order.courier ?? '—'}</p>
              {order.trackingNumber && <BarcodeBlock value={getTrackingBarcodeValue(order.trackingNumber)} />}
            </>
          ) : (
            <ul>
              {order.items.map((item, i) => (
                <li key={i}>
                  {item.quantity}× {item.title} {item.sku ? `(${item.sku})` : ''}
                </li>
              ))}
            </ul>
          )}

          <QRBlock value={getOrderQrPayload(order)} />
        </section>
      ))}
    </div>
  );
}
