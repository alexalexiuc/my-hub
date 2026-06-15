'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/utils';
import type { PayeesResponse, PayeeWithSuggestion } from '@/app/api/finances/payees/route';
import { TransactionList } from '../../transactions/TransactionList';
import { EditPayeeModal } from '../EditPayeeModal';
import { PayeeSummarySection } from './PayeeSummarySection';
import { Button, Card, SectionLabel, SubText } from '@/components';

export default function PayeeDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const payeeId = Number(params.id);

  const [payee, setPayee] = useState<PayeeWithSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (Number.isNaN(payeeId) || payeeId <= 0) {
      router.replace('/finances/payees');
      return;
    }

    setLoading(true);
    apiFetch<PayeesResponse>('/api/finances/payees', { silentToast: true })
      .then(result => {
        const found = result.payees.find(p => p.id === payeeId);
        if (!found) {
          router.replace('/finances/payees');
          return;
        }
        setPayee(found);
      })
      .finally(() => setLoading(false));
  }, [payeeId, router]);

  if (loading) {
    return (
      <div className="flex flex-col gap-[14px]">
        {[40, 100, 280].map((h, i) => (
          <div
            key={i}
            className="rounded-[10px] border border-[var(--border)] bg-[var(--card)]"
            style={{ height: h, opacity: 0.6 }}
          />
        ))}
      </div>
    );
  }

  if (!payee) return null;

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex items-center gap-2.5">
        <Button variant="ghost" size="sm" onClick={() => router.push('/finances/payees')}>
          ← Back
        </Button>
      </div>

      <Card className="p-[14px]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div>
              <div className="text-[17px] font-bold text-[var(--text)]">{payee.name}</div>
              {payee.description && <SubText className="block">{payee.description}</SubText>}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </div>

        {payee.aliases.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {payee.aliases.map(alias => (
              <span
                key={alias}
                className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-[12px] text-[var(--muted)]"
              >
                {alias}
              </span>
            ))}
          </div>
        )}
      </Card>

      <PayeeSummarySection payeeId={payeeId} />

      <Card className="p-0 md:p-[14px]">
        <SectionLabel className="mb-2.5 mt-[14px] px-[14px] md:mt-0 md:px-0">Transactions</SectionLabel>
        <TransactionList payeeId={payeeId} />
      </Card>

      {editOpen && (
        <EditPayeeModal
          payee={payee}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            apiFetch<PayeesResponse>('/api/finances/payees', { silentToast: true }).then(result => {
              const found = result.payees.find(p => p.id === payeeId);
              if (found) setPayee(found);
            });
          }}
        />
      )}
    </div>
  );
}
