export interface DayData {
  /** YYYY-MM-DD */
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** True when the day's meals add up to more than 0 kcal; meals logged without calorie counts do not make a logged day. */
  hasData: boolean;
  /**
   * This day's calorie ceiling, gym-day bonus included — the same number `dayCalorieTargets`
   * gives the Today, Progress, Calendar and Weekly Menu screens.
   *
   * Carried per day rather than once for the week because a training day's target includes the
   * bonus. Judging every day against one flat figure reported a gym day eaten exactly to plan as
   * hundreds of calories over, and named it the week's worst day.
   */
  target: number;
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
  /**
   * Target rate in kg/week, **signed by the goal**: negative to lose, positive to gain. Zero for a
   * maintain goal *and* for a gain or loss goal with no rate set — so use it for arithmetic
   * (projecting a weight), never to judge direction; that is `goalDirection`.
   */
  goalWeeklyRateKg: number;
  /**
   * Which way the goal wants the scale to move: -1 lose, 1 gain, 0 maintain or no goal. Read from
   * the goal type, so a gain or loss goal with no rate set is still judged as one.
   */
  goalDirection: -1 | 0 | 1;
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
