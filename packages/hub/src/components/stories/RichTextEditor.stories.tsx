import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { RichTextEditor } from '../RichTextEditor';

const meta: Meta<typeof RichTextEditor> = {
  title: 'Components/RichTextEditor',
  component: RichTextEditor,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof RichTextEditor>;

function Controlled({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return (
    <div className="travel-theme rounded-xl border border-[var(--border)] bg-[var(--card)] p-1">
      <RichTextEditor value={value} onChange={setValue} placeholder="Write something…" />
      <pre className="mt-3 rounded bg-zinc-900 p-2 text-xs text-zinc-400">{value || '(empty)'}</pre>
    </div>
  );
}

export const Empty: Story = {
  render: () => <Controlled />,
};

export const WithContent: Story = {
  render: () => (
    <Controlled
      initialValue={`## Day plan\n\nVisit the **old town** in the morning.\n\n- Buy tickets\n- Find a café\n- Walk the main square\n\n> Don't forget the umbrella!`}
    />
  ),
};
