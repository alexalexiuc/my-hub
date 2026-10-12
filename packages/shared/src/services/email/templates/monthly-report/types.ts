export interface WeekSummary {
  /** Label e.g. "Week 1" or "Apr 1–7" */
  label: string;
  avgDailyKcal: number;
  hasData: boolean;
}

export interface MeasurementSnapshot {
  weight: number | null;
  bodyFat: number | null;
  waist: number | null;
  chest: number | null;
  neck: number | null;
}

export interface MonthlyWeightPoint {
  /** YYYY-MM-DD */
  date: string;
  value: number;
}

export interface MonthlyReportData {
  /** First day of the reported month */
  monthStart: Date;
  /** Last day of the reported month */
  monthEnd: Date;
  /** e.g. "March 2026" */
  monthLabel: string;
  year: number;
  totalDaysInMonth: number;
  daysLogged: number;
  longestStreak: number;

  goalMaxCalories: number;
  /** Signed kg/week (negative to lose, positive to gain); zero for maintain or an unset rate. For arithmetic only. */
  goalWeeklyRateKg: number;
  /** Which way the goal wants the scale to move: -1 lose, 1 gain, 0 maintain or no goal. Survives an unset rate. */
  goalDirection: -1 | 0 | 1;
  bmr: number;
  tdee: number;

  avgDailyKcal: number;
  daysOnTarget: number;
  monthlyDeficit: number; // positive = deficit

  /** Average daily macros over the month */
  avgCarbs: number;
  avgProtein: number;
  avgFat: number;

  /** One entry per calendar week that overlaps the month */
  weeks: WeekSummary[];

  weightPoints: MonthlyWeightPoint[];
  startMeasurements: MeasurementSnapshot;
  endMeasurements: MeasurementSnapshot;

  userEmail: string;
}

export type BuildMonthlyReportHtmlData = Omit<MonthlyReportData, 'userEmail'> & {
  urls?: {
    unsubscribeUrl: string;
    viewInAppUrl: string;
  };
};
