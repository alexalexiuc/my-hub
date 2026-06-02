import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';

function getBar(container: HTMLElement) {
  // The outer div is the track; the inner div is the actual fill bar
  return container.querySelector('div > div > div') as HTMLElement;
}

describe('ProgressBar', () => {
  it('renders the bar at the correct percentage width', () => {
    const { container } = render(<ProgressBar value={50} max={100} />);
    expect(getBar(container).style.width).toBe('50%');
  });

  it('caps width at 100% when value exceeds max', () => {
    const { container } = render(<ProgressBar value={150} max={100} />);
    expect(getBar(container).style.width).toBe('100%');
  });

  it('renders 0% width when max is 0', () => {
    const { container } = render(<ProgressBar value={10} max={0} />);
    expect(getBar(container).style.width).toBe('0%');
  });

  it('shows green color below 80% with thresholds enabled', () => {
    const { container } = render(<ProgressBar value={50} max={100} />);
    expect(getBar(container).style.background).toBe('var(--green)');
  });

  it('shows amber color at ≥80%', () => {
    const { container } = render(<ProgressBar value={80} max={100} />);
    expect(getBar(container).style.background).toBe('var(--amber)');
  });

  it('shows red color at ≥100%', () => {
    const { container } = render(<ProgressBar value={100} max={100} />);
    expect(getBar(container).style.background).toBe('var(--red)');
  });

  it('uses custom color when thresholds is false', () => {
    const { container } = render(<ProgressBar value={90} max={100} color="red" thresholds={false} />);
    expect(getBar(container).style.background).toBe('red');
  });
});
