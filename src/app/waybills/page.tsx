'use client';

import { useEffect, useState } from 'react';
import { Printer, FileText } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/status-badge';
import { PrintPreviewDocument, PAPER_SIZES, type PaperSize, type PrintOrder } from '@/components/print-preview-document';
import type { OrderRow } from '@/components/order-table';

const PAPER_SIZE_LABELS: Record<PaperSize, string> = {
  '4x6': '4×6 in (thermal label)',
  a6: 'A6',
  a5: 'A5',
  letter: 'Letter',
};

const DOCUMENT_TYPES = [
  { value: 'waybill', label: 'Waybill' },
  { value: 'packing_slip', label: 'Packing List' },
] as const;

export default function WaybillsPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paperSize, setPaperSize] = useState<PaperSize>('4x6');
  const [documentType, setDocumentType] = useState<'waybill' | 'packing_slip'>('waybill');
  const [previewOrder, setPreviewOrder] = useState<PrintOrder | null>(null);

  useEffect(() => {
    fetch('/api/orders?status=ready_to_ship&sort=newest')
      .then((res) => res.json())
      .then((data) => setOrders(Array.isArray(data.orders) ? data.orders : []))
      .finally(() => setLoading(false));
  }, []);

  const firstSelectedId = Array.from(selected)[0];

  useEffect(() => {
    // No selection: nothing to fetch. The render below already keys off
    // `selected.size`, not `previewOrder`, so a stale previewOrder value
    // sitting unused in state after a deselect is harmless.
    if (!firstSelectedId) return;
    fetch(`/api/orders/${firstSelectedId}`)
      .then((res) => res.json())
      .then((data) => setPreviewOrder(data.order ?? null))
      .catch(() => setPreviewOrder(null));
  }, [firstSelectedId]);

  // Derived rather than a separate "previewLoading" flag set synchronously
  // in the effect above: true exactly while the fetched preview hasn't
  // caught up to the current selection yet.
  const previewLoading = Boolean(firstSelectedId) && previewOrder?.id !== firstSelectedId;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  function selectAll() {
    setSelected(selected.size === orders.length ? new Set() : new Set(orders.map((o) => o.id)));
  }

  function printSelected() {
    const ids = Array.from(selected).join(',');
    window.open(`/print/${ids}?paperSize=${paperSize}&documentType=${documentType}`, '_blank');
  }

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Waybills</h1>
        <p className="text-sm text-muted-foreground">Select orders and print shipping waybills in bulk.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_280px]">
        <Card className="max-h-[70vh] overflow-hidden">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={orders.length > 0 && selected.size === orders.length}
                  onChange={selectAll}
                  className="h-4 w-4 rounded border-input"
                />
                Select all ({orders.length})
              </label>
            </CardTitle>
            {selected.size > 0 && (
              <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelected(new Set())}>
                Clear
              </button>
            )}
          </CardHeader>
          <CardContent className="max-h-[58vh] space-y-1.5 overflow-y-auto">
            {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading orders…</p>}
            {!loading && orders.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No orders are ready to print.</p>
            )}
            {orders.map((order) => (
              <label
                key={order.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={selected.has(order.id)}
                  onChange={() => toggle(order.id)}
                  className="h-4 w-4 shrink-0 rounded border-input"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium">#{order.orderNumber}</span>
                    <StatusBadge status={order.status} />
                  </span>
                  <span className="block truncate text-muted-foreground">{order.customerName}</span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Preview {selected.size > 0 && <span className="font-normal text-muted-foreground">· {selected.size} selected</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex min-h-[420px] items-center justify-center rounded-lg border bg-muted/30 p-6">
              {selected.size === 0 && (
                <p className="text-sm text-muted-foreground">Select one or more orders to preview.</p>
              )}
              {selected.size > 0 && previewLoading && <p className="text-sm text-muted-foreground">Loading preview…</p>}
              {selected.size > 0 && !previewLoading && previewOrder && (
                <div className="w-full max-w-xs rounded-md border bg-white text-black shadow-sm">
                  {/*
                    PrintPreviewDocument renders barcodes/QR codes at their
                    true physical size (they must, for the real print flow at
                    /print/[batch]) — that's wider than this 320px preview
                    card, so it's scaled down as a unit rather than clipped.
                    overflow-hidden + a fixed, pre-scaled height keeps the
                    scaled-down content from leaving whitespace below it.
                  */}
                  <div className="h-[360px] overflow-hidden p-4">
                    <div className="origin-top-left scale-75">
                      <PrintPreviewDocument orders={[previewOrder]} paperSize={paperSize} documentType={documentType} />
                    </div>
                  </div>
                  {selected.size > 1 && (
                    <p className="border-t p-2 text-center text-xs text-muted-foreground">
                      Previewing 1 of {selected.size} selected orders
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Print Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Document Type</label>
              <Select value={documentType} onValueChange={(v) => v && setDocumentType(v as 'waybill' | 'packing_slip')}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Paper Size</label>
              <Select value={paperSize} onValueChange={(v) => v && setPaperSize(v as PaperSize)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAPER_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {PAPER_SIZE_LABELS[size]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Printer</label>
              <Select defaultValue="os-default">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="os-default">Use system print dialog</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Printing opens your browser&apos;s print dialog, where you can pick any printer connected to this
                computer.
              </p>
            </div>

            <Button className="w-full" onClick={printSelected} disabled={selected.size === 0}>
              {documentType === 'waybill' ? <Printer className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              Print {selected.size || ''} {documentType === 'waybill' ? 'Waybill' : 'Packing List'}
              {selected.size === 1 ? '' : 's'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
