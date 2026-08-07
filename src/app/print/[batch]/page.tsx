'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  PrintPreviewDocument,
  PAPER_SIZES,
  type PaperSize,
  type PrintOrder,
} from '@/components/print-preview-document';

interface PrintCompany {
  name: string;
  address: string | null;
}

/**
 * Safety net only. The real trigger is PrintPreviewDocument's onAllRendered,
 * which fires once every barcode/QR has finished drawing. This timeout exists
 * so a miscounted expectation can't leave the user staring at a page that
 * never opens the print dialog — it is deliberately long enough that the
 * render-complete signal wins the race under normal conditions.
 */
const PRINT_SAFETY_TIMEOUT_MS = 2500;

function PrintBatchPageContent() {
  const params = useParams<{ batch: string }>();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<PrintOrder[]>([]);
  const [company, setCompany] = useState<PrintCompany | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

  const paperSizeParam = searchParams.get('paperSize') ?? '4x6';
  const paperSize: PaperSize = (PAPER_SIZES as string[]).includes(paperSizeParam)
    ? (paperSizeParam as PaperSize)
    : '4x6';
  const documentType = searchParams.get('documentType') === 'packing_slip' ? 'packing_slip' : 'waybill';
  const batch = params.batch;

  useEffect(() => {
    let cancelled = false;
    const orderIds = batch.split(',').filter(Boolean);

    async function load() {
      const results = await Promise.all(
        orderIds.map((id) =>
          fetch(`/api/orders/${id}`)
            .then((res) => res.json())
            .catch(() => null)
        )
      );

      // /api/orders/[id] answers a miss with { error }, not { order } —
      // mapping straight to `.order` used to put `undefined` in the array and
      // blow up on the first property access inside the print document.
      const found = results
        .map((result) => (result as { order?: PrintOrder } | null)?.order)
        .filter((order): order is PrintOrder => Boolean(order));

      // Settings are loaded before the document renders so the company header
      // is present in the very first paint — otherwise it could land after
      // window.print() had already captured the page.
      const settings = await fetch('/api/settings')
        .then((res) => res.json())
        .catch(() => null);

      if (cancelled) return;

      // There may be no app_settings row yet; leaving `company` undefined
      // makes the document omit the header entirely.
      if (settings?.settings?.companyName) {
        setCompany({
          name: settings.settings.companyName,
          address: settings.settings.companyAddress ?? null,
        });
      }
      setOrders(found);
      setLoaded(true);

      if (found.length > 0) {
        await fetch('/api/print-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderIds: found.map((order) => order.id),
            paperSize,
            documentType,
          }),
        }).catch(console.error);
      }
    }

    load().catch(console.error);
    return () => {
      cancelled = true;
    };
    // paperSize/documentType come from the same URL as `batch`; re-running on
    // their identity would re-log print history for no reason.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch]);

  const alreadyPrinted = useRef(false);
  const triggerPrint = useCallback(() => {
    if (alreadyPrinted.current) return;
    alreadyPrinted.current = true;
    // One tick out so the browser paints the just-drawn codes before the print
    // dialog snapshots the page.
    setTimeout(() => window.print(), 50);
  }, []);

  useEffect(() => {
    if (orders.length === 0) return;
    const timer = setTimeout(triggerPrint, PRINT_SAFETY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [orders, triggerPrint]);

  if (!loaded) return <p className="p-6">Loading…</p>;
  if (orders.length === 0) return <p className="p-6">No printable orders were found for this batch.</p>;

  return (
    <PrintPreviewDocument
      orders={orders}
      paperSize={paperSize}
      documentType={documentType}
      company={company}
      onAllRendered={triggerPrint}
    />
  );
}

export default function PrintBatchPage() {
  return (
    <Suspense fallback={null}>
      <PrintBatchPageContent />
    </Suspense>
  );
}
