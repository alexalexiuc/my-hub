export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  emailVerified: boolean;
}
