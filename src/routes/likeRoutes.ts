import { Elysia } from 'elysia';
import { auth } from '../middlewares/auth';
import { LikeService } from '../services/likeService';
import { ContentType } from '../types/permissions';
import { RouteContext, AuthenticatedContext } from '../types/routes';
import { supabase } from '../config/supabase';
import { likeSchemas, userLikesResponseSchema } from '../schemas/likeSchemas';
import { t } from 'elysia';

/**
 * @description Content type validation helper
 */
const validateContentType = (type: string): ContentType | null => {
    return type === 'article' ? ContentType.ARTICLE : 
           type === 'project' ? ContentType.PROJECT : 
           null;
};

/**
 * @description Content existence validation helper
 */
const validateContent = async (contentType: ContentType, contentId: string): Promise<boolean> => {
    const table = contentType === ContentType.ARTICLE ? 'article_modules' : 'portfolio_projects';
    const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('id', contentId);
    
    return (count || 0) > 0;
};

export const likeRoutes = new Elysia({ prefix: '/likes' })
    .post('/:type/:id', async ({ params, request, set }: RouteContext & { params: { type: string; id: string } }) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
            try {
                const { type, id } = params;
                const contentType = validateContentType(type);
                
                if (!contentType) {
                    set.status = 400;
                    return { 
                        error: 'Invalid content type. Must be "article" or "project"',
                        status: 400
                    };
                }

                const exists = await validateContent(contentType, id);
                if (!exists) {
                    set.status = 404;
                    return { 
                        error: `${type} not found`,
                        status: 404
                    };
                }

                const [isLiked, count] = await Promise.all([
                    LikeService.toggleLike(user.id, contentType, id),
                    LikeService.getLikeCount(contentType, id)
                ]);

                return {
                    liked: isLiked,
                    count
                };
            } catch (error) {
                const err = error as Error;
                set.status = 500;
                return { 
                    error: err.message,
                    status: 500
                };
            }
        })({ params, request, set });
    }, {
        detail: {
            tags: ['likes'],
            description: 'Like or unlike content (articles/projects)',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Like status updated',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    liked: { type: 'boolean' },
                                    count: { type: 'integer' }
                                }
                            }
                        }
                    }
                },
                '400': {
                    description: 'Invalid content type'
                },
                '401': {
                    description: 'Unauthorized'
                },
                '404': {
                    description: 'Content not found'
                },
                '500': {
                    description: 'Internal server error'
                }
            }
        }
    })
    .get('/:type/:id', async ({ params, set }: RouteContext & { params: { type: string; id: string } }) => {
        try {
            const { type, id } = params;
            const contentType = validateContentType(type);
            
            if (!contentType) {
                set.status = 400;
                return { 
                    error: 'Invalid content type. Must be "article" or "project"',
                    status: 400
                };
            }

            const exists = await validateContent(contentType, id);
            if (!exists) {
                set.status = 404;
                return { 
                    error: `${type} not found`,
                    status: 404
                };
            }

            const count = await LikeService.getLikeCount(contentType, id);
            return { count };
        } catch (error) {
            const err = error as Error;
            set.status = 500;
            return { 
                error: err.message,
                status: 500
            };
        }
    }, {
        detail: {
            tags: ['likes'],
            description: 'Get total likes for content',
            responses: {
                '200': {
                    description: 'Like count retrieved',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    count: { type: 'integer' }
                                }
                            }
                        }
                    }
                },
                '400': {
                    description: 'Invalid content type'
                },
                '404': {
                    description: 'Content not found'
                },
                '500': {
                    description: 'Internal server error'
                }
            }
        }
    })
    .get('/:type/:id/status', async ({ params, request, set }: RouteContext & { params: { type: string; id: string } }) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
            try {
                const { type, id } = params;
                const contentType = validateContentType(type);
                
                if (!contentType) {
                    set.status = 400;
                    return { 
                        error: 'Invalid content type. Must be "article" or "project"',
                        status: 400
                    };
                }

                const exists = await validateContent(contentType, id);
                if (!exists) {
                    set.status = 404;
                    return { 
                        error: `${type} not found`,
                        status: 404
                    };
                }

                const [isLiked, count] = await Promise.all([
                    LikeService.hasUserLiked(user.id, contentType, id),
                    LikeService.getLikeCount(contentType, id)
                ]);

                return {
                    liked: isLiked,
                    count
                };
            } catch (error) {
                const err = error as Error;
                set.status = 500;
                return { 
                    error: err.message,
                    status: 500
                };
            }
        })({ params, request, set });
    }, {
        detail: {
            tags: ['likes'],
            description: 'Get like status and count for authenticated user',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Like status retrieved',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    liked: { type: 'boolean' },
                                    count: { type: 'integer' }
                                }
                            }
                        }
                    }
                },
                '400': {
                    description: 'Invalid content type'
                },
                '401': {
                    description: 'Unauthorized'
                },
                '404': {
                    description: 'Content not found'
                },
                '500': {
                    description: 'Internal server error'
                }
            }
        }
    })
    // Nova rota: Listar conteúdos curtidos pelo usuário autenticado
    .get('/me/content', async ({ request, set }: RouteContext) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
            try {
                const likedContent = await LikeService.getUserLikedContent(user.id);
                return likedContent;
            } catch (error) {
                const err = error as Error;
                set.status = 500;
                return { 
                    error: err.message || 'Failed to fetch liked content for authenticated user',
                    status: 500
                };
            }
        })({ request, set });
    }, {
        detail: {
            tags: ['likes'],
            description: 'Get a list of all content (articles/projects) liked by the currently authenticated user.',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Successfully retrieved liked content',
                    content: {
                        'application/json': {
                            schema: userLikesResponseSchema // Usando o schema importado
                        }
                    }
                },
                '401': {
                    description: 'Unauthorized',
                    content: {
                        'application/json': {
                            schema: t.Object({ error: t.String() })
                        }
                    }
                },
                '500': {
                    description: 'Internal server error',
                    content: {
                        'application/json': {
                            schema: t.Object({ error: t.String() })
                        }
                    }
                }
            }
        }
    })
    // Nova rota: Listar conteúdos curtidos por um usuário específico (público)
    .get('/user/:username/content', async ({ params, set }: RouteContext & { params: { username: string } }) => {
        try {
            const { username } = params;

            // 1. Buscar o userId pelo username na tabela 'members'
            const { data: member, error: memberError } = await supabase
                .from('members')
                .select('id')
                .eq('username', username)
                .single();

            if (memberError && memberError.code !== 'PGRST116') {
                set.status = 500;
                return { 
                    error: 'Error fetching member by username', 
                    details: memberError.message,
                    status: 500 
                };
            }
            if (!member) {
                set.status = 404;
                return { 
                    error: `User with username '${username}' not found`,
                    status: 404
                 };
            }

            const userId = member.id;
            const likedContent = await LikeService.getUserLikedContent(userId);
            return likedContent;

        } catch (error) {
            const err = error as Error;
            set.status = 500;
            return { 
                error: err.message || 'Failed to fetch liked content for user',
                status: 500
            };
        }
    }, {
        detail: {
            tags: ['likes'],
            description: 'Get a list of all content (articles/projects) liked by a user, identified by their username.',
            responses: {
                '200': {
                    description: 'Successfully retrieved liked content for the user',
                    content: {
                        'application/json': {
                            schema: userLikesResponseSchema // Usando o schema importado
                        }
                    }
                },
                '404': {
                    description: 'User not found',
                    content: {
                        'application/json': {
                            schema: t.Object({ error: t.String() })
                        }
                    }
                },
                '500': {
                    description: 'Internal server error',
                    content: {
                        'application/json': {
                            schema: t.Object({ error: t.String() })
                        }
                    }
                }
            }
        }
    });
