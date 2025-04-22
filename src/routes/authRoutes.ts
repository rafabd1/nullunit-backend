import { Elysia, t } from 'elysia';
import { supabase } from '../config/supabase';
import { RouteContext } from '../types/routes';

interface AuthBody {
    email: string;
    password: string;
}

export const authRoutes = new Elysia({ prefix: '/auth' })
    .post('/signup', {
        detail: {
            tags: ['auth'],
            description: 'Create a new user account',
            security: [],
            responses: {
                '200': {
                    description: 'Account created successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    message: { type: 'string' },
                                    user: { 
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            email: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        body: t.Object({
            email: t.String({ format: 'email' }),
            password: t.String({ minLength: 8 })
        }),
        handler: async ({ body, set }: RouteContext & { body: AuthBody }) => {
            try {
                const { data, error } = await supabase.auth.signUp({
                    email: body.email,
                    password: body.password
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
        }
    })
    .post('/login', {
        detail: {
            tags: ['auth'],
            description: 'Login with email and password',
            security: [],
            responses: {
                '200': {
                    description: 'Login successful',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    session: {
                                        type: 'object',
                                        properties: {
                                            access_token: { type: 'string' },
                                            refresh_token: { type: 'string' }
                                        }
                                    },
                                    user: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            email: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        body: t.Object({
            email: t.String({ format: 'email' }),
            password: t.String()
        }),
        handler: async ({ body, set }: RouteContext & { body: AuthBody }) => {
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
        }
    })
    .post('/logout', {
        detail: {
            tags: ['auth'],
            description: 'Logout current user',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Logout successful',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    message: { type: 'string' }
                                }
                            }
                        }
                    }
                }
            }
        },
        handler: async ({ set }: RouteContext) => {
            try {
                const { error } = await supabase.auth.signOut();
                if (error) throw error;

                return { message: 'Logged out successfully' };
            } catch (err: unknown) {
                const error = err as Error;
                set.status = 500;
                return { error: error.message };
            }
        }
    })
    .post('/refresh', {
        detail: {
            tags: ['auth'],
            description: 'Refresh authentication token',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Token refreshed successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    session: {
                                        type: 'object',
                                        properties: {
                                            access_token: { type: 'string' },
                                            refresh_token: { type: 'string' }
                                        }
                                    },
                                    user: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            email: { type: 'string' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        handler: async ({ set }: RouteContext) => {
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
        }
    });
