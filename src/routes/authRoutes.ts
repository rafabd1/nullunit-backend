import { Elysia, t } from 'elysia';
import { supabase } from '../config/supabase';
import { RouteContext } from '../types/routes';

interface AuthBody {
    email: string;
    password: string;
}

const authCredentialsSchema = t.Object({
    email: t.String({ format: 'email' }),
    password: t.String({ minLength: 8 })
});

/**
 * @description Auth routes for handling authentication flow
 */
export const authRoutes = new Elysia({ prefix: '/auth' })    .get('/callback', async ({ query, set }) => {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const { error } = query;

        set.status = 302;
        set.headers = {
            'Location': error 
                ? `${frontendUrl}/auth/error?error=${error}`
                : `${frontendUrl}/auth/success`
        };
        
        return null;
    })
    .post('/signup', async ({ body, set }: RouteContext & { body: AuthBody }) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email: body.email,
                password: body.password,
                options: {
                    emailRedirectTo: `${process.env.API_URL || 'http://localhost:3001'}/api/auth/callback`
                }
            });

            if (error) throw error;

            return {
                message: 'Verification email sent',
                user: data.user
            };
        } catch (err: unknown) {
            const error = err as Error;
            set.status = 400;
            return { error: error.message };
        }
    }, {
        body: authCredentialsSchema,
        detail: {
            tags: ['auth'],
            description: 'Create a new user account',
            security: [],
            responses: {
                '200': {
                    description: 'Account created successfully',
                    content: {
                        'application/json': {
                            schema: t.Object({
                                message: t.String(),
                                user: t.Object({
                                    id: t.String(),
                                    email: t.String()
                                })
                            })
                        }
                    }
                }
            }
        }
    })
    .post('/login', async ({ body, set }: RouteContext & { body: AuthBody }) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: body.email,
                password: body.password
            });

            if (error) throw error;

            return {
                session: data.session,
                user: data.user
            };
        } catch (err: unknown) {
            const error = err as Error;
            set.status = 401;
            return { error: error.message };
        }
    }, {
        body: authCredentialsSchema,
        detail: {
            tags: ['auth'],
            description: 'Login with email and password',
            security: [],
            responses: {
                '200': {
                    description: 'Login successful',
                    content: {
                        'application/json': {
                            schema: t.Object({
                                session: t.Object({
                                    access_token: t.String(),
                                    refresh_token: t.String()
                                }),
                                user: t.Object({
                                    id: t.String(),
                                    email: t.String()
                                })
                            })
                        }
                    }
                }
            }
        }
    })
    .post('/logout', async ({ set }: RouteContext) => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            return { message: 'Logged out successfully' };
        } catch (err: unknown) {
            const error = err as Error;
            set.status = 500;
            return { error: error.message };
        }
    }, {
        detail: {
            tags: ['auth'],
            description: 'Logout current user',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Logout successful',
                    content: {
                        'application/json': {
                            schema: t.Object({
                                message: t.String()
                            })
                        }
                    }
                }
            }
        }
    })
    .post('/refresh', async ({ set }: RouteContext) => {
        try {
            const { data, error } = await supabase.auth.refreshSession();
            if (error) throw error;

            return {
                session: data.session,
                user: data.user
            };
        } catch (err: unknown) {
            const error = err as Error;
            set.status = 401;
            return { error: error.message };
        }
    }, {
        detail: {
            tags: ['auth'],
            description: 'Refresh authentication token',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Token refreshed successfully',
                    content: {
                        'application/json': {
                            schema: t.Object({
                                session: t.Object({
                                    access_token: t.String(),
                                    refresh_token: t.String()
                                }),
                                user: t.Object({
                                    id: t.String(),
                                    email: t.String()
                                })
                            })
                        }
                    }
                }
            }
        }
    });
