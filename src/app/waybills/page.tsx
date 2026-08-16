'use client';

import { useEffect, useRef, useState } from 'react';
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
  Loader2,
  RectangleVertical,
  RectangleHorizontal,
} from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/status-badge';
import { PlatformIcon, type Platform } from '@/components/platform-icon';
import {
  PrintPreviewDocument,
  PAPER_SIZES,
  type PaperSize,
  type PrintOrder,
  type Orientation,
  type LabelsPerPage,
} from '@/components/print-preview-document';
import type { OrderRow } from '@/components/order-table';
import { cn } from '@/lib/utils';

const PAPER_SIZE_LABELS: Record<PaperSize, string> = {
  '4x6': '4×6 in (thermal label)',
  a6: 'A6',
  a5: 'A5',
  a4: 'A4',
  letter: 'Letter',
};

// A6/A5/Letter are named sizes, not literal dimensions, so orientation
// doesn't change how they're labeled — only the 4x6 thermal label's name
// spells out its actual inches, which swap with the page's own width/height.
function paperSizeLabel(size: PaperSize, orientation: Orientation): string {
  if (size === '4x6') {
    return orientation === 'landscape' ? '6×4 in (thermal label)' : '4×6 in (thermal label)';
  }
  return PAPER_SIZE_LABELS[size];
}

