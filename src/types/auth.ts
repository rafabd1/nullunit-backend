import { User } from '@supabase/supabase-js';
import { Member } from './database';

/**
 * @description Authentication response types
 */
export interface AuthResponse {
    message?: string;
    error?: string;
    cookie?: string;
}

export interface SignupResponse extends AuthResponse {
    user: User | null;
}

export interface LoginResponse extends AuthResponse {
    user: User;
    session: {
        access_token: string;
        refresh_token: string;
    };
}

export interface VerifyEmailResponse extends AuthResponse {
    status?: 'verified' | 'already_verified';
    user?: User;
    member?: Member;
    accessToken?: string;
}

/**
 * @description Request contexts
 */
export interface AuthContext {
    query: VerifyQuery;
    set: {
        status: number;
        headers: {
            location?: string;
            'Set-Cookie'?: string;
        };
    };
}

export interface SignupContext {
    body: SignupBody;
    set: {
        status: number;
        headers?: Record<string, string>;
    };
}

export interface LoginContext {
    body: LoginBody;
    set: {
        status: number;
        headers: {
            'Set-Cookie'?: string;
        };
    };
}

export interface LogoutContext {
    set: {
        status: number;
        headers: {
            'Set-Cookie'?: string;
        };
    };
}

/**
 * @description Request payloads
 */
export interface VerifyQuery {
    email: string;
    type: string;
    access_token: string;
}

export interface SignupBody {
    email: string;
    password: string;
    username: string;
}

export interface LoginBody {
    email: string;
    password: string;
}
