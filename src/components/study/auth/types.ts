import type { User } from "firebase/auth";

export interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  isSigningIn: boolean;
  authError: string;
  redirectError: string;
  clearError: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getToken: () => Promise<string | null>;
  isConfigured: boolean;
}
