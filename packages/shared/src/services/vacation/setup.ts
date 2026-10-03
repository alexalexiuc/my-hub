/**
 * Vacation configuration writes: profile, rule sets, tax regimes, salaries, holidays and leave.
 * Every call validates the resulting state first and then writes in one transaction, so a bad
 * call changes nothing.
 *
 * Exports:
 *   applyVacationSetup   — bulk upsert/remove across the configuration sections; returns change counts
 *   applyLeaveChanges    — upsert/remove leave periods (no two may overlap); returns change counts
 *   Types: VacationProfileUpsert, VacationRuleSetUpsert, VacationTaxRegimeUpsert, VacationSalaryUpsert,
 *          VacationHolidayUpsert, VacationHolidayKey, VacationLeaveUpsert, VacationSetupChanges,
 *          VacationLeaveChanges, VacationChangeCounts, VacationSetupSummary
 */
import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  vacationHolidays,
  vacationLeavePeriods,
  vacationProfiles,
  vacationRuleSets,
  vacationSalaryMonths,
  vacationTaxRegimes,
} from '../../db/schema/vacation';
import {
  DEFAULT_TAX_RATES,
  type HolidayKind,
  type HolidaySource,
  type LeaveStatus,
  type LeaveUnit,
  type RateBasis,
  type RuleSetStatus,
  type SalaryKind,
  type TaxRegimeKind,
} from '../../constants/vacation';
import { omitUndefined } from '../../utils/objects';
import { isIsoDateStr } from '../../utils/dates';
import { vacationHorizonError } from '../../utils/vacation';
import { VacationValidationError } from './data';

export interface VacationProfileUpsert {
  country?: string;
  region?: string | null;
  employer?: string;
  openingBalanceDays?: number;
  openingBalanceDate?: string;
  accrualStart?: string | null;
  /** Gross monthly base for months with no salary row and no earlier projection; null carries the latest actual row forward. */
  baseSalaryMdl?: number | null;
}

export interface VacationRuleSetUpsert {
  /** Omit to create; pass to overwrite that rule set. */
  id?: number;
  name: string;
  country: string;
  region?: string | null;
  validFrom: string;
  validTo?: string | null;
  leaveUnit: LeaveUnit;
  annualEntitlementDays: number;
  avgWindowMonths?: number;
  rateBasis: RateBasis;
  raiseResetsWindow?: boolean;
  status: RuleSetStatus;
  notes?: string | null;
}

export interface VacationTaxRegimeUpsert {
  id?: number;
  employer: string;
  regime: TaxRegimeKind;
  /** Defaults to the regime's MD rate (AOAM 9% standard, 0 IT Park). */
  medicalRate?: number;
  /** Defaults to the regime's MD rate (12% standard, 0 IT Park). */
  incomeTaxRate?: number;
  validFrom: string;
  validTo?: string | null;
}

export interface VacationSalaryUpsert {
  /** YYYY-MM the salary was earned in. */
  month: string;
  baseMdl: number;
  extraMdl?: number;
  kind: SalaryKind;
  notes?: string | null;
}

export interface VacationHolidayKey {
  date: string;
  country: string;
  /** Locality for a hram day; omit or null for a national holiday. */
  region?: string | null;
}

export interface VacationHolidayUpsert extends VacationHolidayKey {
  kind: HolidayKind;
  name: string;
  source?: HolidaySource;
}

export interface VacationLeaveUpsert {
  id?: number;
  startDate: string;
  endDate: string;
  status: LeaveStatus;
  payReceivedMdl?: number | null;
  notes?: string | null;
}

interface Section<U, K> {
  upsert?: U[];
  remove?: K[];
}

export interface VacationSetupChanges {
  profile?: VacationProfileUpsert;
  ruleSets?: Section<VacationRuleSetUpsert, number>;
  taxRegimes?: Section<VacationTaxRegimeUpsert, number>;
  salaries?: Section<VacationSalaryUpsert, string>;
  holidays?: Section<VacationHolidayUpsert, VacationHolidayKey>;
}

export interface VacationLeaveChanges {
  upsert?: VacationLeaveUpsert[];
  remove?: number[];
}

export interface VacationChangeCounts {
  upserted: number;
  removed: number;
}

