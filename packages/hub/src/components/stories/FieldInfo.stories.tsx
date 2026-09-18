import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FieldInfo } from '../FieldInfo';
import { Field } from '../Field';
import { Input } from '../Input';

const meta: Meta<typeof FieldInfo> = {
  title: 'Components/FieldInfo',
  component: FieldInfo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FieldInfo>;

export const Default: Story = {
  args: {
    label: 'Goal weight',
    children: 'Optional finish line. With one, the Progress card estimates a finish date.',
  },
  render: args => (
    <p className="text-xs text-zinc-400">
      Goal weight (kg) <FieldInfo {...args} />
    </p>
  ),
};

/** The usual way to reach it — pass `info` to a `Field` and it renders beside the label. */
export const InsideAField: Story = {
  render: () => (
    <div className="max-w-[320px]">
      <Field
        label="Goal weight (kg)"
        info="Optional finish line. With one, the Progress card shows how far through the run you are and estimates a finish date from the rate you are actually achieving. Leave it blank to track the rate alone."
      >
        <Input type="number" placeholder="Optional" />
      </Field>
    </div>
  ),
};

/** The explanation may be rich content, not only a string. */
export const WithRichContent: Story = {
  render: () => (
    <div className="max-w-[320px]">
      <Field
        label="Max calories/day"
        info={
          <>
            A ceiling for the daily target.
            <br />
            It is also the total that macro percentages are worked out against, so <strong>%</strong> mode needs it.
          </>
        }
      >
        <Input type="number" placeholder="Optional" />
      </Field>
    </div>
  ),
};

/** Several in a row, to check the icons do not crowd the labels. */
export const InAForm: Story = {
  render: () => (
    <div className="grid max-w-[420px] grid-cols-2 gap-3">
      <Field label="Rate (kg/week)" info="How fast you intend to move. This sets the size of the daily deficit.">
        <Input type="number" placeholder="e.g. 0.5" />
      </Field>
      <Field label="Goal weight (kg)" info="Optional finish line — unlocks progress and an estimated finish date.">
        <Input type="number" placeholder="Optional" />
      </Field>
      <Field label="Min calories/day" info="A floor the calculated target will not drop below.">
        <Input type="number" placeholder="Optional" />
      </Field>
      <Field label="Max calories/day" info="A ceiling for the daily target.">
        <Input type="number" placeholder="Optional" />
      </Field>
    </div>
  ),
};
