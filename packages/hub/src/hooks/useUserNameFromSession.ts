import { useSession } from 'next-auth/react';

export function useUserNameFromSession() {
  const { data: session, status } = useSession();
  const fullName = session?.user?.name;
  const [firstName, lastName] = fullName?.split(' ') ?? [];
  return { firstName, lastName, fullName, status };
}
