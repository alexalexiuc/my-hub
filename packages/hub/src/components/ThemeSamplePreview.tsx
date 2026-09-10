import { Button } from './Button';
import { Checkbox } from './Checkbox';
import { Input } from './Input';
import { ProgressBar } from './ProgressBar';
import { SectionCard } from './SectionCard';

// Tailwind only detects complete, literal class strings at build time. Assembling a class name
// from a runtime token via a template literal never reaches the generated CSS — and writing that
// exact shape out even in a comment can trip Tailwind's build-time source scanner, since it
// inspects raw text rather than parsed JS and doesn't know it's reading a comment. So each
// badge's classes below are spelled out individually instead of built from a token name.
const BADGES = [
  { label: 'Booked', className: 'bg-[var(--green-d)] text-[var(--green)]' },
  { label: 'Flights', className: 'bg-[var(--blue-d)] text-[var(--blue)]' },
  { label: 'Overdue', className: 'bg-[var(--red-d)] text-[var(--red)]' },
  { label: 'Pending', className: 'bg-[var(--amber-d)] text-[var(--amber)]' },
] as const;

/**
 * A fixed slice of real, already-themed components — not a mockup — so a theme can be judged by
 * how it actually renders: heading/body/caption text, a card, a ghost input, every button
 * variant, semantic status badges, a checkbox, and a progress bar.
 */
export function ThemeSamplePreview() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-[var(--text)]">Trip to Lisbon</h3>
        <p className="text-sm text-[var(--muted)]">4 nights · 2 travellers · €1,240 budget</p>
        <p className="text-xs text-[var(--subtle)]">Last updated 2 hours ago</p>
      </div>

      <SectionCard className="space-y-4">
        <ProgressBar value={62} max={100} />

        <div className="flex flex-wrap gap-2">
          {BADGES.map(({ label, className }) => (
            <span key={label} className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${className}`}>
              {label}
            </span>
          ))}
        </div>

        <Input variant="ghost" placeholder="Add a note…" readOnly />

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm">
            Save changes
          </Button>
          <Button variant="secondary" size="sm">
            Cancel
          </Button>
          <Button variant="danger" size="sm">
            Delete
          </Button>
          <Button variant="ghost" size="sm">
            Skip
          </Button>
          <label className="ml-1 flex items-center gap-1.5 text-xs text-[var(--muted)]">
            <Checkbox className="accent-[var(--accent)]" defaultChecked />
            Remind me
          </label>
        </div>
      </SectionCard>
    </div>
  );
}