export interface VacationSetupSummary {
  profile: 'created' | 'updated' | 'unchanged';
  ruleSets: VacationChangeCounts;
  taxRegimes: VacationChangeCounts;
  salaries: VacationChangeCounts;
  holidays: VacationChangeCounts;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

type Range = { validFrom: string; validTo: string | null };
const overlaps = (a: Range, b: Range) =>
  a.validFrom <= (b.validTo ?? '9999-12-31') && b.validFrom <= (a.validTo ?? '9999-12-31');

function assertDate(value: string, label: string) {
  if (!isIsoDateStr(value)) {
    throw new VacationValidationError(`${label} must be a YYYY-MM-DD date, got "${value}".`);
  }
}

function assertRange(r: Range, label: string) {
  assertDate(r.validFrom, `${label} validFrom`);
  if (r.validTo !== null) {
    assertDate(r.validTo, `${label} validTo`);
    if (r.validTo < r.validFrom)
      throw new VacationValidationError(`${label}: validTo ${r.validTo} is before validFrom ${r.validFrom}.`);
  }
}

/**
 * Applies upserts and removals to existing rows by id and returns the resulting set, for
 * validation before anything is written.
 */
function mergeById<T extends { id: number }, U extends { id?: number }>(
  existing: T[],
  section: Section<U, number> | undefined,
  label: string,
): (U | T)[] {
  const ids = new Set(existing.map(r => r.id));
  for (const id of [
    ...(section?.remove ?? []),
    ...(section?.upsert ?? []).flatMap(u => (u.id === undefined ? [] : [u.id])),
  ]) {
    if (!ids.has(id)) throw new VacationValidationError(`${label} ${id} does not exist.`);
  }
  const removed = new Set(section?.remove ?? []);
  const replaced = new Map((section?.upsert ?? []).filter(u => u.id !== undefined).map(u => [u.id!, u]));
  const kept: (U | T)[] = existing.filter(r => !removed.has(r.id)).map(r => replaced.get(r.id) ?? r);
  return [...kept, ...(section?.upsert ?? []).filter(u => u.id === undefined)];
}

function assertNoOverlap<T extends Range>(
  rows: T[],
  scope: (r: T) => string,
  describe: (r: T) => string,
  label: string,
) {
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]!;
      const b = rows[j]!;
      if (scope(a) === scope(b) && overlaps(a, b)) {
        throw new VacationValidationError(`${label} overlap: ${describe(a)} and ${describe(b)}.`);
      }
    }
  }
}

const ruleRange = (r: { validFrom: string; validTo?: string | null }): Range => ({
  validFrom: r.validFrom,
  validTo: r.validTo ?? null,
});

/**
 * Bulk upsert/remove of vacation configuration. Natural keys: rule sets and tax regimes by id
 * (omit to create), salaries by month, holidays by date + country + region. Rule sets may not
 * overlap within the same country, region and status (an active law and a draft may overlap);
 * tax regimes may not overlap for the same employer.
 */
