import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldInfo } from './FieldInfo';
import { Field } from './Field';
import { Input } from './Input';

describe('FieldInfo', () => {
  it('hides the explanation until the trigger is clicked', () => {
    render(<FieldInfo label="Goal weight">Optional finish line.</FieldInfo>);

    expect(screen.queryByRole('tooltip')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'About Goal weight' }));

    expect(screen.getByRole('tooltip').textContent).toBe('Optional finish line.');
  });

  it('toggles closed on a second click', () => {
    render(<FieldInfo label="Goal weight">Optional finish line.</FieldInfo>);
    const trigger = screen.getByRole('button', { name: 'About Goal weight' });

    fireEvent.click(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeNull();

    fireEvent.click(trigger);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('reports open state and describes the trigger while open', () => {
    render(<FieldInfo label="Goal weight">Optional finish line.</FieldInfo>);
    const trigger = screen.getByRole('button', { name: 'About Goal weight' });

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-describedby')).toBeNull();

    fireEvent.click(trigger);

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id);
  });

  it.each([['Enter'], [' ']])('opens from the keyboard with %j', key => {
    render(<FieldInfo label="Goal weight">Optional finish line.</FieldInfo>);
    const trigger = screen.getByRole('button', { name: 'About Goal weight' });

    fireEvent.keyDown(trigger, { key });
    expect(screen.queryByRole('tooltip')).not.toBeNull();

    fireEvent.keyDown(trigger, { key });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('ignores other keys on the trigger', () => {
    render(<FieldInfo label="Goal weight">Optional finish line.</FieldInfo>);

    fireEvent.keyDown(screen.getByRole('button', { name: 'About Goal weight' }), { key: 'a' });

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('closes on Escape and returns focus to the trigger', () => {
    render(<FieldInfo label="Goal weight">Optional finish line.</FieldInfo>);
    const trigger = screen.getByRole('button', { name: 'About Goal weight' });

    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when pointing outside, but not when pointing at the panel', () => {
    render(
      <div>
        <FieldInfo label="Goal weight">Optional finish line.</FieldInfo>
        <span data-testid="outside">elsewhere</span>
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'About Goal weight' }));

    fireEvent.mouseDown(screen.getByRole('tooltip'));
    expect(screen.queryByRole('tooltip')).not.toBeNull();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('is keyboard reachable', () => {
    render(<FieldInfo label="Goal weight">Optional finish line.</FieldInfo>);

    expect(screen.getByRole('button', { name: 'About Goal weight' }).getAttribute('tabindex')).toBe('0');
  });
});

describe('Field with info', () => {
  it('renders no info trigger when info is omitted', () => {
    render(
      <Field label="Age">
        <Input />
      </Field>,
    );

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('renders the info trigger beside the label and reveals the explanation', () => {
    render(
      <Field label="Goal weight (kg)" info="Optional finish line.">
        <Input />
      </Field>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'About Goal weight (kg)' }));

    expect(screen.getByRole('tooltip').textContent).toBe('Optional finish line.');
  });

  it('keeps the wrapping label pointing at its control rather than the info trigger', () => {
    // A real <button> here would become the <label>'s labeled control and steal the input's
    // accessible name; the trigger is a span with role="button" precisely to avoid that.
    render(
      <Field label="Goal weight (kg)" info="Optional finish line.">
        <Input />
      </Field>,
    );

    expect(screen.getByRole('button', { name: 'About Goal weight (kg)' }).tagName).toBe('SPAN');
    expect(screen.getByLabelText('Goal weight (kg)').tagName).toBe('INPUT');
  });

  it('does not activate the labelled control when the info trigger is clicked', () => {
    render(
      <Field label="Eat more greens" info="Toggles the reminder.">
        <input type="checkbox" />
      </Field>,
    );

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'About Eat more greens' }));

    expect(checkbox.checked).toBe(false);
    expect(screen.queryByRole('tooltip')).not.toBeNull();
  });
});
