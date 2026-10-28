import { useState } from 'react';
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

function Harness({ onChange }: { onChange: (id: string) => void }) {
  const [active, setActive] = useState('a');
  return (
    <Tabs
      tabs={[
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
        { id: 'c', label: 'C' },
      ]}
      active={active}
      onChange={(id) => {
        onChange(id);
        setActive(id);
      }}
    />
  );
}

it('moves with ArrowRight, End and wraps with ArrowLeft, focusing the new tab', async () => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  screen.getByRole('tab', { name: 'A' }).focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(onChange).toHaveBeenLastCalledWith('b');
  expect(screen.getByRole('tab', { name: 'B' })).toHaveFocus();
  await userEvent.keyboard('{End}');
  expect(onChange).toHaveBeenLastCalledWith('c');
  expect(screen.getByRole('tab', { name: 'C' })).toHaveFocus();
  await userEvent.keyboard('{Home}');
  expect(screen.getByRole('tab', { name: 'A' })).toHaveFocus();
  await userEvent.keyboard('{ArrowLeft}');
  expect(onChange).toHaveBeenLastCalledWith('c');
  expect(screen.getByRole('tab', { name: 'C' })).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}');
  expect(onChange).toHaveBeenLastCalledWith('a');
});
