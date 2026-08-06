import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AppShell } from './app-shell';

describe('AppShell', () => {
  it('renders nav links and children', () => {
    render(
      <AppShell>
        <p>page content</p>
      </AppShell>
    );
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /orders/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toBeInTheDocument();
    expect(screen.getByText('page content')).toBeInTheDocument();
  });
});
