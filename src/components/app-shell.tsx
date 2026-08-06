import Link from 'next/link';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <nav className="w-56 shrink-0 border-r p-4 space-y-2">
        <div className="font-mono font-semibold text-lg mb-6">OmniShip</div>
        <Link href="/" className="block rounded-md px-3 py-2 text-sm hover:bg-accent">
          Dashboard
        </Link>
        <Link href="/orders" className="block rounded-md px-3 py-2 text-sm hover:bg-accent">
          Orders
        </Link>
        <Link href="/settings" className="block rounded-md px-3 py-2 text-sm hover:bg-accent">
          Settings
        </Link>
      </nav>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
