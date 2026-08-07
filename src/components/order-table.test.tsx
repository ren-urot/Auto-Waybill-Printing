// src/components/order-table.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { OrderTable } from './order-table';

const orders = [
  { id: 'o1', orderNumber: '1001', customerName: 'Ana Cruz', courier: 'LBC', status: 'ready_to_ship' },
  { id: 'o2', orderNumber: '1002', customerName: 'Bea Reyes', courier: 'J&T', status: 'printed' },
];

describe('OrderTable', () => {
  it('toggles a row into the selection set on checkbox click', () => {
    const onSelectionChange = vi.fn();
    render(<OrderTable orders={orders} selected={new Set()} onSelectionChange={onSelectionChange} />);
    fireEvent.click(screen.getByLabelText('Select order 1001'));
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['o1']));
  });

  it('renders customer name and status badge for each row', () => {
    render(<OrderTable orders={orders} selected={new Set()} onSelectionChange={() => {}} />);
    expect(screen.getByText('Ana Cruz')).toBeInTheDocument();
    expect(screen.getByText('Bea Reyes')).toBeInTheDocument();
  });
});
