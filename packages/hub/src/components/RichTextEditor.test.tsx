import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from './RichTextEditor';

// Tiptap uses browser APIs not available in jsdom — mock the editor
vi.mock('@tiptap/react', () => ({
  useEditor: () => null,
  EditorContent: ({ className }: { className?: string }) => <div data-testid="editor-content" className={className} />,
}));

vi.mock('@tiptap/starter-kit', () => ({ default: {} }));
vi.mock('@tiptap/extension-placeholder', () => ({ default: { configure: () => ({}) } }));
vi.mock('tiptap-markdown', () => ({ Markdown: {} }));

describe('RichTextEditor', () => {
  it('renders the toolbar buttons', () => {
    render(<RichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTitle('Bold')).toBeTruthy();
    expect(screen.getByTitle('Italic')).toBeTruthy();
    expect(screen.getByTitle('Heading 2')).toBeTruthy();
    expect(screen.getByTitle('Heading 3')).toBeTruthy();
    expect(screen.getByTitle('Bullet list')).toBeTruthy();
    expect(screen.getByTitle('Ordered list')).toBeTruthy();
    expect(screen.getByTitle('Blockquote')).toBeTruthy();
    expect(screen.getByTitle('Inline code')).toBeTruthy();
  });

  it('renders the editor content area', () => {
    render(<RichTextEditor value="" onChange={vi.fn()} />);
    expect(screen.getByTestId('editor-content')).toBeTruthy();
  });

  it('applies className to the wrapper', () => {
    const { container } = render(<RichTextEditor value="" onChange={vi.fn()} className="test-class" />);
    expect(container.firstElementChild?.classList.contains('test-class')).toBe(true);
  });
});
