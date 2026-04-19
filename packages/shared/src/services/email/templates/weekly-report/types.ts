export interface DayData {
  /** YYYY-MM-DD */
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  hasData: boolean;
}

export interface WeightPoint {
  /** YYYY-MM-DD */
  date: string;
  value: number;
}

export interface WeeklyReportData {
  weekStart: Date;
  weekEnd: Date;
  weekNumber: number;
  year: number;
  /** Max calorie target from calorie profile */
  goalMaxCalories: number;
  /** Min calorie target from calorie profile */
  goalMinCalories: number;
  /** Target weight loss/gain rate in kg/week */
  goalWeeklyRateKg: number;
  /** Basal metabolic rate */
  bmr: number;
  /** Total daily energy expenditure */
  tdee: number;
  /** 7 entries Mon-Sun; hasData=false for days with no meals */
  days: DayData[];
  weightPoints: WeightPoint[];
  /** Latest logged values by measurement typeKey */
  latestMeasurements: Record<string, number | null>;
  /** Most recent weight measurement from the week prior (for delta) */
  priorWeekWeight: number | null;
  userEmail: string;
}

export type BuildWeeklyReportHtmlData = Omit<WeeklyReportData, 'userEmail'> & {
  urls?: {
    unsubscribeUrl: string;
    viewInAppUrl: string;
  };
};