// Physical page dimensions in mm, portrait orientation — swapped for
// landscape. Kept in sync with print-preview-document.tsx's own copy since
// jsPDF needs the same numbers to size its pages, and that component doesn't
// export them.
const PAGE_DIMENSIONS_MM: Record<PaperSize, { w: number; h: number }> = {
  '4x6': { w: 101.6, h: 152.4 },
  a6: { w: 105, h: 148 },
  a5: { w: 148, h: 210 },
  a4: { w: 210, h: 297 },
  letter: { w: 215.9, h: 279.4 },
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

  const [labelsPerPage, setLabelsPerPage] = useState<LabelsPerPage>(1);
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [copies, setCopies] = useState(1);
  const [grayscale, setGrayscale] = useState(false);
  const [fitToPage, setFitToPage] = useState(true);
  const [cutLine, setCutLine] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

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
    const params = new URLSearchParams({
      paperSize,
      documentType,
      orientation,
      labelsPerPage: String(labelsPerPage),
      copies: String(copies),
      grayscale: grayscale ? '1' : '0',
      fitToPage: fitToPage ? '1' : '0',
      cutLine: cutLine ? '1' : '0',
    });
    window.open(`/print/${ids}?${params.toString()}`, '_blank');
  }

  async function downloadPdf() {
    if (selected.size === 0 || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const ids = Array.from(selected);
      const results = await Promise.all(
        ids.map((id) =>
          fetch(`/api/orders/${id}`)
            .then((res) => res.json())
            .catch(() => null)
        )
      );
      const fetchedOrders = results
        .map((result) => (result as { order?: PrintOrder } | null)?.order)
        .filter((order): order is PrintOrder => Boolean(order));
      if (fetchedOrders.length === 0) return;

      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas-pro'),
      ]);

      const container = pdfContainerRef.current;
      if (!container) return;

      // Rendered off-screen (see the fixed, translated-out-of-view wrapper
      // below) so html2canvas can rasterize the exact same markup the real
      // print flow uses, without it ever being visible on the page.
      const { createRoot } = await import('react-dom/client');
      const root = createRoot(container);
      await new Promise<void>((resolve) => {
        root.render(
          <PrintPreviewDocument
            orders={fetchedOrders}
            paperSize={paperSize}
            documentType={documentType}
            orientation={orientation}
            labelsPerPage={labelsPerPage}
            copies={copies}
            grayscale={grayscale}
            fitToPage={fitToPage}
            cutLine={cutLine}
            onAllRendered={resolve}
          />
        );
      });
      // One more frame so the just-drawn barcode/QR canvases are painted
      // before html2canvas snapshots them.
      await new Promise((resolve) => setTimeout(resolve, 100));

      const { w: pageW, h: pageH } =
        orientation === 'landscape'
          ? { w: PAGE_DIMENSIONS_MM[paperSize].h, h: PAGE_DIMENSIONS_MM[paperSize].w }
          : PAGE_DIMENSIONS_MM[paperSize];

      const pdf = new jsPDF({ unit: 'mm', format: [pageW, pageH], orientation: pageW > pageH ? 'landscape' : 'portrait' });
      const pageEls = container.querySelectorAll<HTMLElement>('.print-section');
      for (let i = 0; i < pageEls.length; i++) {
        const canvas = await html2canvas(pageEls[i], { scale: 2, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/png');
        if (i > 0) pdf.addPage([pageW, pageH]);
        pdf.addImage(imgData, 'PNG', 0, 0, pageW, pageH);
      }
      pdf.save(`waybills-${new Date().toISOString().slice(0, 10)}.pdf`);

      root.unmount();
    } finally {
      setDownloadingPdf(false);
    }
  }

  const totalWaybills = selected.size * copies;
  const totalPages = Math.ceil(totalWaybills / labelsPerPage);

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
                          className="mx-auto w-fit max-w-full overflow-hidden rounded-md border bg-white text-black shadow-sm"
                          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
                        >
                          {/*
                            PrintPreviewDocument renders at true physical size
                            (it must, for the real print flow at /print/[batch])
                            and fills the full page height for each paper size
                            — scaled down as a unit so the card shows the whole
                            label with no empty space, instead of clipping it
                            to a fixed preview height. `w-fit` (not a fixed
                            max-width) so the card's own shape actually
                            reflects portrait vs. landscape instead of always
                            rendering at the same width regardless of
                            orientation.
                          */}
                          <div className="p-4">
                            {/*
                              `zoom` (not `transform: scale`) so the shrunk
                              content's reserved layout space shrinks with it —
                              a transform-based scale leaves the pre-scale
                              height reserved, showing as blank space below
                              the visually-shrunk label.
                            */}
                            <div style={{ zoom: 0.55 }}>
                              <PrintPreviewDocument
                                orders={[previewOrder]}
                                paperSize={paperSize}
                                documentType={documentType}
                                orientation={orientation}
                                labelsPerPage={labelsPerPage}
                                grayscale={grayscale}
                                fitToPage={fitToPage}
                                cutLine={cutLine}
                              />
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
                          {paperSizeLabel(size, orientation)}
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
                  <label className="text-xs font-medium text-muted-foreground">Layout</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setLabelsPerPage(1)}
                      className={cn(
                        'flex h-8 items-center justify-center rounded-[8px] border text-xs font-medium transition-colors',
                        labelsPerPage === 1
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      1 Label per Page
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabelsPerPage(2)}
                      className={cn(
                        'flex h-8 items-center justify-center rounded-[8px] border text-xs font-medium transition-colors',
                        labelsPerPage === 2
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      2 Labels per Page
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabelsPerPage(4)}
                      className={cn(
                        'flex h-8 items-center justify-center rounded-[8px] border text-xs font-medium transition-colors',
                        labelsPerPage === 4
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      4 Labels per Page
                    </button>
                    <button
                      type="button"
                      onClick={() => setLabelsPerPage(6)}
                      className={cn(
                        'flex h-8 items-center justify-center rounded-[8px] border text-xs font-medium transition-colors',
                        labelsPerPage === 6
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      6 Labels per Page
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Orientation</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setOrientation('portrait')}
                        aria-label="Portrait"
                        aria-pressed={orientation === 'portrait'}
                        title="Portrait"
                        className={cn(
                          'flex h-8 items-center justify-center gap-1.5 rounded-[8px] border text-xs font-medium transition-colors',
                          orientation === 'portrait'
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <RectangleVertical className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrientation('landscape')}
                        aria-label="Landscape"
                        aria-pressed={orientation === 'landscape'}
                        title="Landscape"
                        className={cn(
                          'flex h-8 items-center justify-center gap-1.5 rounded-[8px] border text-xs font-medium transition-colors',
                          orientation === 'landscape'
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'text-muted-foreground hover:bg-muted'
                        )}
                      >
                        <RectangleHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Copies per Order</label>
                    <div className="flex h-8 items-center justify-between rounded-[8px] border px-1.5">
                      <button
                        type="button"
                        onClick={() => setCopies((c) => Math.max(1, c - 1))}
                        aria-label="Decrease copies"
                        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                        disabled={copies <= 1}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="font-mono text-xs">{copies}</span>
                      <button
                        type="button"
                        onClick={() => setCopies((c) => Math.min(10, c + 1))}
                        aria-label="Increase copies"
                        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                        disabled={copies >= 10}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Printing Options</label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={grayscale}
                      onChange={(e) => setGrayscale(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    Grayscale
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={fitToPage}
                      onChange={(e) => setFitToPage(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    Fit to page
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={cutLine}
                      onChange={(e) => setCutLine(e.target.checked)}
                      disabled={labelsPerPage === 1}
                      className="h-4 w-4 rounded border-input disabled:opacity-40"
                    />
                    Add cut line
                    {labelsPerPage === 1 && <span className="text-xs text-muted-foreground">(needs 2+ per page)</span>}
                  </label>
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
                    onClick={downloadPdf}
                    disabled={selected.size === 0 || downloadingPdf}
                  >
                    {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {downloadingPdf ? 'Generating PDF…' : 'Download PDF'}
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

      {/* Off-screen render target for PDF export — html2canvas needs the
          document actually laid out in the DOM to rasterize it, so this is
          positioned far outside the viewport rather than display:none. */}
      <div ref={pdfContainerRef} className="fixed top-0 left-[-99999px]" aria-hidden="true" />
    </AppShell>
  );
}
