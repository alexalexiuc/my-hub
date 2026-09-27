/**
 * Vacation data loading.
 *
 * Exports:
 *   getVacationProfile         — the user's vacation profile, or undefined
 *   loadVacationModel          — loads everything the engine needs and builds a model (throws without a profile)
 *   deleteAllUserVacationData  — deletes every vacation row the user owns; returns the row count
 *   VacationValidationError    — a UserInputError for invalid vacation input or missing setup
 *   Types: VacationQueryOptions, LoadedVacationModel
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  vacationHolidays,
  vacationLeavePeriods,
  vacationProfiles,
  vacationRuleSets,
  vacationSalaryMonths,
  vacationTaxRegimes,
} from '../../db/schema/vacation';
import type { VacationHoliday, VacationProfile } from '../../types';
import { createVacationModel, type VacationModel } from '../../utils/vacation';
import { UserInputError } from '../../utils/errors';

/** Invalid vacation input or missing setup. The message is written for the user. */
export class VacationValidationError extends UserInputError {}

export interface VacationQueryOptions {
  includeDraftRules?: boolean;
  includePlanned?: boolean;
}

export interface LoadedVacationModel {
  profile: VacationProfile;
  model: VacationModel;
}

export async function getVacationProfile(userId: string): Promise<VacationProfile | undefined> {
  return db.query.vacationProfiles.findFirst({ where: eq(vacationProfiles.userId, userId) });
}

const sameRegion = (a: string | null, b: string | null) =>
  a !== null && b !== null && a.toLowerCase() === b.toLowerCase();

/**
 * Holidays that apply to a profile's locality: national rows (region '') plus that region's rows,
 * one per date, the regional row winning.
 */
function resolveHolidaysForRegion(holidays: VacationHoliday[], region: string | null): VacationHoliday[] {
  const byDate = new Map<string, VacationHoliday>();
  for (const h of holidays) {
    if (h.region === '') {
      if (!byDate.has(h.date)) byDate.set(h.date, h);
    } else if (sameRegion(h.region, region)) {
      byDate.set(h.date, h);
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** Loads a user's vacation data and builds an engine model. Throws when no profile is set up. */
export async function loadVacationModel(userId: string, opts: VacationQueryOptions = {}): Promise<LoadedVacationModel> {
  const profile = await getVacationProfile(userId);
  if (!profile) throw new VacationValidationError('No vacation profile yet. Set one up with vacation_setup first.');

  const [ruleSets, taxRegimes, salaries, leavePeriods, holidays] = await Promise.all([
    db
      .select()
      .from(vacationRuleSets)
      .where(and(eq(vacationRuleSets.userId, userId), eq(vacationRuleSets.country, profile.country))),
    db
      .select()
      .from(vacationTaxRegimes)
      .where(and(eq(vacationTaxRegimes.userId, userId), eq(vacationTaxRegimes.employer, profile.employer))),
    db
      .select()
      .from(vacationSalaryMonths)
      .where(eq(vacationSalaryMonths.userId, userId))
      .orderBy(asc(vacationSalaryMonths.month)),
    db
      .select()
      .from(vacationLeavePeriods)
      .where(eq(vacationLeavePeriods.userId, userId))
      .orderBy(asc(vacationLeavePeriods.startDate)),
    db
      .select()
      .from(vacationHolidays)
      .where(and(eq(vacationHolidays.userId, userId), eq(vacationHolidays.country, profile.country))),
  ]);

  const model = createVacationModel({
    openingBalanceDays: profile.openingBalanceDays,
    openingBalanceDate: profile.openingBalanceDate,
    accrualStart: profile.accrualStart,
    ruleSets: ruleSets.filter(r => r.region === null || sameRegion(r.region, profile.region)),
    taxRegimes,
    salaries,
    holidays: resolveHolidaysForRegion(holidays, profile.region),
    leavePeriods,
    includeDraftRules: opts.includeDraftRules ?? false,
    includePlanned: opts.includePlanned ?? true,
  });
  return { profile, model };
}

export async function deleteAllUserVacationData(userId: string): Promise<number> {
  return db.transaction(async tx => {
    const counts = await Promise.all([
      tx
        .delete(vacationLeavePeriods)
        .where(eq(vacationLeavePeriods.userId, userId))
        .returning({ id: vacationLeavePeriods.id }),
      tx.delete(vacationHolidays).where(eq(vacationHolidays.userId, userId)).returning({ id: vacationHolidays.id }),
      tx.delete(vacationRuleSets).where(eq(vacationRuleSets.userId, userId)).returning({ id: vacationRuleSets.id }),
      tx
        .delete(vacationTaxRegimes)
        .where(eq(vacationTaxRegimes.userId, userId))
        .returning({ id: vacationTaxRegimes.id }),
      tx
        .delete(vacationSalaryMonths)
        .where(eq(vacationSalaryMonths.userId, userId))
        .returning({ m: vacationSalaryMonths.month }),
      tx.delete(vacationProfiles).where(eq(vacationProfiles.userId, userId)).returning({ u: vacationProfiles.userId }),
    ]);
    return counts.reduce((sum, rows) => sum + rows.length, 0);
  });
}
