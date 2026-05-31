'use client';

import { Button } from '@/components';
import type { DropdownOption } from '../../FinancialDropdown';
import { PayeeMappingPanel } from './PayeeMappingPanel';
import { CategoryMappingPanel } from './CategoryMappingPanel';
import { TransactionPreviewTable } from './TransactionPreviewTable';
import type { ImportRow, ColumnMap, PayeeMapping, CategoryMapping } from './types';

export type PreviewStepProps = {
  importRows: ImportRow[];
  payeeMappings: Map<string, PayeeMapping>;
  categoryMappings: Map<string, CategoryMapping>;
  colMap: ColumnMap;
  currency: string;
  accountOptions: DropdownOption[];
  categoryOptions: DropdownOption[];
  payeeOptions: DropdownOption[];
  accounts: Array<{ id: number; currency: string }>;
  onUpdateRow: (key: string, patch: Partial<ImportRow>) => void;
  onUpdatePayeeMapping: (csvValue: string, patch: Partial<PayeeMapping>) => void;
  onUpdateCategoryMapping: (csvValue: string, categoryId: number | null) => void;
  onBack: () => void;
  onNext: () => void;
};

export function PreviewStep({
  importRows,
  payeeMappings,
  categoryMappings,
  colMap,
  currency,
  accountOptions,
  categoryOptions,
  payeeOptions,
  accounts,
  onUpdateRow,
  onUpdatePayeeMapping,
  onUpdateCategoryMapping,
  onBack,
  onNext,
}: PreviewStepProps) {
  const uniquePayeeValues = Array.from(
    new Set(importRows.filter(r => !r.ignored && r.rawPayeeName).map(r => r.rawPayeeName)),
  );

  const uniqueCategoryValues = Array.from(
    new Set(importRows.filter(r => !r.ignored && r.rawCategoryName).map(r => r.rawCategoryName)),
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="text-[13px] text-[var(--muted)]">
        {importRows.length} rows · {currency}
      </div>

      {/* Side-by-side: mapping panels left, transaction table right */}
      <div className="flex gap-4 items-start">
        {uniquePayeeValues.length > 0 && (
          <PayeeMappingPanel
            uniquePayeeValues={uniquePayeeValues}
            payeeMappings={payeeMappings}
            payeeOptions={payeeOptions}
            categoryOptions={categoryOptions}
            showCategoryDropdown={!colMap.categoryCol}
            onUpdateMapping={onUpdatePayeeMapping}
          />
        )}

        {uniqueCategoryValues.length > 0 && (
          <CategoryMappingPanel
            uniqueCategoryValues={uniqueCategoryValues}
            categoryMappings={categoryMappings}
            categoryOptions={categoryOptions}
            onUpdateMapping={onUpdateCategoryMapping}
          />
        )}

        <TransactionPreviewTable
          importRows={importRows}
          colMap={colMap}
          currency={currency}
          accountOptions={accountOptions}
          categoryOptions={categoryOptions}
          accounts={accounts}
          onUpdateRow={onUpdateRow}
        />
      </div>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <Button onClick={onNext}>Review →</Button>
      </div>
    </div>
  );
}
