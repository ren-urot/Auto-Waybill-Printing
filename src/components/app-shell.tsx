'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Store,
  Package,
  Printer,
  History,
  BarChart3,
  PieChart,
  Plug,
  Users,
  Settings as SettingsIcon,
  Sparkles,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserMenu } from './user-menu';

const SIDEBAR_COLLAPSED_KEY = 'omniship-sidebar-collapsed';

const NAV_SECTIONS = [
  {
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/orders', label: 'Orders', icon: ShoppingBag },
      { href: '/stores', label: 'Stores', icon: Store },
      { href: '/products', label: 'Products', icon: Package },
    ],
  },
  {
    items: [
      { href: '/waybills', label: 'Waybills', icon: Printer },
      { href: '/print-history', label: 'Print History', icon: History },
    ],
  },
  {
    items: [
      { href: '/reports', label: 'Reports', icon: BarChart3 },
      { href: '/analytics', label: 'Analytics', icon: PieChart },
      { href: '/integrations', label: 'Integrations', icon: Plug },
      { href: '/users', label: 'Users', icon: Users },
    ],
  },
  {
    items: [{ href: '/settings', label: 'Settings', icon: SettingsIcon }],
  },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    // Bootstraps client state from localStorage, a browser-only API that
    // isn't available during SSR — the state can't be computed during the
    // initial render without a server/client markup mismatch, so syncing it
    // here (rather than in a lazy useState initializer) is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
      return next;
    });
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/*
        Sticky + h-screen (not just min-h-screen) is load-bearing: without it,
        this aside stretches to match the height of whatever tall content
        `main` renders, pushing the Auto Print card and account menu far
        below the visible fold on any page taller than one viewport.
      */}
      <aside
        className={cn(
          'sticky top-0 flex h-screen shrink-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-200',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <div className={cn('flex items-center p-[15px]', collapsed ? 'justify-center' : 'justify-between')}>
          {collapsed ? (
            // eslint-disable-next-line @next/next/no-img-element -- static SVG from /public, no benefit from next/image's raster optimization pipeline
            <img src="/omniship-icon.svg" alt="OmniShip" className="h-11 w-11" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- static SVG from /public, no benefit from next/image's raster optimization pipeline
            <img src="/omniship-logo.svg" alt="OmniShip" className="h-11 w-auto" />
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-sidebar-muted-foreground transition-colors hover:bg-white/5 hover:text-sidebar-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="mx-auto mb-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-sidebar-muted-foreground transition-colors hover:bg-white/5 hover:text-sidebar-foreground"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        )}

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV_SECTIONS.map((section, i) => (
            <div key={i} className="space-y-1">
              {section.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors',
                      collapsed && 'justify-center px-0',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-sidebar-muted-foreground hover:bg-white/5 hover:text-sidebar-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!collapsed && item.label}
                  </Link>
                );
              })}
              {i < NAV_SECTIONS.length - 1 && <div className="mt-4 h-px bg-sidebar-border" />}
            </div>
          ))}
        </nav>

        {!collapsed && (
          <div
            className="relative mx-3 mb-3 overflow-hidden rounded-[10px] p-4"
            style={{ background: 'linear-gradient(155deg, var(--primary) 0%, #c23e14 100%)' }}
          >
            <Sparkles className="absolute -top-2 -right-2 h-16 w-16 text-white/10" />
            <div className="relative">
              <p className="text-sm font-semibold text-white">Auto Print</p>
              <p className="mt-1.5 mb-3 text-xs leading-relaxed text-white/80">
                Automatically print waybills as new orders sync in.
              </p>
              <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white">
                Coming soon
              </span>
            </div>
          </div>
        )}

        <div className="border-t border-sidebar-border p-3">
          <UserMenu collapsed={collapsed} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-[1400px] p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