export async function applyVacationSetup(userId: string, changes: VacationSetupChanges): Promise<VacationSetupSummary> {
  const existingProfile = await db.query.vacationProfiles.findFirst({ where: eq(vacationProfiles.userId, userId) });
  const [existingRules, existingRegimes] = await Promise.all([
    db.select().from(vacationRuleSets).where(eq(vacationRuleSets.userId, userId)),
    db.select().from(vacationTaxRegimes).where(eq(vacationTaxRegimes.userId, userId)),
  ]);

  // ---- Validate ----
  const { profile } = changes;
  if (profile) {
    if (!existingProfile) {
      for (const key of ['country', 'employer', 'openingBalanceDays', 'openingBalanceDate'] as const) {
        if (profile[key] === undefined)
          throw new VacationValidationError(`profile.${key} is required when creating the profile.`);
      }
    }
    if (profile.openingBalanceDate !== undefined) assertDate(profile.openingBalanceDate, 'profile.openingBalanceDate');
    if (profile.accrualStart) assertDate(profile.accrualStart, 'profile.accrualStart');
    if (profile.baseSalaryMdl != null && profile.baseSalaryMdl < 0)
      throw new VacationValidationError('profile.baseSalaryMdl cannot be negative.');
  }

  for (const r of changes.ruleSets?.upsert ?? []) {
    assertRange(ruleRange(r), `Rule set "${r.name}"`);
    if (r.annualEntitlementDays <= 0)
      throw new VacationValidationError(`Rule set "${r.name}": annualEntitlementDays must be positive.`);
    if (r.avgWindowMonths !== undefined && (r.avgWindowMonths < 1 || r.avgWindowMonths > 12)) {
      throw new VacationValidationError(`Rule set "${r.name}": avgWindowMonths must be 1–12.`);
    }
  }
  const rules = mergeById(existingRules, changes.ruleSets, 'Rule set');
  assertNoOverlap(
    rules.map(r => ({ ...r, ...ruleRange(r) })),
    r => `${r.country.toUpperCase()}|${(r.region ?? '').toLowerCase()}|${r.status}`,
    r => `"${r.name}" (${r.validFrom}–${r.validTo ?? 'open'})`,
    'Rule set',
  );

  for (const t of changes.taxRegimes?.upsert ?? []) assertRange(ruleRange(t), `Tax regime ${t.regime}`);
  const regimes = mergeById(existingRegimes, changes.taxRegimes, 'Tax regime');
  assertNoOverlap(
    regimes.map(t => ({ ...t, ...ruleRange(t) })),
    t => t.employer.toLowerCase(),
    t => `${t.employer} ${t.regime} (${t.validFrom}–${t.validTo ?? 'open'})`,
    'Tax regime',
  );

  for (const s of changes.salaries?.upsert ?? []) {
    if (!MONTH_RE.test(s.month)) throw new VacationValidationError(`Salary month must be YYYY-MM, got "${s.month}".`);
    if (s.baseMdl < 0 || (s.extraMdl ?? 0) < 0)
      throw new VacationValidationError(`Salary for ${s.month} cannot be negative.`);
  }
  for (const m of changes.salaries?.remove ?? []) {
    if (!MONTH_RE.test(m)) throw new VacationValidationError(`Salary month must be YYYY-MM, got "${m}".`);
  }
  for (const h of [...(changes.holidays?.upsert ?? []), ...(changes.holidays?.remove ?? [])])
    assertDate(h.date, 'Holiday date');

  // ---- Write ----
  return db.transaction(async tx => {
    let profileResult: VacationSetupSummary['profile'] = 'unchanged';
    if (profile) {
      const values = omitUndefined({ ...profile, country: profile.country?.toUpperCase(), updatedAt: new Date() });
      if (existingProfile) {
        await tx.update(vacationProfiles).set(values).where(eq(vacationProfiles.userId, userId));
        profileResult = 'updated';
      } else {
        await tx.insert(vacationProfiles).values({
          userId,
          country: profile.country!.toUpperCase(),
          region: profile.region ?? null,
          employer: profile.employer!,
          openingBalanceDays: profile.openingBalanceDays!,
          openingBalanceDate: profile.openingBalanceDate!,
          accrualStart: profile.accrualStart ?? null,
          baseSalaryMdl: profile.baseSalaryMdl ?? null,
        });
        profileResult = 'created';
      }
    }

    const ruleRemove = changes.ruleSets?.remove ?? [];
    if (ruleRemove.length) {
      await tx
        .delete(vacationRuleSets)
        .where(and(eq(vacationRuleSets.userId, userId), inArray(vacationRuleSets.id, ruleRemove)));
    }
    for (const { id, ...r } of changes.ruleSets?.upsert ?? []) {
      const values = {
        ...r,
        country: r.country.toUpperCase(),
        region: r.region ?? null,
        validTo: r.validTo ?? null,
        avgWindowMonths: r.avgWindowMonths ?? 3,
        raiseResetsWindow: r.raiseResetsWindow ?? true,
        notes: r.notes ?? null,
      };
      if (id === undefined) await tx.insert(vacationRuleSets).values({ userId, ...values });
      else
        await tx
          .update(vacationRuleSets)
          .set(values)
          .where(and(eq(vacationRuleSets.userId, userId), eq(vacationRuleSets.id, id)));
    }

    const regimeRemove = changes.taxRegimes?.remove ?? [];
    if (regimeRemove.length) {
      await tx
        .delete(vacationTaxRegimes)
        .where(and(eq(vacationTaxRegimes.userId, userId), inArray(vacationTaxRegimes.id, regimeRemove)));
    }
    for (const { id, ...t } of changes.taxRegimes?.upsert ?? []) {
      const values = {
        ...t,
        validTo: t.validTo ?? null,
        medicalRate: t.medicalRate ?? DEFAULT_TAX_RATES[t.regime].medicalRate,
        incomeTaxRate: t.incomeTaxRate ?? DEFAULT_TAX_RATES[t.regime].incomeTaxRate,
      };
      if (id === undefined) await tx.insert(vacationTaxRegimes).values({ userId, ...values });
      else
        await tx
          .update(vacationTaxRegimes)
          .set(values)
          .where(and(eq(vacationTaxRegimes.userId, userId), eq(vacationTaxRegimes.id, id)));
    }

    const salaryRemove = (changes.salaries?.remove ?? []).map(m => `${m}-01`);
    if (salaryRemove.length) {
      await tx
        .delete(vacationSalaryMonths)
        .where(and(eq(vacationSalaryMonths.userId, userId), inArray(vacationSalaryMonths.month, salaryRemove)));
    }
    // Last entry wins for a key repeated within one call: a multi-row upsert may not touch a row twice.
    const salaryRows = [
      ...new Map(
        (changes.salaries?.upsert ?? []).map(s => [
          s.month,
          {
            userId,
            month: `${s.month}-01`,
            baseMdl: s.baseMdl,
            extraMdl: s.extraMdl ?? 0,
            kind: s.kind,
            notes: s.notes ?? null,
            updatedAt: new Date(),
          },
        ]),
      ).values(),
    ];
    if (salaryRows.length) {
      await tx
        .insert(vacationSalaryMonths)
        .values(salaryRows)
        .onConflictDoUpdate({
          target: [vacationSalaryMonths.userId, vacationSalaryMonths.month],
          set: {
            baseMdl: sql`excluded.base_mdl`,
            extraMdl: sql`excluded.extra_mdl`,
            kind: sql`excluded.kind`,
            notes: sql`excluded.notes`,
            updatedAt: sql`excluded.updated_at`,
          },
        });
    }

    const holidayRemove = changes.holidays?.remove ?? [];
    let holidaysRemoved = 0;
    if (holidayRemove.length) {
      const rows = await tx
        .delete(vacationHolidays)
        .where(
          and(
            eq(vacationHolidays.userId, userId),
            or(
              ...holidayRemove.map(h =>
                and(
                  eq(vacationHolidays.date, h.date),
                  eq(vacationHolidays.country, h.country.toUpperCase()),
                  eq(vacationHolidays.region, h.region ?? ''),
                ),
              ),
            ),
          ),
        )
        .returning({ id: vacationHolidays.id });
      holidaysRemoved = rows.length;
    }
    const holidayRows = [
      ...new Map(
        (changes.holidays?.upsert ?? []).map(h => {
          const row = {
            userId,
            date: h.date,
            country: h.country.toUpperCase(),
            region: h.region ?? '',
            kind: h.kind,
            name: h.name,
            source: h.source ?? ('research' as const),
          };
          return [`${row.date}|${row.country}|${row.region}`, row];
        }),
      ).values(),
    ];
    if (holidayRows.length) {
      await tx
        .insert(vacationHolidays)
        .values(holidayRows)
        .onConflictDoUpdate({
          target: [vacationHolidays.userId, vacationHolidays.date, vacationHolidays.country, vacationHolidays.region],
          set: { kind: sql`excluded.kind`, name: sql`excluded.name`, source: sql`excluded.source` },
          // A manually entered holiday is only ever replaced by another manual one.
          setWhere: sql`${vacationHolidays.source} <> 'manual' OR excluded.source = 'manual'`,
        });
    }

    return {
      profile: profileResult,
      ruleSets: { upserted: changes.ruleSets?.upsert?.length ?? 0, removed: ruleRemove.length },
      taxRegimes: { upserted: changes.taxRegimes?.upsert?.length ?? 0, removed: regimeRemove.length },
      salaries: { upserted: salaryRows.length, removed: salaryRemove.length },
      holidays: { upserted: holidayRows.length, removed: holidaysRemoved },
    };
  });
}

