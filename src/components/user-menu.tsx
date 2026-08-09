'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, ChevronsUpDown } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Client island inside the sidebar: shows who's signed in and lets them sign
 * out. Reads the session client-side (via useEffect) rather than as a prop
 * so it works the same whether the page that renders AppShell is a Server
 * or Client Component.
 */
export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  const initial = email ? email.charAt(0).toUpperCase() : '?';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        title={collapsed ? (email ?? 'Loading…') : undefined}
        className={`flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/40 ${collapsed ? 'justify-center' : ''}`}
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
            {initial}
          </AvatarFallback>
        </Avatar>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-sidebar-foreground">
                {email ?? 'Loading…'}
              </span>
              <span className="block text-xs text-sidebar-muted-foreground">Owner</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-muted-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuItem onClick={handleSignOut} disabled={signingOut}>
          <LogOut className="h-4 w-4" />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
