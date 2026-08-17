import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NavRow } from './NavRow';

describe('NavRow', () => {
  it('renders the label and calls onPrev/onNext when the arrows are clicked', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(<NavRow prevLabel="Previous" nextLabel="Next" onPrev={onPrev} onNext={onNext} label={<span>Item</span>} />);

    expect(screen.getByText('Item')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Previous'));
    fireEvent.click(screen.getByLabelText('Next'));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('does not render an arrow when its handler is omitted', () => {
    render(<NavRow onNext={vi.fn()} nextLabel="Next" label={<span>Item</span>} />);
    expect(screen.queryByLabelText('Previous')).toBeNull();
    expect(screen.getByLabelText('Next')).toBeTruthy();
  });

  it('respects prevDisabled/nextDisabled', () => {
    render(
      <NavRow
        prevLabel="Previous"
        nextLabel="Next"
        onPrev={vi.fn()}
        onNext={vi.fn()}
        prevDisabled={true}
        nextDisabled={false}
        label={<span>Item</span>}
      />,
    );
    expect((screen.getByLabelText('Previous') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('Next') as HTMLButtonElement).disabled).toBe(false);
  });

  it('renders trailing and afterNext content', () => {
    render(
      <NavRow
        onPrev={vi.fn()}
        onNext={vi.fn()}
        prevLabel="Previous"
        nextLabel="Next"
        label={<span>Item</span>}
        afterNext={<span>after-next</span>}
        trailing={<span>1 / 3</span>}
      />,
    );
    expect(screen.getByText('after-next')).toBeTruthy();
    expect(screen.getByText('1 / 3')).toBeTruthy();
  });

  it('is plain-inline by default and only breaks out to the mobile full-bleed strip when fullBleed is set', () => {
    const ref = createRef<HTMLDivElement>();
    const { rerender } = render(<NavRow ref={ref} label={<span>Item</span>} />);
    expect(ref.current?.className).not.toContain('-mx-7');

    rerender(<NavRow ref={ref} label={<span>Item</span>} fullBleed />);
    expect(ref.current?.className).toContain('-mx-7');
  });
});
