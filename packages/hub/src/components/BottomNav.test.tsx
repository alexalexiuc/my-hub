import { fireEvent, render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';
import { BottomNav } from './BottomNav';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

const leftItems = [
  { id: 'home', icon: '🏠', label: 'Home', path: '/', exact: true },
  { id: 'budget', icon: '💰', label: 'Budget', path: '/budget' },
];

describe('BottomNav', () => {
  it('renders left nav item labels', () => {
    render(<BottomNav leftItems={leftItems} />);
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Budget')).toBeTruthy();
  });

  it('calls router.push with the item path when a nav item is clicked', () => {
    const push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
    render(<BottomNav leftItems={leftItems} />);
    fireEvent.click(screen.getByText('Budget').closest('button')!);
    expect(push).toHaveBeenCalledWith('/budget');
  });

  it('renders a FAB with its label when the fab prop is provided', () => {
    render(<BottomNav leftItems={leftItems} fab={{ label: 'Add', onClick: vi.fn() }} />);
    expect(screen.getByText('Add')).toBeTruthy();
  });

  it('calls fab.onClick when the FAB button is clicked', () => {
    const onFabClick = vi.fn();
    render(<BottomNav leftItems={leftItems} fab={{ label: 'Add', onClick: onFabClick }} />);
    fireEvent.click(screen.getByText('Add').closest('button')!);
    expect(onFabClick).toHaveBeenCalledOnce();
  });

  it('renders a More button when moreItems is provided', () => {
    const moreItems = [{ id: 'reports', icon: '📊', label: 'Reports', path: '/reports' }];
    render(<BottomNav leftItems={leftItems} moreItems={moreItems} />);
    expect(screen.getByText('More')).toBeTruthy();
  });

  // The bar lays every child out as an equal flex cell, so "centred FAB" means "middle cell".
  // Pinned as a test because the arrangement is what callers have to balance their item counts
  // against, and nothing else fails when it drifts — the FAB just quietly sits off centre.
  it('places the FAB in the middle cell when the item counts are balanced', () => {
    const { container } = render(
      <BottomNav
        leftItems={leftItems}
        rightItems={[{ id: 'menu', icon: '🗓', label: 'Menu', path: '/menu' }]}
        moreItems={[{ id: 'settings', icon: '⚙', label: 'Settings', path: '/settings' }]}
        fab={{ label: 'Add', onClick: vi.fn() }}
      />,
    );
    const cells = [...container.querySelectorAll(':scope > div > button')];
    expect(cells).toHaveLength(5);
    expect(cells[2]).toBe(screen.getByText('Add').closest('button'));
  });
});
