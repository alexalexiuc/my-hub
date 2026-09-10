import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CopyButton } from './CopyButton';

describe('CopyButton', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('copies the value to the clipboard and shows a transient confirmation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<CopyButton value="abc-123" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith('abc-123');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Copied!' })).not.toBeNull());
  });

  it('uses a custom label when provided', () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    render(<CopyButton value="abc-123" label="Copy ID" />);
    expect(screen.queryByRole('button', { name: 'Copy ID' })).not.toBeNull();
  });
});
