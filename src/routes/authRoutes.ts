import { Elysia } from 'elysia';
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

export const authRoutes = new Elysia()
    .group('/auth', app => app
        .use(cookie())
        .get('/verify', ({ query, set }: AuthContext) => 
            handleVerifyEmail(query, set), {
                detail: {
                    tags: ['auth'],
                    summary: 'Verify email and create member account',
                    description: 'Validates user email and creates their member profile',
                    query: authSchemas.verifyQuery,
                    responses: {
                        '302': {
                            description: 'Redirect to success or error page'
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
                    summary: 'Create new user account',
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
                    summary: 'Authenticate user',
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
                    summary: 'End user session',
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
    );

/**
 * @description Handles email verification and member account creation
 */
async function handleVerifyEmail(query: AuthContext['query'], set: AuthContext['set']) {
    try {
        if (query.type !== 'signup') {
            set.status = 302;
            set.headers.location = `${frontendUrl}/auth/error?error=invalid_type`;
            return null;
        }

        const result = await AuthService.verifyEmail(query.email, query.access_token);
        set.status = 302;

        if (result.status === 'already_verified') {
            set.headers.location = `${frontendUrl}/auth/success?message=already_verified`;
        } else {
            set.headers.location = `${frontendUrl}/auth/success`;
        }

        if (result.accessToken) {
            set.headers['Set-Cookie'] = AuthService.getCookieString({
                access_token: result.accessToken
            });
        }

        return null;
    } catch (error) {
        const err = error as Error;
        set.status = 302;
        set.headers.location = `${frontendUrl}/auth/error?error=${encodeURIComponent(err.message)}`;
        return null;
    }
}

/**
 * @description Handles user registration
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
 * @description Handles user authentication
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
 * @description Handles user logout
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
