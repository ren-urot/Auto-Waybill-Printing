import { Package, Plus, Search } from 'lucide-react';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProductsPage() {
  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Inventory tracking across your connected stores.</p>
        </div>
        <Button disabled title="Product tracking is coming in a future update">
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search products by name or SKU…" className="pl-9" disabled />
      </div>

      <div className="flex flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed py-20 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Package className="h-6 w-6 text-muted-foreground" />
        </span>
        <p className="text-sm font-medium">Product tracking isn&apos;t available yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          OmniShip currently syncs orders, not inventory. SKU and stock-level tracking is planned for a future
          update.
        </p>
      </div>
    </AppShell>
  );
}
