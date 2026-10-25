import { redirect } from 'next/navigation';

/** The month calendar now lives on Progress; old links and bookmarks land there. */
export default function CalendarRedirect() {
  redirect('/calories/progress');
}
