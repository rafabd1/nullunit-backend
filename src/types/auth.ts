import { User, Session } from '@supabase/supabase-js';
import { Member } from './database';

export interface AuthContext {
    query?: {
        email: string;
        type: string;
        access_token: string;
    };
    body?: any;
    params?: any;
    request: Request;
    set: { 
        status: number;
        headers: Record<string, string>;
    };
}

export interface AuthenticatedContext extends Omit<AuthContext, 'query'> {
    user: User;
}

export interface SignupContext {
    body: {
        email: string;
        password: string;
        username: string;
    };
    set: {
        status: number;
        headers: Record<string, string>;
    };
}

export interface LoginContext {
    body: {
        email: string;
        password: string;
    };
    set: {
        status: number;
        headers: Record<string, string>;
    };
}

export interface LogoutContext {
    set: {
        status: number;
        headers: Record<string, string>;
    };
}

export interface AuthResponse {
    message?: string;
    error?: string;
    user?: User;
    member?: Member;
    cookie?: string;
}

export interface SignupResponse extends AuthResponse {
    message: string;
    user: User;
}

export type LoginResponse = {
    access_token: string;
    refresh_token: string;
};

export interface VerifyEmailResponse extends AuthResponse {
    status: 'verified' | 'already_verified';
    user: User;
    member?: Member;
    accessToken?: string;
}
