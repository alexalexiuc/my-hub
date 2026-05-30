'use client';

import { FinModalShell } from '../FinModalShell';
import { fmt } from '../ui';
import type { TransactionDetails, ReceiptTransactionDetails } from '@my-hub/shared/types';

type TransactionExtrasModalProps = {
  extras: TransactionDetails;
  currency: string;
  onClose: () => void;
};

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5 text-[13px]">
      <span className="w-[140px] shrink-0 text-[var(--fin-muted)]">{label}</span>
      <span className="flex-1 text-[var(--fin-text)] break-words">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--fin-subtle)]">{title}</div>
      <div className="rounded-[10px] border border-[var(--fin-border)] bg-[var(--fin-card2)] px-3 divide-y divide-[var(--fin-border)]">
        {children}
      </div>
    </div>
  );
}

export function TransactionExtrasModal({ extras, currency, onClose }: TransactionExtrasModalProps) {
  const isReceipt = extras.kind === 'receipt';
  const receipt = isReceipt ? (extras as ReceiptTransactionDetails) : null;

  const hasBase =
    extras.source || extras.rawInput || extras.cardHint || extras.autofillConfidence != null || extras.time != null;
  const hasExtra = extras.extra != null && Object.keys(extras.extra).length > 0;
  const hasConversion = extras.conversion && Object.keys(extras.conversion).length > 0;
  const hasReceiptMeta =
    receipt &&
    (receipt.payeeAddress ||
      receipt.receiptNumber ||
      receipt.taxAmount != null ||
      receipt.tipAmount != null ||
      receipt.discountAmount != null);
  const hasItems = receipt?.items && receipt.items.length > 0;

  return (
    <FinModalShell title="Transaction extras" onClose={onClose} className="md:max-w-[460px]">
      {hasBase && (
        <Section title="Source">
          {extras.source && <Row label="Channel" value={extras.source} />}
          {extras.cardHint && <Row label="Card hint" value={extras.cardHint} />}
          {extras.time != null && <Row label="Time" value={extras.time} />}
          {extras.autofillConfidence != null && (
            <Row label="AI confidence" value={`${Math.round(extras.autofillConfidence * 100)}%`} />
          )}
          {extras.rawInput && (
            <Row
              label="Raw input"
              value={
                <span className="block max-h-[120px] overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--fin-subtle)]">
                  {extras.rawInput}
                </span>
              }
            />
          )}
        </Section>
      )}

      {hasConversion && extras.conversion && (
        <Section title="Currency conversion">
          {extras.conversion.originalAmount != null && extras.conversion.originalCurrency && (
            <Row
              label="Original amount"
              value={`${extras.conversion.originalAmount.toFixed(2)} ${extras.conversion.originalCurrency}`}
            />
          )}
          {extras.conversion.accountCurrency && (
            <Row label="Account currency" value={extras.conversion.accountCurrency} />
          )}
          {extras.conversion.originalToAccountRate != null && (
            <Row label="FX rate" value={extras.conversion.originalToAccountRate.toFixed(6)} />
          )}
          {extras.conversion.convertedAmount != null && (
            <Row label="Converted amount" value={fmt(extras.conversion.convertedAmount, currency)} />
          )}
        </Section>
      )}

      {hasReceiptMeta && receipt && (
        <Section title="Receipt">
          {receipt.payeeAddress && <Row label="Address" value={receipt.payeeAddress} />}
          {receipt.receiptNumber && <Row label="Receipt #" value={receipt.receiptNumber} />}
          {receipt.taxAmount != null && <Row label="Tax" value={fmt(receipt.taxAmount, currency)} />}
          {receipt.tipAmount != null && <Row label="Tip" value={fmt(receipt.tipAmount, currency)} />}
          {receipt.discountAmount != null && <Row label="Discount" value={fmt(receipt.discountAmount, currency)} />}
        </Section>
      )}

      {hasItems && receipt?.items && (
        <Section title="Line items">
          {receipt.items.map((item, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5 text-[13px]">
              <span className="flex-1 text-[var(--fin-text)]">
                {item.quantity != null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''} × ` : ''}
                {item.name}
              </span>
              {item.totalPrice != null && (
                <span className="shrink-0 tabular-nums text-[var(--fin-muted)]">{fmt(item.totalPrice, currency)}</span>
              )}
            </div>
          ))}
        </Section>
      )}

      {hasExtra && extras.extra && (
        <Section title="Extra">
          {Object.entries(extras.extra).map(([key, value]) => (
            <Row
              key={key}
              label={key}
              value={typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value ?? '')}
            />
          ))}
        </Section>
      )}
    </FinModalShell>
  );
}