/** Upserts/removes leave periods. Periods may not overlap each other (taken or planned). */
export async function applyLeaveChanges(userId: string, changes: VacationLeaveChanges): Promise<VacationChangeCounts> {
  // Checked before writing: leave saved without a profile could never be priced or balanced.
  const profile = await db.query.vacationProfiles.findFirst({ where: eq(vacationProfiles.userId, userId) });
  if (!profile) throw new VacationValidationError('No vacation profile yet. Set one up with vacation_setup first.');
  const existing = await db.select().from(vacationLeavePeriods).where(eq(vacationLeavePeriods.userId, userId));
  for (const l of changes.upsert ?? []) {
    assertDate(l.startDate, 'Leave startDate');
    assertDate(l.endDate, 'Leave endDate');
    if (l.endDate < l.startDate)
      throw new VacationValidationError(`Leave ends ${l.endDate}, before it starts ${l.startDate}.`);
    const horizon = vacationHorizonError(profile.openingBalanceDate, l.endDate);
    if (horizon) throw new VacationValidationError(horizon);
  }
  const merged = mergeById(existing, changes, 'Leave period');
  assertNoOverlap(
    merged.map(l => ({ ...l, validFrom: l.startDate, validTo: l.endDate })),
    () => 'all',
    l => `${l.startDate}–${l.endDate} (${l.status})`,
    'Leave period',
  );

  return db.transaction(async tx => {
    const remove = changes.remove ?? [];
    if (remove.length) {
      await tx
        .delete(vacationLeavePeriods)
        .where(and(eq(vacationLeavePeriods.userId, userId), inArray(vacationLeavePeriods.id, remove)));
    }
    for (const { id, ...l } of changes.upsert ?? []) {
      const values = { ...l, payReceivedMdl: l.payReceivedMdl ?? null, notes: l.notes ?? null };
      if (id === undefined) await tx.insert(vacationLeavePeriods).values({ userId, ...values });
      else
        await tx
          .update(vacationLeavePeriods)
          .set(values)
          .where(and(eq(vacationLeavePeriods.userId, userId), eq(vacationLeavePeriods.id, id)));
    }
    return { upserted: changes.upsert?.length ?? 0, removed: remove.length };
  });
}
