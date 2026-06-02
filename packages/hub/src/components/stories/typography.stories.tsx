import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Divider, SectionLabel, SubText } from '../typography';

const meta: Meta = {
  title: 'Components/Typography',
  tags: ['autodocs'],
};

export default meta;

export const All: StoryObj = {
  render: () => (
    <div className="flex w-64 flex-col gap-2 p-4">
      <SectionLabel>Section heading</SectionLabel>
      <SubText>Muted 11px text</SubText>
      <Divider />
      <SubText>Another sub-text after divider</SubText>
    </div>
  ),
};

export const DividerStory: StoryObj = {
  name: 'Divider',
  render: () => (
    <div className="w-64 p-4">
      <Divider />
    </div>
  ),
};

export const SectionLabelStory: StoryObj = {
  name: 'SectionLabel',
  render: () => <SectionLabel>My Section</SectionLabel>,
};

export const SubTextStory: StoryObj = {
  name: 'SubText',
  render: () => <SubText>Muted helper text</SubText>,
};
