import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { cookie } from '@elysiajs/cookie';
import { supabase } from './config/supabase';
import { configureCors } from './config/cors';
import { memberRoutes } from './routes/memberRoutes';
import { authRoutes } from './routes/authRoutes';
import { articleRoutes } from './routes/articleRoutes';
import { likeRoutes } from './routes/likeRoutes';
import { portfolioRoutes } from './routes/portfolioRoutes';
import { tagRoutes } from './routes/tagRoutes';
import { courseRoutes } from './routes/courseRoutes';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const isProduction = process.env.NODE_ENV === 'production';

/**
 * @description Initialize API with middleware and routes
 */
const app = new Elysia()
    .use(cookie())
    .use(configureCors)
    .use(swagger({
        documentation: {
            info: {
                title: 'NullUnit API Documentation',
                version: '1.0.0',
                description: 'API documentation for NullUnit project',
                contact: {
                    name: 'NullUnit Team',
                    url: 'https://nullunit.dev'
                },
            },
            tags: [
                { name: 'auth', description: 'Authentication endpoints' },
                { name: 'members', description: 'Member management endpoints' },
                { name: 'articles', description: 'Article management endpoints' },
                { name: 'likes', description: 'Content interaction endpoints' },
                { name: 'portfolio', description: 'Portfolio project endpoints' },
                { name: 'Tags', description: 'Tag management and query endpoints' },
                { name: 'Courses', description: 'Course management endpoints' }
            ],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT'
                    }
                }
            }
        },
        path: '/docs'
    }))
    .derive(({ cookie: { auth }, setCookie, removeCookie }) => {
        const cookieOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? ('strict' as const) : ('lax' as const),
            path: '/',
            maxAge: 7 * 24 * 60 * 60
        };

        return {
            getAuthToken: () => {
                try {
                    return JSON.parse(auth || '{}').access_token;
                } catch {
                    return undefined;
                }
            },
            setAuthCookies: (access_token: string, refresh_token: string) => {
                setCookie('auth', JSON.stringify({ access_token, refresh_token }), cookieOptions);
            },
            clearAuthCookies: () => {
                removeCookie('auth');
            }
        };
    })
    .get('/', {
        detail: {
            tags: ['system'],
            description: 'API root endpoint'
        },
        handler: () => ({
            status: 'online',
            message: 'NullUnit API is running',
            timestamp: new Date().toISOString()
        })
    })
    .group('/api', app => app
        .get('/health', {
            detail: {
                tags: ['system'],
                description: 'Check API and database health',
                responses: {
                    '200': {
                        description: 'Health check response',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', enum: ['healthy', 'error'] },
                                        database: { type: 'string', enum: ['connected', 'disconnected'] },
                                        timestamp: { type: 'string', format: 'date-time' }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            handler: async () => {
                try {
                    const { data, error } = await supabase.from('members').select('count');
                    if (error) throw error;
                    return {
                        status: 'healthy',
                        database: 'connected',
                        timestamp: new Date().toISOString()
                    };
                } catch (error) {
                    return {
                        status: 'error',
                        database: 'disconnected',
                        error: error instanceof Error ? error.message : 'Unknown error',
                        timestamp: new Date().toISOString()
                    };
                }
            }
        })
        .use(authRoutes)
        .use(memberRoutes)
        .use(articleRoutes)
        .use(likeRoutes)
        .use(portfolioRoutes)
        .use(tagRoutes)
        .use(courseRoutes)
    )
    .listen(PORT);

console.log(
    `🚀 NullUnit API is running at ${app.server?.hostname}:${app.server?.port}`
);
