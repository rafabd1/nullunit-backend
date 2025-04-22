import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { supabase } from './config/supabase';
import { memberRoutes } from './routes/memberRoutes';
import { authRoutes } from './routes/authRoutes';
import { articleRoutes } from './routes/articleRoutes';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const app = new Elysia()
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
                { name: 'articles', description: 'Article management endpoints' }
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
    )
    .listen(PORT);

console.log(
    `🚀 NullUnit API is running at ${app.server?.hostname}:${app.server?.port}`
);
