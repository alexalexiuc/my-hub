/**
 * Vacation demo data (pure, no DB): a plausible profile shown while a user has not set one up,
 * so the calendar can be explored before any setup. Dates are relative to `today`.
 *
 * Exports:
 *   buildVacationDemo(today) — demo profile plus engine input: MD calendar-day law and the 2027 draft,
 *                              six months of salary with bonuses, a projected raise, one taken and
 *                              one planned leave, and art. 111 holidays for every year in range
 */
import { DEFAULT_TAX_RATES } from '../../constants/vacation';
import type { VacationProfile } from '../../types';
import { shiftDateStr, shiftMonthStr } from '../../utils/dates';
import { moldovaPublicHolidays } from '../../utils/holidays-md';
import type { VacationModelInput } from '../../utils/vacation';

const DEMO_BONUSES = [3000, 0, 5000, 2000, 0, 4000];

export function buildVacationDemo(today: string): {
  profile: VacationProfile;
  input: Omit<VacationModelInput, 'includeDraftRules' | 'includePlanned'>;
} {
  const thisMonth = today.slice(0, 7);
  const openingBalanceDate = `${shiftMonthStr(thisMonth, -6)}-01`;
  const profile: VacationProfile = {
    userId: 'demo',
    country: 'MD',
    region: null,
    employer: 'Demo employer',
    openingBalanceDays: 14,
    openingBalanceDate,
    accrualStart: null,
    updatedAt: new Date(0),
  };

  const firstYear = Number(openingBalanceDate.slice(0, 4));
  const lastYear = Number(today.slice(0, 4)) + 2;
  const holidays = [];
  for (let year = firstYear; year <= lastYear; year++) {
    holidays.push(...moldovaPublicHolidays(year).map(h => ({ ...h, kind: 'holiday' as const })));
  }

  return {
    profile,
    input: {
      openingBalanceDays: profile.openingBalanceDays,
      openingBalanceDate,
      accrualStart: null,
      ruleSets: [
        {
          id: 1,
          name: 'MD Labour Code (calendar days)',
          region: null,
          validFrom: '2004-01-01',
          validTo: null,
          leaveUnit: 'calendar',
          annualEntitlementDays: 28,
          avgWindowMonths: 3,
          rateBasis: 'calendar_day',
          raiseResetsWindow: false,
          status: 'active',
        },
        {
          id: 2,
          name: 'MD 2027 reform (draft)',
          region: null,
          validFrom: '2027-01-01',
          validTo: null,
          leaveUnit: 'working',
          annualEntitlementDays: 22,
          avgWindowMonths: 3,
          rateBasis: 'working_day',
          raiseResetsWindow: false,
          status: 'draft',
        },
      ],
      taxRegimes: [{ validFrom: '2000-01-01', validTo: null, ...DEFAULT_TAX_RATES.it_park }],
      salaries: [
        ...DEMO_BONUSES.map((extraMdl, i) => ({
          month: shiftMonthStr(thisMonth, i - 6),
          baseMdl: 40000,
          extraMdl,
          kind: 'actual' as const,
        })),
        { month: shiftMonthStr(thisMonth, 3), baseMdl: 43000, extraMdl: 0, kind: 'projected' as const },
      ],
      holidays,
      leavePeriods: [
        { id: 1, startDate: shiftDateStr(today, -45), endDate: shiftDateStr(today, -39), status: 'taken' },
        { id: 2, startDate: shiftDateStr(today, 35), endDate: shiftDateStr(today, 41), status: 'planned' },
      ],
    },
  };
}
