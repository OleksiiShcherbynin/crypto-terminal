import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { Tabs } from './Tabs';

const tabs = [
  { id: 'positions', label: 'Positions', badge: 2 },
  { id: 'orders', label: 'Open orders' },
];

it('calls onChange with the clicked id and marks the active tab with aria-selected', async () => {
  const onChange = vi.fn();
  render(<Tabs tabs={tabs} active="positions" onChange={onChange} />);
  expect(screen.getByRole('tablist')).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /Positions/ })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: 'Open orders' })).toHaveAttribute(
    'aria-selected',
    'false',
  );
  await userEvent.click(screen.getByRole('tab', { name: 'Open orders' }));
  expect(onChange).toHaveBeenCalledWith('orders');
});
