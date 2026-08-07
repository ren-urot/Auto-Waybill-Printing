import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SyncStatusIndicator } from './sync-status-indicator';

describe('SyncStatusIndicator', () => {
  it('shows the error state and calls onSync when clicked', () => {
    const onSync = vi.fn();
    render(<SyncStatusIndicator lastSyncedAt={null} status="error" syncing={false} onSync={onSync} />);
    expect(screen.getByText(/sync failed/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /sync now/i }));
    expect(onSync).toHaveBeenCalledOnce();
  });

  it('disables the button while syncing', () => {
    render(<SyncStatusIndicator lastSyncedAt={new Date()} status="connected" syncing onSync={() => {}} />);
    expect(screen.getByRole('button', { name: /syncing/i })).toBeDisabled();
  });
});
