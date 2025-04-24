import { Elysia, t } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { AuthService } from '../services/authService';
import { authSchemas } from '../schemas/authSchemas';
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
    .post('/login', ({ body, set }: LoginContext) => 
        handleLogin(body, set), {
            body: authSchemas.login,
            detail: {
                tags: ['auth'],
                description: 'Login with email and password',
                responses: {
                    '200': {
                        description: 'Login successful',
                        content: {
                            'application/json': {
                                schema: authSchemas.loginResponse
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
        }
    )
    .post('/logout', ({ set }: LogoutContext) => 
        handleLogout(set), {
            detail: {
                tags: ['auth'],
                description: 'Logout and clear authentication',
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
        }
    )
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
                const result = await AuthService.updateEmail(user.id, body.email);
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
    .patch('/user/username', async (context: AuthContext) => {
        return auth(async ({ user, set, body }) => {
            try {
                if (!body?.username) {
                    set.status = 400;
                    return { 
                        error: 'Invalid input',
                        message: 'Username is required'
                    };
                }
                const result = await AuthService.updateUsername(user.id, body.username);
                return result;
            } catch (error) {
                set.status = 400;
                return { 
                    error: 'Update failed',
                    message: error instanceof Error ? error.message : 'Failed to update username'
                };
            }
        })(context);
    }, {
        body: authSchemas.updateUsernameSchema,
        detail: {
            tags: ['auth'],
            description: 'Update user username',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Username updated successfully',
                    content: {
                        'application/json': {
                            schema: authSchemas.updateUserResponse
                        }
                    }
                },
                '400': {
                    description: 'Invalid input or username already taken',
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
                    message: 'User account deleted successfully',
                    cookie: AuthService.getCookieString({}, true)
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
                                message: t.String(),
                                cookie: t.String()
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
 * @description Handles email verification and member account creation
 */
async function handleVerifyEmail(query: Required<AuthContext>['query'], set: AuthContext['set']) {
    let redirectTo = `${frontendUrl}/auth/error?error=unknown_error`; // Default error URL
    let errorMessage: string | undefined = 'Unknown error';
    try {
        if (query.type !== 'signup') {
            redirectTo = `${frontendUrl}/auth/error?error=invalid_type`;
            errorMessage = 'Invalid type';
            set.status = 400;
            return { redirectTo, error: errorMessage };
        }

        const result = await AuthService.verifyEmail(query.email, query.access_token);

        if (result.status === 'already_verified') {
            redirectTo = `${frontendUrl}/auth/success?message=already_verified`;
        } else {
            redirectTo = `${frontendUrl}/auth/success`;
        }

        if (result.accessToken) {
            set.headers['Set-Cookie'] = AuthService.getCookieString({
                access_token: result.accessToken
            });
        }

        set.status = 200;
        return { redirectTo };
    } catch (error) {
        const err = error as Error;
        errorMessage = err.message;
        redirectTo = `${frontendUrl}/auth/error?error=${encodeURIComponent(errorMessage)}`;
        set.status = 400;
        return { redirectTo, error: errorMessage };
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

/**
 * Handles user authentication
 */
async function handleLogin(body: LoginContext['body'], set: LoginContext['set']) {
    try {
        const result = await AuthService.login(body.email, body.password);
        if (result.cookie) {
            set.headers['Set-Cookie'] = result.cookie;
        }
        return {
            user: result.user,
            session: result.session
        };
    } catch (error) {
        const err = error as Error;
        set.status = 401;
        return { error: err.message };
    }
}

/**
 * Handles user logout
 */
async function handleLogout(set: LogoutContext['set']) {
    try {
        const result = await AuthService.logout();
        if (result.cookie) {
            set.headers['Set-Cookie'] = result.cookie;
        }
        return { message: result.message };
    } catch (error) {
        const err = error as Error;
        set.status = 500;
        return { error: err.message };
    }
}
