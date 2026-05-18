'use client';

import { forwardRef, useState } from 'react';
import { Input } from './Input';
import { IconButton } from './IconButton';
import { EyeOutlineIcon } from './icons/EyeOutlineIcon';
import { EyeOffOutlineIcon } from './icons/EyeOffOutlineIcon';

type PasswordInputProps = Omit<React.ComponentPropsWithoutRef<'input'>, 'type'>;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input ref={ref} type={visible ? 'text' : 'password'} className="pr-10" {...props} />
      <IconButton
        variant="ghost"
        label={visible ? 'Hide password' : 'Show password'}
        icon={visible ? <EyeOffOutlineIcon /> : <EyeOutlineIcon />}
        onClick={() => setVisible(v => !v)}
        className="absolute inset-y-0 right-0 px-3"
      />
    </div>
  );
});
