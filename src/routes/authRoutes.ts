import { Elysia, t } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { AuthService } from '../services/authService';
import { authSchemas, sessionSchema } from '../schemas/authSchemas';
import { auth } from '../middlewares/auth';
import { supabase } from '../config/supabase';
import type { 
    AuthContext, 
    SignupContext, 
    LoginContext, 
    LogoutContext,
    AuthenticatedContext 
} from '../types/auth';

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

export const authRoutes = new Elysia({ prefix: '/auth' })
    .use(cookie())
    .get('/verify', ({ query, set }: AuthContext) => {
        if (!query?.email || !query?.type || !query?.access_token) {
            set.status = 400;
            return { 
                redirectTo: `${frontendUrl}/auth/error?error=invalid_parameters`,
                error: 'Missing required query parameters'
            };
        }
        return handleVerifyEmail(query, set);
    }, {
        query: authSchemas.verifyQuery,
        detail: {
            tags: ['auth'],
            description: 'Validates user email via token. Returns a JSON object with a URL to redirect the user to. Sets auth cookie on success.',
            responses: {
                '200': {
                    description: 'Verification successful or user already verified. Redirect URL provided.',
                    content: {
                        'application/json': {
                            schema: t.Object({ redirectTo: t.String() })
                        }
                    },
                    headers: { 
                        'Set-Cookie': {
                            schema: { type: 'string' },
                            description: 'Sets the authentication cookie if verification is successful.'
                        }
                    }
                },
                '400': {
                    description: 'Invalid type or verification error. Redirect URL for error page provided.',
                    content: {
                        'application/json': {
                            schema: t.Object({ 
                                redirectTo: t.String(),
                                error: t.Optional(t.String()) 
                            })
                        }
                    }
                }
            }
        }
    })
    .post('/signup', ({ body, set }: SignupContext) => 
        handleSignup(body, set), {
            body: authSchemas.signup,
            detail: {
                tags: ['auth'],
                description: 'Register new user and send verification email',
                responses: {
                    '200': {
                        description: 'Verification email sent',
                        content: {
                            'application/json': {
                                schema: authSchemas.signupResponse
                            }
                        }
                    },
                    '400': {
                        description: 'Invalid input or username taken',
                        content: {
                            'application/json': {
                                schema: authSchemas.errorResponse
                            }
                        }
                    }
                }
            }
        }
    )
    .post('/login', async ({ body, set }: LoginContext) => {
        try {
            const sessionData = await AuthService.login(body.email, body.password);
            return sessionData;
        } catch (error) {
            const err = error as Error;
            set.status = 401;
            return { error: err.message };
        }
    }, {
        body: authSchemas.login,
        detail: {
            tags: ['auth'],
            description: 'Login with email and password and get session tokens.',
            responses: {
                '200': {
                    description: 'Login successful, session returned.',
                    content: {
                        'application/json': {
                            schema: sessionSchema
                        }
                    }
                },
                '401': {
                    description: 'Invalid credentials',
                    content: {
                        'application/json': {
                            schema: authSchemas.errorResponse
                        }
                    }
                }
            }
        }
    })
    .post('/logout', async ({ set }: LogoutContext) => {
        try {
            const result = await AuthService.logout();
            return { message: result.message };
        } catch (error) {
            const err = error as Error;
            set.status = 500;
            return { error: err.message };
        }
    }, {
        detail: {
            tags: ['auth'],
            description: 'Logs out the user on the backend. Client should handle its own state.',
            responses: {
                '200': {
                    description: 'Logout successful',
                    content: {
                        'application/json': {
                            schema: authSchemas.logoutResponse
                        }
                    }
                },
                '500': {
                    description: 'Server error',
                    content: {
                        'application/json': {
                            schema: authSchemas.errorResponse
                        }
                    }
                }
            }
        }
    })
    .patch('/user/email', async (context: AuthContext) => {
        return auth(async ({ user, set, body }) => {
            try {
                if (!body?.email) {
                    set.status = 400;
                    return { 
                        error: 'Invalid input',
                        message: 'Email is required'
                    };
                }
                const result = await AuthService.updateEmail(body.email);
                return result;
            } catch (error) {
                set.status = 400;
                return { 
                    error: 'Update failed',
                    message: error instanceof Error ? error.message : 'Failed to update email'
                };
            }
        })(context);
    }, {
        body: authSchemas.updateEmailSchema,
        detail: {
            tags: ['auth'],
            description: 'Update user email address',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Email updated successfully',
                    content: {
                        'application/json': {
                            schema: authSchemas.updateUserResponse
                        }
                    }
                },
                '400': {
                    description: 'Invalid input or email already in use',
                    content: {
                        'application/json': {
                            schema: authSchemas.errorResponse
                        }
                    }
                },
                '401': {
                    description: 'Unauthorized',
                    content: {
                        'application/json': {
                            schema: authSchemas.errorResponse
                        }
                    }
                }
            }
        }
    })
    .patch('/user/password', async (context: AuthContext) => {
        return auth(async ({ user, set, body }) => {
            try {
                if (!body?.password) {
                    set.status = 400;
                    return { 
                        error: 'Invalid input',
                        message: 'Password is required'
                    };
                }
                
                const { error: authError } = await supabase.auth.admin.updateUserById(
                    user.id,
                    { password: body.password }
                );

                if (authError) throw authError;

                return {
                    message: 'Password updated successfully'
                };
            } catch (error) {
                set.status = 400;
                return { 
                    error: 'Update failed',
                    message: error instanceof Error ? error.message : 'Failed to update password'
                };
            }
        })(context);
    }, {
        body: authSchemas.updatePasswordSchema,
        detail: {
            tags: ['auth'],
            description: 'Update user password',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Password updated successfully',
                    content: {
                        'application/json': {
                            schema: t.Object({
                                message: t.String()
                            })
                        }
                    }
                },
                '400': {
                    description: 'Invalid password format',
                    content: {
                        'application/json': {
                            schema: authSchemas.errorResponse
                        }
                    }
                },
                '401': {
                    description: 'Unauthorized',
                    content: {
                        'application/json': {
                            schema: authSchemas.errorResponse
                        }
                    }
                }
            }
        }
    })
    .delete('/user', async (context: AuthContext) => {
        return auth(async ({ user, set }) => {
            try {
                await AuthService.deleteUser(user.id);
                return { 
                    message: 'User account deleted successfully'
                };
            } catch (error) {
                set.status = 400;
                return { 
                    error: 'Deletion failed',
                    message: error instanceof Error ? error.message : 'Failed to delete user'
                };
            }
        })(context);
    }, {
        detail: {
            tags: ['auth'],
            description: 'Delete user account and associated member profile',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'User deleted successfully',
                    content: {
                        'application/json': {
                            schema: t.Object({
                                message: t.String()
                            })
                        }
                    }
                },
                '400': {
                    description: 'Deletion failed',
                    content: {
                        'application/json': {
                            schema: authSchemas.errorResponse
                        }
                    }
                },
                '401': {
                    description: 'Unauthorized',
                    content: {
                        'application/json': {
                            schema: authSchemas.errorResponse
                        }
                    }
                }
            }
        }
    });

/**
 * @description Handles email verification. The client will handle session creation on redirect.
 */
async function handleVerifyEmail(query: Required<AuthContext>['query'], set: AuthContext['set']) {
    try {
        if (query.type !== 'signup') {
            set.status = 400;
            return { redirectTo: `${frontendUrl}/auth/error?error=invalid_type`, error: 'Invalid type' };
        }

        const result = await AuthService.verifyEmail(query.email, query.access_token);

        if (result.status === 'already_verified') {
            return { redirectTo: `${frontendUrl}/auth/success?message=already_verified` };
        }
        
        return { redirectTo: `${frontendUrl}/auth/success` };

    } catch (error) {
        const err = error as Error;
        set.status = 400;
        return { redirectTo: `${frontendUrl}/auth/error?error=${encodeURIComponent(err.message)}`, error: err.message };
    }
}

/**
 * Handles user registration
 */
async function handleSignup(body: SignupContext['body'], set: SignupContext['set']) {
    try {
        return await AuthService.signup(body.email, body.password, body.username);
    } catch (error) {
        const err = error as Error;
        set.status = 400;
        return { error: err.message };
    }
}
