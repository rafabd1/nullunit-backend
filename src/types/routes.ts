import { User } from '@supabase/supabase-js';

export interface RouteContext {
    params?: Record<string, string>;
    body?: Record<string, any>;
    request: Request;
    set: {
        status: number;
        headers?: Record<string, string>;
    };
}

export interface AuthenticatedContext extends RouteContext {
    user: User;
}

export interface ValidationError {
    error: string;
    message: string;
}
