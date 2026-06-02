import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Sparkline } from './Sparkline';

describe('Sparkline', () => {
  it('renders an SVG with a polyline when data has 2+ points', () => {
    const { container } = render(<Sparkline data={[10, 50, 30, 80]} color="blue" />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('polyline')).toBeTruthy();
  });

  it('renders a filled area path', () => {
    const { container } = render(<Sparkline data={[10, 50, 30]} color="#7c3aed" />);
    expect(container.querySelector('path')).toBeTruthy();
  });

  it('renders an empty div instead of SVG when data has fewer than 2 points', () => {
    const { container } = render(<Sparkline data={[42]} color="blue" />);
    expect(container.querySelector('svg')).toBeNull();
    expect(container.querySelector('div')).toBeTruthy();
  });

  it('applies the given color to the polyline stroke', () => {
    const { container } = render(<Sparkline data={[10, 50]} color="red" />);
    const polyline = container.querySelector('polyline') as SVGPolylineElement;
    expect(polyline.getAttribute('stroke')).toBe('red');
  });

  it('respects width and height props', () => {
    const { container } = render(<Sparkline data={[1, 2]} color="blue" width={200} height={48} />);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('width')).toBe('200');
    expect(svg.getAttribute('height')).toBe('48');
  });
});
