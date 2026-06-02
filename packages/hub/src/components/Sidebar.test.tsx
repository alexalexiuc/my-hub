import { fireEvent, render, screen } from '@testing-library/react';
import { usePathname, useRouter } from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';
import { Sidebar } from './Sidebar';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/finances'),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

const items = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/finances', exact: true },
  { id: 'budget', label: 'Budget', icon: '💰', path: '/finances/budget' },
  { id: 'cashflow', label: 'Cash Flow', icon: '💸', path: '/finances/cashflow' },
];

describe('Sidebar', () => {
  it('renders all nav item labels', () => {
    render(<Sidebar items={items} />);
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Budget')).toBeTruthy();
    expect(screen.getByText('Cash Flow')).toBeTruthy();
  });

  it('highlights the active item based on pathname', () => {
    vi.mocked(usePathname).mockReturnValue('/finances');
    render(<Sidebar items={items} />);
    const dashboardBtn = screen.getByText('Dashboard').closest('button') as HTMLElement;
    expect(dashboardBtn.className).toContain('text-[var(--accent)]');
  });

  it('calls router.push with the item path when clicked', () => {
    const push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
    render(<Sidebar items={items} />);
    fireEvent.click(screen.getByText('Budget'));
    expect(push).toHaveBeenCalledWith('/finances/budget');
  });

  it('renders the header slot when provided', () => {
    render(<Sidebar items={items} header={<span>My Budget</span>} />);
    expect(screen.getByText('My Budget')).toBeTruthy();
  });

  it('renders the action slot when provided', () => {
    render(<Sidebar items={items} action={<button>+ New</button>} />);
    expect(screen.getByText('+ New')).toBeTruthy();
  });
});
