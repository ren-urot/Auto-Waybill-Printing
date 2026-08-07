'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { PrintPreviewDocument, type PaperSize } from '@/components/print-preview-document';

function PrintBatchPageContent() {
  const params = useParams<{ batch: string }>();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);

  const paperSize = (searchParams.get('paperSize') ?? '4x6') as PaperSize;
  const documentType = (searchParams.get('documentType') ?? 'waybill') as 'waybill' | 'packing_slip';
  const orderIds = params.batch.split(',');

  useEffect(() => {
    Promise.all(orderIds.map((id) => fetch(`/api/orders/${id}`).then((res) => res.json())))
      .then((results) => setOrders(results.map((r) => r.order)))
      .then(() =>
        fetch('/api/print-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderIds, paperSize, documentType }),
        })
      );
  }, [params.batch]);

  useEffect(() => {
    if (orders.length > 0) {
      setTimeout(() => window.print(), 300);
    }
  }, [orders]);

  if (orders.length === 0) return <p className="p-6">Loading…</p>;

  return <PrintPreviewDocument orders={orders} paperSize={paperSize} documentType={documentType} />;
}

export default function PrintBatchPage() {
  return (
    <Suspense fallback={null}>
      <PrintBatchPageContent />
    </Suspense>
  );
}
