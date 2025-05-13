import { supabase } from '../config/supabase';
import type { VerifyEmailResponse, SignupResponse, LoginResponse, AuthResponse } from '../types/auth';
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

        // Tenta encontrar o username nos metadados do usuário
        // No JWT o username está dentro do user_metadata
        const username = user.user_metadata?.username || (user.user_metadata as any)?.sub;
        if (!username) {
            console.error('User metadata:', user.user_metadata);
            throw new Error('Username not found in user metadata');
        }

        const { data: member, error: memberError } = await supabase
            .from('members')
            .insert({
                id: user.id,
                username: username,
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
        // Verifica se o username já está em uso
        const { data: existingMemberByUsername } = await supabase
            .from('members')
            .select('id')
            .eq('username', username)
            .single();

        if (existingMemberByUsername) {
            throw new Error('Username already taken');
        }

        // Verifica se o email já está em uso (tanto na tabela auth quanto na members)
        const { data: existingMemberByEmail } = await supabase
            .from('members')
            .select('id')
            .eq('email', email)
            .single();

        if (existingMemberByEmail) {
            throw new Error('Email already registered');
        }

        // Verifica se o email já existe no Auth do Supabase
        const { data: existingUser, error: authCheckError } = await supabase.auth.admin.listUsers();
        if (authCheckError) {
            console.error('Error checking existing users:', authCheckError);
            throw new Error('Error during signup process');
        }

        const emailExists = existingUser.users.some(user => user.email === email);
        if (emailExists) {
            throw new Error('Email already registered');
        }

        // Se passou por todas as verificações, tenta criar o usuário
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { username },
                emailRedirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback`
            }
        });

        if (error || !data.user) throw new Error('Failed to create user account');

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

    /**
     * @description Delete user account and associated member profile
     */
    static async deleteUser(userId: string): Promise<void> {
        const { error: memberError } = await supabase
            .from('members')
            .delete()
            .eq('id', userId);

        if (memberError) {
            throw new Error('Failed to delete member profile');
        }

        const { error: authError } = await supabase.auth.admin.deleteUser(userId);

        if (authError) {
            // Se falhar a deleção do auth, tentar restaurar o member
            await supabase.from('members').insert({
                id: userId,
                username: 'deleted_user',
                role: 'deleted',
                permission: UserPermission.GUEST,
                bio: ''
            });
            throw new Error('Failed to delete user account');
        }
    }

    /**
     * @description Update user account and member profile
     */
    static async updateUser(userId: string, updates: { email?: string; password?: string; userData?: { username?: string } }): Promise<{user: any; member: any}> {
        // Primeiro, verifica se as atualizações são válidas
        if (updates.email) {
            const { data: existingMemberByEmail } = await supabase
                .from('members')
                .select('id')
                .eq('email', updates.email)
                .neq('id', userId)
                .single();

            if (existingMemberByEmail) {
                throw new Error('Email already registered');
            }
        }

        if (updates.userData?.username) {
            const { data: existingMemberByUsername } = await supabase
                .from('members')
                .select('id')
                .eq('username', updates.userData.username)
                .neq('id', userId)
                .single();

            if (existingMemberByUsername) {
                throw new Error('Username already taken');
            }
        }

        // Atualiza o usuário no Auth
        const authUpdates: any = {};
        if (updates.email) authUpdates.email = updates.email;
        if (updates.password) authUpdates.password = updates.password;
        if (updates.userData) authUpdates.data = updates.userData;

        const { data: authUpdate, error: authError } = await supabase.auth.admin.updateUserById(
            userId,
            authUpdates
        );

        if (authError) {
            throw new Error('Failed to update user account');
        }

        // Atualiza o member correspondente
        const memberUpdates: any = {};
        if (updates.email) memberUpdates.email = updates.email;
        if (updates.userData?.username) memberUpdates.username = updates.userData.username;

        const { data: memberUpdate, error: memberError } = await supabase
            .from('members')
            .update(memberUpdates)
            .eq('id', userId)
            .select()
            .single();

        if (memberError) {
            // Se falhar a atualização do member, tenta reverter as alterações no auth
            if (updates.email) {
                await supabase.auth.admin.updateUserById(userId, {
                    email: authUpdate.user.email
                });
            }
            throw new Error('Failed to update member profile');
        }

        return {
            user: authUpdate.user,
            member: memberUpdate
        };
    }

    /**
     * @description Update user email with verification
     */
    static async updateEmail(newEmail: string): Promise<AuthResponse> {
        //TODO: Create frontend route to handle email change confirmation and guide the user to confirm the invite in 
        //      their new email
        const { data: existingUsers, error: usersError } = await supabase.auth.admin.listUsers();
        if (usersError) {
            throw new Error('Failed to check email availability');
        }

        const emailExists = existingUsers.users.some(user => user.email === newEmail);
        if (emailExists) {
            throw new Error('Email already in use');
        }

        const { data, error } = await supabase.auth.updateUser({
            email: newEmail
        });

        if (error) {
            throw new Error('Failed to initiate email change process');
        }

        return {
            message: 'Verification emails sent. Please check both your current and new email addresses to confirm the change.',
            user: data.user
        };
    }
}
