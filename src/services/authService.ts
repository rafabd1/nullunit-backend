import { supabase } from '../config/supabase';
import type { VerifyEmailResponse, SignupResponse, LoginResponse } from '../types/auth';
import { UserPermission } from '../types/permissions';

/**
 * @description Configuration options for authentication cookies
 */
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' as const : 'lax' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60
} as const;

/**
 * @description Service layer for authentication management
 */
export class AuthService {
    /**
     * @description Generate cookie string with authentication tokens
     */
    static getCookieString(tokens: { access_token?: string; refresh_token?: string } = {}, clear = false) {
        const cookieValue = clear ? '' : JSON.stringify(tokens);
        const options = clear ? { ...cookieOptions, maxAge: 0 } : cookieOptions;

        return `auth=${cookieValue}; ${Object.entries(options)
            .map(([key, value]) => `${key}=${value}`)
            .join('; ')}`;
    }

    /**
     * @description Verify user email and create member account
     */
    static async verifyEmail(email: string, accessToken: string): Promise<VerifyEmailResponse> {
        const { data: { user }, error: getUserError } = await supabase.auth.getUser(accessToken);
        
        if (getUserError || !user) {
            throw new Error('User not found');
        }

        const { data: member, error: memberError } = await supabase
            .from('members')
            .insert({
                id: user.id,
                username: user.user_metadata?.username,
                role: 'member',
                permission: UserPermission.GUEST,
                bio: ''
            })
            .select()
            .single();

        if (memberError) {
            if (memberError.code === '23505') {
                return {
                    status: 'already_verified',
                    user,
                    accessToken
                };
            }
            throw new Error('Failed to create member profile');
        }

        return {
            status: 'verified',
            user,
            member,
            accessToken
        };
    }

    /**
     * @description Create new user account
     */
    static async signup(email: string, password: string, username: string): Promise<SignupResponse> {
        const { data: existingMember } = await supabase
            .from('members')
            .select('id')
            .eq('username', username)
            .single();

        if (existingMember) {
            throw new Error('Username already taken');
        }

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { username },
                emailRedirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback`
            }
        });

        if (error) throw error;

        return {
            message: 'Verification email sent',
            user: data.user
        };
    }

    /**
     * @description Authenticate user and create session
     */
    static async login(email: string, password: string): Promise<LoginResponse> {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        const cookie = this.getCookieString({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token
        });

        return {
            user: data.user,
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token
            },
            cookie
        };
    }

    /**
     * @description End user session and clear authentication
     */
    static async logout() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;

        return {
            message: 'Logged out successfully',
            cookie: this.getCookieString({}, true)
        };
    }
}
