import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AppShell } from './app-shell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: () => Promise.resolve({ data: { user: null } }),
      signOut: () => Promise.resolve({}),
    },
  }),
}));

describe('AppShell', () => {
  it('renders nav links, the account menu, and children', () => {
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>
    );
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /orders/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByText('page content')).toBeInTheDocument();
    expect(screen.getByLabelText(/account menu/i)).toBeInTheDocument();
  });

  it('marks the current page active via aria-current', () => {
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>
    );
    expect(screen.getByRole('link', { name: /dashboard/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /orders/i })).not.toHaveAttribute('aria-current');
  });
});
