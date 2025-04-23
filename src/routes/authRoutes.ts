import { Elysia, t } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { AuthService } from '../services/authService';
import { authSchemas } from '../schemas/authSchemas';
import type { 
    AuthContext, 
    SignupContext, 
    LoginContext, 
    LogoutContext 
} from '../types/auth';

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

export const authRoutes = new Elysia({ prefix: '/auth' })
    .use(cookie())
    .get('/verify', ({ query, set }: AuthContext) => 
        handleVerifyEmail(query, set), {
            detail: {
                tags: ['auth'],
                description: 'Validates user email via token. Returns a JSON object with a URL to redirect the user to. Sets auth cookie on success.',
                query: authSchemas.verifyQuery,
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
        }
    )
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
    );

/**
 * @description Handles email verification and member account creation
 */
async function handleVerifyEmail(query: AuthContext['query'], set: AuthContext['set']) {
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

        set.status = 200; // OK
        return { redirectTo }; // Retorna JSON
    } catch (error) {
        const err = error as Error;
        errorMessage = err.message;
        redirectTo = `${frontendUrl}/auth/error?error=${encodeURIComponent(errorMessage)}`;
        set.status = 400; // Bad Request ou outro erro apropriado
        return { redirectTo, error: errorMessage }; // Retorna JSON com erro
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
