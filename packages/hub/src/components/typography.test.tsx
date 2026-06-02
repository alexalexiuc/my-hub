import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Divider, SectionLabel, SubText } from './typography';

describe('Divider', () => {
  it('renders a separator element', () => {
    const { container } = render(<Divider />);
    expect(container.firstChild).toBeTruthy();
  });
});

describe('SectionLabel', () => {
  it('renders children text', () => {
    render(<SectionLabel>My Section</SectionLabel>);
    expect(screen.getByText('My Section')).toBeTruthy();
  });

  it('merges custom className', () => {
    const { container } = render(<SectionLabel className="custom-class">Label</SectionLabel>);
    expect((container.firstChild as HTMLElement).className).toContain('custom-class');
  });
});

describe('SubText', () => {
  it('renders children text', () => {
    render(<SubText>Helper text</SubText>);
    expect(screen.getByText('Helper text')).toBeTruthy();
  });

  it('forwards extra HTML attributes', () => {
    render(<SubText data-testid="sub">value</SubText>);
    expect(screen.getByTestId('sub')).toBeTruthy();
  });
});
