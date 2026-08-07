'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Client island inside the otherwise-server AppShell. Before this existed
 * there was no way to end a session from anywhere in the UI.
 */
export function SignOutButton() {
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    // Clears the cached server-rendered tree so the old session's data isn't
    // still on screen behind the login page.
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
    >
      {signingOut ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
