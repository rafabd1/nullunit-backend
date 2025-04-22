import { User } from '@supabase/supabase-js';

export interface AuthContext {
  user: User;
}

export interface AuthContextOptional {
  user?: User;
}
