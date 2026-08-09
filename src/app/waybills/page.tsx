'use client';

import { useEffect, useState } from 'react';
import {
  FileText,
  Filter,
  Grid2x2,
  List as ListIcon,
  Minus,
  Plus,
  Printer,
  Layers,
  ChevronLeft,
  ChevronRight,
  Download,
  Sparkles,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/status-badge';
import { PlatformIcon, type Platform } from '@/components/platform-icon';
import { PrintPreviewDocument, PAPER_SIZES, type PaperSize, type PrintOrder } from '@/components/print-preview-document';
import type { OrderRow } from '@/components/order-table';
import { cn } from '@/lib/utils';

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

function MiniStat({
  icon: Icon,
  iconClassName,
  label,
  value,
}: {
  icon: typeof FileText;
  iconClassName: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-[10px] border px-3 py-2">
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]', iconClassName)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="leading-tight">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono text-sm font-semibold">{value}</p>
      </div>
    </div>
  );
}

export default function WaybillsPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [paperSize, setPaperSize] = useState<PaperSize>('4x6');
  const [documentType, setDocumentType] = useState<'waybill' | 'packing_slip'>('waybill');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [zoom, setZoom] = useState(100);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewOrder, setPreviewOrder] = useState<PrintOrder | null>(null);

  useEffect(() => {
    fetch(`/api/orders?sort=${sort}`)
      .then((res) => res.json())
      .then((data) => setOrders(Array.isArray(data.orders) ? data.orders : []))
      .finally(() => setLoading(false));
  }, [sort]);

  const selectedOrderIds = orders.filter((o) => selected.has(o.id)).map((o) => o.id);
  // Derived rather than clamped via a setState-in-effect: the selection can
  // shrink (deselecting an order) between renders, which would otherwise
  // leave a stale out-of-range index.
  const clampedPreviewIndex = Math.min(previewIndex, Math.max(0, selectedOrderIds.length - 1));
  const currentPreviewId = selectedOrderIds[clampedPreviewIndex];

  useEffect(() => {
    if (!currentPreviewId) return;
    fetch(`/api/orders/${currentPreviewId}`)
      .then((res) => res.json())
      .then((data) => setPreviewOrder(data.order ?? null))
      .catch(() => setPreviewOrder(null));
  }, [currentPreviewId]);

  const previewLoading = Boolean(currentPreviewId) && previewOrder?.id !== currentPreviewId;

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

  const totalWaybills = selected.size;
  const totalPages = selected.size; // 1 label per page — the only layout the print pipeline supports today

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Print Waybills</h1>
          <p className="text-sm text-muted-foreground">Select orders and print shipping waybills in bulk.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <MiniStat
            icon={FileText}
            iconClassName="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400"
            label="Selected Orders"
            value={String(selected.size)}
          />
          <MiniStat
            icon={Layers}
            iconClassName="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
            label="Total Waybills"
            value={String(totalWaybills)}
          />
          <MiniStat
            icon={FileText}
            iconClassName="bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400"
            label="Total Pages"
            value={String(totalPages)}
          />
          <Button variant="outline" disabled title="Batch print queue is coming in a future update">
            <Printer className="h-4 w-4" />
            Print Queue
          </Button>
        </div>
      </div>

      <Tabs defaultValue="print">
        <TabsList variant="line" className="mb-4 border-b">
          <TabsTrigger value="print">Print Waybills</TabsTrigger>
          <TabsTrigger value="auto">Auto Print</TabsTrigger>
        </TabsList>

        <TabsContent value="print">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_300px]">
            <Card className="max-h-[70vh] overflow-hidden">
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between">
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
                    <button
                      className="text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => setSelected(new Set())}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select value={sort} onValueChange={(v) => v && setSort(v as 'newest' | 'oldest')}>
                    <SelectTrigger size="sm" className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Sort by: Newest</SelectItem>
                      <SelectItem value="oldest">Sort by: Oldest</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" disabled title="Advanced filters are coming in a future update">
                    <Filter className="h-3.5 w-3.5" />
                    Filters
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="max-h-[52vh] space-y-1.5 overflow-y-auto">
                {loading && <p className="py-8 text-center text-sm text-muted-foreground">Loading orders…</p>}
                {!loading && orders.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">No orders yet.</p>
                )}
                {orders.map((order) => (
                  <label
                    key={order.id}
                    className="flex cursor-pointer items-start gap-3 rounded-[10px] border p-3 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(order.id)}
                      onChange={() => toggle(order.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-input"
                    />
                    <PlatformIcon platform={(order.platform ?? 'shopify') as Platform} className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-mono font-medium">#{order.orderNumber}</span>
                        <StatusBadge status={order.status} />
                      </span>
                      <span className="block truncate text-muted-foreground">{order.customerName}</span>
                      <span className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{order.courier ?? '—'}</span>
                        <span>
                          {order.createdAt
                            ? new Date(order.createdAt).toLocaleTimeString(undefined, {
                                hour: 'numeric',
                                minute: '2-digit',
                              })
                            : '—'}
                        </span>
                      </span>
                    </span>
                  </label>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base font-normal text-muted-foreground">
                  <span className="font-medium text-foreground">Preview</span>
                  {selected.size > 0 && <span> · {selected.size} waybills selected</span>}
                </CardTitle>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setViewMode('list')}
                    aria-label="List view"
                    aria-pressed={viewMode === 'list'}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-[8px]',
                      viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <ListIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    aria-label="Grid view"
                    aria-pressed={viewMode === 'grid'}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-[8px]',
                      viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <Grid2x2 className="h-4 w-4" />
                  </button>
                  <div className="ml-2 flex items-center gap-1">
                    <button
                      onClick={() => setZoom((z) => Math.max(50, z - 25))}
                      aria-label="Zoom out"
                      className="flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-10 text-center text-xs text-muted-foreground">{zoom}%</span>
                    <button
                      onClick={() => setZoom((z) => Math.min(150, z + 25))}
                      aria-label="Zoom in"
                      className="flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {selected.size === 0 && (
                  <div className="flex min-h-[420px] items-center justify-center rounded-[10px] border bg-muted/30 p-6">
                    <p className="text-sm text-muted-foreground">Select one or more orders to preview.</p>
                  </div>
                )}

                {selected.size > 0 && viewMode === 'list' && (
                  <>
                    <div className="flex min-h-[420px] items-center justify-center rounded-[10px] border bg-muted/30 p-6">
                      {previewLoading && <p className="text-sm text-muted-foreground">Loading preview…</p>}
                      {!previewLoading && previewOrder && (
                        <div
                          className="mx-auto w-full max-w-[420px] rounded-md border bg-white text-black shadow-sm"
                          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
                        >
                          {/*
                            PrintPreviewDocument renders barcodes/QR codes at their
                            true physical size (they must, for the real print flow at
                            /print/[batch]) — that's wider than this preview card,
                            so it's scaled down as a unit rather than clipped.
                          */}
                          <div className="h-[360px] overflow-hidden p-4">
                            <div className="origin-top-left scale-75">
                              <PrintPreviewDocument orders={[previewOrder]} paperSize={paperSize} documentType={documentType} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {selectedOrderIds.length > 1 && (
                      <>
                        <div className="mt-3 flex items-center justify-center gap-3">
                          <button
                            onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}
                            disabled={clampedPreviewIndex === 0}
                            aria-label="Previous waybill"
                            className="flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {clampedPreviewIndex + 1} / {selectedOrderIds.length}
                          </span>
                          <button
                            onClick={() => setPreviewIndex((i) => Math.min(selectedOrderIds.length - 1, i + 1))}
                            disabled={clampedPreviewIndex === selectedOrderIds.length - 1}
                            aria-label="Next waybill"
                            className="flex h-7 w-7 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                          {selectedOrderIds.map((id, i) => (
                            <button
                              key={id}
                              onClick={() => setPreviewIndex(i)}
                              className={cn(
                                'flex h-14 w-11 shrink-0 items-center justify-center rounded-[6px] border text-xs font-medium transition-colors',
                                i === clampedPreviewIndex
                                  ? 'border-primary bg-primary/5 text-primary'
                                  : 'text-muted-foreground hover:bg-muted'
                              )}
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}

                {selected.size > 0 && viewMode === 'grid' && (
                  <div className="grid max-h-[480px] grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
                    {selectedOrderIds.map((id, i) => {
                      const order = orders.find((o) => o.id === id);
                      return (
                        <button
                          key={id}
                          onClick={() => {
                            setViewMode('list');
                            setPreviewIndex(i);
                          }}
                          className="flex aspect-[4/6] flex-col items-center justify-center gap-1.5 rounded-[8px] border bg-white p-2 text-black hover:border-primary"
                        >
                          <FileText className="h-6 w-6 text-muted-foreground" />
                          <span className="font-mono text-[11px] font-medium">#{order?.orderNumber}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
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

                <div className="space-y-1.5 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">Layout</label>
                    <span className="text-[10px] text-muted-foreground">Coming soon</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2" title="Multi-label layouts are coming in a future update">
                    <span className="flex h-8 items-center justify-center rounded-[8px] border border-primary bg-primary/5 text-xs font-medium text-primary">
                      1 Label per Page
                    </span>
                    <span className="flex h-8 items-center justify-center rounded-[8px] border text-xs text-muted-foreground opacity-50">
                      2 Labels per Page
                    </span>
                  </div>
                </div>

                <div
                  className="grid grid-cols-2 gap-3 opacity-50"
                  title="Orientation, copies, and these printing options aren't wired up to the print pipeline yet"
                >
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Orientation</label>
                    <div className="flex h-8 items-center justify-center rounded-[8px] border text-xs">Portrait</div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Copies per Order</label>
                    <div className="flex h-8 items-center justify-center rounded-[8px] border text-xs">1</div>
                  </div>
                </div>

                <div className="space-y-2 opacity-50" title="Not wired up to the print pipeline yet">
                  <label className="text-xs font-medium text-muted-foreground">Printing Options</label>
                  {['Grayscale', 'Fit to page', 'Add cut line'].map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" disabled className="h-4 w-4 rounded border-input" />
                      {opt}
                    </label>
                  ))}
                </div>

                <div className="space-y-2 border-t pt-4">
                  <Button className="w-full" onClick={printSelected} disabled={selected.size === 0}>
                    {documentType === 'waybill' ? <Printer className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    Print {selected.size || ''} {documentType === 'waybill' ? 'Waybill' : 'Packing List'}
                    {selected.size === 1 ? '' : 's'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled
                    title="Direct PDF export is coming — use Print → Save as PDF in the print dialog for now"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="auto">
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium">Auto Print isn&apos;t available yet</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Automatically print waybills as new orders sync in — coming in a future update.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
