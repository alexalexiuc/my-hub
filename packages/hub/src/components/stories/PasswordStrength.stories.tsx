import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { PasswordStrength } from '../PasswordStrength';

const meta: Meta<typeof PasswordStrength> = {
  title: 'Components/PasswordStrength',
  component: PasswordStrength,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PasswordStrength>;

export const Empty: Story = {
  args: { password: '' },
};

export const Weak: Story = {
  args: { password: 'abc' },
};

export const Strong: Story = {
  args: { password: 'MyStr0ng!Pass' },
};

export const WithConfirmMatch: Story = {
  args: { password: 'MyStr0ng!Pass', confirm: 'MyStr0ng!Pass' },
};

export const WithConfirmMismatch: Story = {
  args: { password: 'MyStr0ng!Pass', confirm: 'different' },
};

export const Interactive: Story = {
  render: () => {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    return (
      <div className="space-y-3 max-w-sm">
        <input
          className="input"
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
        />
        <input
          className="input"
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
        />
        <PasswordStrength password={password} confirm={confirm} />
      </div>
    );
  },
};
