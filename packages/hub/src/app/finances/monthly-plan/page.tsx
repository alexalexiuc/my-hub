import { dateToString } from '@my-hub/shared/utils';
import { MonthlyPlanScreen } from './MonthlyPlanScreen';

export default function MonthlyPlanPage() {
  return <MonthlyPlanScreen initialMonth={dateToString().slice(0, 7)} />;
}
