'use client';

import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';
import { Markdown } from 'tiptap-markdown';
import { cn } from '@/lib/utils';

/** Replace literal \n escape sequences with real newlines (defensive for AI-generated content). */
function normalizeNewlines(s: string): string {
  return s.replace(/\\n/g, '\n');
}

export type RichTextEditorProps = {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
};

export function RichTextEditor({ value, onChange, placeholder, className, minHeight = 160 }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown, Placeholder.configure({ placeholder: placeholder ?? '' })],
    content: normalizeNewlines(value),
    onUpdate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange((editor.storage as any).markdown.getMarkdown());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const normalized = normalizeNewlines(value);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = (editor.storage as any).markdown.getMarkdown();
    if (current !== normalized) {
      editor.commands.setContent(normalized);
    }
  }, [value]);

  const toolBtn = (active: boolean) =>
    cn(
      'flex h-6 min-w-[1.5rem] items-center justify-center rounded px-1 text-[11px] font-medium transition',
      active
        ? 'bg-[var(--accent-d)] text-[var(--accent)]'
        : 'text-[var(--muted)] hover:bg-[var(--card3)] hover:text-[var(--text)]',
    );

  return (
    <div className={cn('rich-text-editor flex flex-col', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--border)] px-1.5 py-1">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={toolBtn(!!editor?.isActive('bold'))}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={toolBtn(!!editor?.isActive('italic'))}
          title="Italic"
        >
          <em>I</em>
        </button>
        <div className="mx-1 h-4 w-px bg-[var(--border)]" />
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className={toolBtn(!!editor?.isActive('heading', { level: 2 }))}
          title="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          className={toolBtn(!!editor?.isActive('heading', { level: 3 }))}
          title="Heading 3"
        >
          H3
        </button>
        <div className="mx-1 h-4 w-px bg-[var(--border)]" />
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={toolBtn(!!editor?.isActive('bulletList'))}
          title="Bullet list"
        >
          •–
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={toolBtn(!!editor?.isActive('orderedList'))}
          title="Ordered list"
        >
          1.
        </button>
        <div className="mx-1 h-4 w-px bg-[var(--border)]" />
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          className={toolBtn(!!editor?.isActive('blockquote'))}
          title="Blockquote"
        >
          ❝
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleCode().run()}
          className={toolBtn(!!editor?.isActive('code'))}
          title="Inline code"
        >
          {'<>'}
        </button>
        <div className="mx-1 h-4 w-px bg-[var(--border)]" />
        <button
          type="button"
          onClick={() => editor?.chain().focus().undo().run()}
          disabled={!editor?.can().undo()}
          className={cn(toolBtn(false), 'disabled:opacity-30')}
          title="Undo"
        >
          ↩
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().redo().run()}
          disabled={!editor?.can().redo()}
          className={cn(toolBtn(false), 'disabled:opacity-30')}
          title="Redo"
        >
          ↪
        </button>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        style={{ minHeight }}
        className="rte-content cursor-text p-2.5 text-[13px] text-[var(--text)] focus-within:outline-none"
        onClick={() => editor?.commands.focus()}
      />
    </div>
  );
}
