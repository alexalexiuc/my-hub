import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { MultiButtonGroup } from '../MultiButtonGroup';

const options = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
] as const;

type Option = (typeof options)[number]['value'];

function Controlled() {
  const [value, setValue] = useState<Option>('week');
  return <MultiButtonGroup options={[...options]} value={value} onChange={v => setValue(v as Option)} />;
}

const meta: Meta<typeof MultiButtonGroup> = {
  title: 'Components/MultiButtonGroup',
  component: MultiButtonGroup,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MultiButtonGroup>;

export const Default: Story = {
  render: () => <Controlled />,
};

export const TwoOptions: Story = {
  render: () => {
    const [value, setValue] = useState('on');
    return (
      <MultiButtonGroup
        options={[
          { label: 'On', value: 'on' },
          { label: 'Off', value: 'off' },
        ]}
        value={value}
        onChange={setValue}
      />
    );
  },
};

export const FixedWidth: Story = {
  render: () => {
    const [value, setValue] = useState('week');
    return <MultiButtonGroup options={[...options]} value={value} onChange={v => setValue(v as Option)} width={240} />;
  },
};
