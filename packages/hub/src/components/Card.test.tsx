import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Hello</Card>);
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('applies cursor-pointer when onClick is provided', () => {
    const { container } = render(<Card onClick={vi.fn()}>Content</Card>);
    const card = container.querySelector('[data-card]') as HTMLElement;
    expect(card.className).toContain('cursor-pointer');
  });

  it('applies compact rounded border when compact is true', () => {
    const { container } = render(<Card compact>Content</Card>);
    const card = container.querySelector('[data-card]') as HTMLElement;
    expect(card.className).toContain('rounded-[10px]');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Card onClick={onClick}>Clickable</Card>);
    fireEvent.click(screen.getByText('Clickable'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
