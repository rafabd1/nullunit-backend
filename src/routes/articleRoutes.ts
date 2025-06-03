import { Elysia, t } from 'elysia';
import { ArticleService } from '../services/articleService';
import { auth, requireAuthor } from '../middlewares/auth';
import { 
    sanitizeArticleData,
    sanitizeTitle,
    sanitizeDescription,
    sanitizeContent
} from '../utils/articleSanitizer';
import { RouteContext, AuthenticatedContext } from '../types/routes';
import { ArticleInputData, ArticleDbUpdate } from '../types/articleTypes';
import { 
    articleSchema, 
    articleInputSchema, 
    errorSchema 
} from '../schemas/articleSchemas';

const commonErrorResponses = {
    '400': {
        description: 'Invalid input data',
        content: {
            'application/json': {
                schema: errorSchema
            }
        }
    },
    '401': {
        description: 'Unauthorized',
        content: {
            'application/json': {
                schema: errorSchema
            }
        }
    },
    '403': {
        description: 'Forbidden',
        content: {
            'application/json': {
                schema: errorSchema
            }
        }
    },
    '404': {
        description: 'Not found',
        content: {
            'application/json': {
                schema: errorSchema
            }
        }
    },
    '500': {
        description: 'Internal server error',
        content: {
            'application/json': {
                schema: errorSchema
            }
        }
    }
};

export const articleRoutes = new Elysia({ prefix: '/articles' })
    .get('/', async ({ set }) => {
        try {
            const articles = await ArticleService.getAllArticles();
            return articles;
        } catch (error) {
            set.status = 500;
            return {
                error: 'Failed to fetch articles',
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }, {
        detail: {
            tags: ['articles'],
            description: 'Retrieve all published articles',
            responses: {
                '200': {
                    description: 'List of all published articles',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'array',
                                items: articleSchema
                            }
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .get('/:slug', async ({ params, set }) => {
        try {
            const article = await ArticleService.getArticleBySlug(params.slug);
            if (!article) {
                set.status = 404;
                return {
                    error: 'Not found',
                    message: 'Article not found'
                };
            }
            return article;
        } catch (error) {
            set.status = 500;
            return {
                error: 'Failed to fetch article',
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }, {
        detail: {
            tags: ['articles'],
            description: 'Get a single article by its slug',
            responses: {
                '200': {
                    description: 'Article details',
                    content: {
                        'application/json': {
                            schema: articleSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .post('/', async ({ body, request, set }: RouteContext & { body: ArticleInputData }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const coreSanitizedData = sanitizeArticleData(body);
                const article = await ArticleService.createArticle({
                    ...coreSanitizedData,
                    member_id: user.id,
                    tagNames: body.tagNames
                });
                set.status = 201;
                return article;
            } catch (error) {
                console.error("Error creating article:", error);
                let statusCode = 500;
                let errorTitle = 'Failed to create article';
                if (error instanceof Error) {
                    if (error.message.includes("slug already exists") || 
                        error.message.includes("Title must be") || 
                        error.message.includes("Content must be")) {
                        statusCode = 400;
                        errorTitle = 'Validation failed';
                    }
                }
                set.status = statusCode;
                return {
                    error: errorTitle,
                    message: error instanceof Error ? error.message : 'Invalid input data'
                };
            }
        })({ body, request, set });
    }, {
        body: articleInputSchema,
        detail: {
            tags: ['articles'],
            description: 'Create a new article (requires author permission)',
            security: [{ bearerAuth: [] }],
            responses: {
                '201': {
                    description: 'Article created successfully',
                    content: {
                        'application/json': {
                            schema: articleSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .put('/:slug', async ({ params, body, request, set }: RouteContext & { 
        params: { slug: string }, 
        body: Partial<ArticleInputData>
    }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const finalUpdatePayload: Partial<ArticleDbUpdate> = {};

                if (body.title !== undefined) {
                    finalUpdatePayload.title = sanitizeTitle(body.title);
                }
                if (body.description !== undefined) {
                    finalUpdatePayload.description = sanitizeDescription(body.description);
                } else if (body.hasOwnProperty('description') && body.description === null) {
                    finalUpdatePayload.description = null;
                }
                if (body.content !== undefined) {
                    finalUpdatePayload.content = sanitizeContent(body.content);
                }
                
                if (body.tagNames !== undefined) {
                    finalUpdatePayload.tagNames = body.tagNames;
                }

                const hasDataUpdates = finalUpdatePayload.title !== undefined || 
                                     finalUpdatePayload.description !== undefined || 
                                     (body.hasOwnProperty('description') && body.description === null) ||
                                     finalUpdatePayload.content !== undefined;

                if (!hasDataUpdates && finalUpdatePayload.tagNames === undefined) {
                    const currentArticle = await ArticleService.getArticleBySlug(params.slug);
                    if (!currentArticle) {
                        set.status = 404;
                        return { error: 'Not found', message: 'Article not found for no-op update.' };
                    }
                    if (currentArticle.member_id !== user.id) {
                        set.status = 403;
                        return { error: 'Forbidden', message: 'You do not have permission to view this article.' };
                    }
                    return currentArticle; 
                }

                const updatedArticle = await ArticleService.updateArticle(params.slug, finalUpdatePayload, user.id);
                return updatedArticle;

            } catch (error) {
                console.error("Error updating article:", error);
                let statusCode = 500;
                let errorTitle = 'Internal server error during update';

                if (error instanceof Error) {
                    if (error.message.toLowerCase().includes('not found')) {
                        statusCode = 404;
                        errorTitle = 'Not found';
                    } else if (error.message.toLowerCase().includes('forbidden')) {
                        statusCode = 403;
                        errorTitle = 'Forbidden';
                    } else if (error.message.includes("Title must be") || error.message.includes("Content must be")) {
                        statusCode = 400;
                        errorTitle = 'Validation failed';
                    } else {
                        errorTitle = error.message; 
                    }
                }
                set.status = statusCode;
                return {
                    error: errorTitle,
                    message: error instanceof Error ? error.message : 'Invalid input data or server error'
                };
            }
        })({ params, body, request, set });
    }, {
        body: t.Partial(articleInputSchema),
        detail: {
            tags: ['articles'],
            description: 'Update an existing article (requires author permission)',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Article updated successfully',
                    content: {
                        'application/json': {
                            schema: articleSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .delete('/:slug', async ({ params, request, set }: RouteContext & { params: { slug: string } }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                await ArticleService.deleteArticle(params.slug, user.id);
                set.status = 204;
                return null;
            } catch (error) {
                console.error("Error deleting article:", error);
                let statusCode = 500;
                let errorMessage = 'Failed to delete article';
                if (error instanceof Error) {
                    if (error.message.toLowerCase().includes('not found')) {
                        statusCode = 404;
                        errorMessage = 'Article not found';
                    } else if (error.message.toLowerCase().includes('forbidden')) {
                        statusCode = 403;
                        errorMessage = 'You do not have permission to delete this article';
                    } else {
                        errorMessage = error.message;
                    }
                }
                set.status = statusCode;
                return {
                    error: statusCode === 404 ? 'Not found' : (statusCode === 403 ? 'Forbidden' : 'Delete failed'),
                    message: errorMessage
                };
            }
        })({ params, request, set });
    }, {
        detail: {
            tags: ['articles'],
            description: 'Delete an article (requires author permission)',
            security: [{ bearerAuth: [] }],
            responses: {
                '204': {
                    description: 'Article deleted successfully'
                },
                ...commonErrorResponses
            }
        }
    });
