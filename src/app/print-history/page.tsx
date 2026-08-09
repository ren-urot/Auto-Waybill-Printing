'use client';

import { useEffect, useState } from 'react';
import { FileText, Printer } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Card, CardContent } from '@/components/ui/card';

interface PrintHistoryEntry {
  id: string;
  orderIds: string[];
  paperSize: string;
  documentType: 'waybill' | 'packing_slip';
  printedAt: string;
}

export default function PrintHistoryPage() {
  const [entries, setEntries] = useState<PrintHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/print-history')
      .then((res) => res.json())
      .then((data) => setEntries(Array.isArray(data.printHistory) ? data.printHistory : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Print History</h1>
        <p className="text-sm text-muted-foreground">A log of every waybill and packing list batch you&apos;ve printed.</p>
      </div>

      {loading ? (
        <div className="rounded-lg border py-16 text-center text-sm text-muted-foreground">Loading print history…</div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed py-16 text-center">
          <p className="text-sm font-medium">No prints yet</p>
          <p className="text-sm text-muted-foreground">Printed waybills and packing lists will show up here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-primary dark:bg-orange-500/10">
                    {entry.documentType === 'waybill' ? <Printer className="h-4.5 w-4.5" /> : <FileText className="h-4.5 w-4.5" />}
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      {entry.orderIds.length} {entry.documentType === 'waybill' ? 'waybill' : 'packing list'}
                      {entry.orderIds.length === 1 ? '' : 's'} printed
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(entry.printedAt).toLocaleString()} · {entry.paperSize.toUpperCase()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
