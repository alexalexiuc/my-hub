'use client';

import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { cn } from '@/lib/utils';

export type MarkdownViewProps = {
  value: string;
  className?: string;
};

/** Replace literal \n escape sequences with real newlines (defensive for AI-generated content). */
function normalizeNewlines(s: string): string {
  return s.replace(/\\n/g, '\n');
}

export function MarkdownView({ value, className }: MarkdownViewProps) {
  const editor = useEditor({
    extensions: [StarterKit, Markdown],
    content: normalizeNewlines(value),
    editable: false,
    immediatelyRender: false,
  });

  return (
    <div className={cn('rte-content', className)}>
      <EditorContent editor={editor} />
    </div>
  );
}
