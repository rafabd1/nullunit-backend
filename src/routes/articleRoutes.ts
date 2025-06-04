import { Elysia, t } from 'elysia';
import { ArticleService } from '../services/articleService';
import { requireAuthor, optionalAuth } from '../middlewares/auth';
import { 
    sanitizeArticleData,
    sanitizeTitle,
    sanitizeDescription,
    sanitizeContent
} from '../utils/articleSanitizer';
import { 
    ElysiaBaseContext, 
    AuthenticatedContext, 
    OptionallyAuthenticatedContext 
} from '../types/routes';
import { ArticleInputData, ArticleDbUpdate } from '../types/articleTypes';
import { 
    articleSchema, 
    articleInputSchema, 
    errorSchema 
} from '../schemas/articleSchemas';
import {
    NotFoundError, ForbiddenError, ValidationError, DatabaseError
} from '../utils/errors';

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
    .get('/', 
        async (context: OptionallyAuthenticatedContext) => {
            const { set, member } = context;
            try {
                const articles = await ArticleService.getAllArticles(
                    member ? { id: member.id, permission: member.permission } : undefined
                );
                return articles;
            } catch (error: any) {
                console.error("Error fetching all articles:", error);
                set.status = 500;
                return { error: 'Internal Server Error', message: error.message || 'Failed to fetch articles.' };
            }
        },
        {
            beforeHandle: [optionalAuth() as any],
            detail: {
                tags: ['articles'],
                description: 'Retrieve all articles (published, or unpublished if owner)',
                responses: {
                    '200': {
                        description: 'List of articles',
                        content: {
                            'application/json': {
                                schema: t.Array(articleSchema)
                            }
                        }
                    },
                    ...commonErrorResponses
                }
            }
        }
    )
    .get('/:slug', 
        async (context: OptionallyAuthenticatedContext & { params: { slug: string } }) => {
            const { params, set, member } = context;
            try {
                const article = await ArticleService.getArticleBySlug(
                    params.slug, 
                    member ? { id: member.id, permission: member.permission } : undefined
                );
                if (!article) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Article not found or not accessible.' };
                }
                return article;
            } catch (error: any) {
                console.error(`Error fetching article ${params.slug}:`, error);
                set.status = 500;
                return { error: 'Internal Server Error', message: error.message || 'Failed to fetch article.' };
            }
        },
        {
            beforeHandle: [optionalAuth() as any],
            params: t.Object({ slug: t.String() }),
            detail: {
                tags: ['articles'],
                description: 'Get a single article by its slug (published, or unpublished if owner)',
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
        }
    )
    .post('/', 
        async (context: ElysiaBaseContext & { body: ArticleInputData }) => {
            const { body, request, set } = context;
            return requireAuthor(async ({ user, set: authSet, member }: AuthenticatedContext) => {
                try {
                    const coreSanitizedData = sanitizeArticleData(body);
                    const articleDataForService = {
                        ...coreSanitizedData,
                        member_id: user.id,
                        tagNames: body.tagNames
                    };
                    const article = await ArticleService.createArticle(articleDataForService);
                    authSet.status = 201;
                    return article;
                } catch (error: any) {
                    console.error("Error creating article:", error);
                    if (error instanceof ValidationError) {
                        authSet.status = 400;
                        return { error: 'Validation Error', message: error.message };
                    } else if (error instanceof DatabaseError && error.message.includes('slug')) {
                        authSet.status = 409;
                        return { error: 'Conflict', message: 'Article slug already exists.' };
                    } else {
                        authSet.status = 500;
                        return { error: 'Internal Server Error', message: error.message || 'Failed to create article.' };
                    }
                }
            })(context as any);
        },
        {
            body: articleInputSchema,
            detail: {
                tags: ['articles'],
                description: 'Create a new article',
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
        }
    )
    .put('/:slug', 
        async (context: ElysiaBaseContext & { params: { slug: string }, body: Partial<ArticleInputData>}) => {
            const { params, body, request, set } = context;
            return requireAuthor(async ({ user, set: authSet, member }: AuthenticatedContext) => {
                try {
                    const updatePayload: Partial<ArticleDbUpdate> = {};
                    if (body.title !== undefined) updatePayload.title = sanitizeTitle(body.title);
                    if (body.description !== undefined) updatePayload.description = sanitizeDescription(body.description);
                    else if (body.hasOwnProperty('description') && body.description === null) updatePayload.description = null;
                    if (body.content !== undefined) updatePayload.content = sanitizeContent(body.content);
                    if (body.tagNames !== undefined) updatePayload.tagNames = body.tagNames;

                    const hasMeaningfulUpdateInput = Object.keys(updatePayload).some(key => 
                        key !== 'tagNames' && (updatePayload as any)[key] !== undefined
                    ) || (updatePayload.tagNames !== undefined && updatePayload.tagNames !== null);

                    if (!hasMeaningfulUpdateInput) {
                        const currentArticle = await ArticleService.getArticleBySlug(params.slug, { id: user.id });
                        if (!currentArticle) {
                            authSet.status = 404;
                            return { error: 'Not found', message: 'Article to update not found.' };
                        }
                        return currentArticle;
                    }

                    const updatedArticle = await ArticleService.updateArticle(params.slug, updatePayload, user.id);
                    return updatedArticle;
                } catch (error: any) {
                    console.error(`Error updating article ${params.slug}:`, error);
                    if (error instanceof ValidationError) {
                        authSet.status = 400;
                        return { error: 'Validation Error', message: error.message };
                    } else if (error instanceof NotFoundError) {
                        authSet.status = 404;
                        return { error: 'Not Found', message: error.message };
                    } else if (error instanceof ForbiddenError) {
                        authSet.status = 403;
                        return { error: 'Forbidden', message: error.message };
                    } else {
                        authSet.status = 500;
                        return { error: 'Internal Server Error', message: error.message || 'Failed to update article.' };
                    }
                }
            })(context as any);
        },
        {
            params: t.Object({ slug: t.String() }),
            body: t.Partial(articleInputSchema),
            detail: {
                tags: ['articles'],
                description: 'Update an existing article',
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
        }
    )
    .delete('/:slug', 
        async (context: ElysiaBaseContext & { params: { slug: string }}) => {
            const { params, request, set } = context;
            return requireAuthor(async ({ user, set: authSet, member }: AuthenticatedContext) => {
                try {
                    await ArticleService.deleteArticle(params.slug, user.id);
                    authSet.status = 204;
                    return null; 
                } catch (error: any) {
                    console.error(`Error deleting article ${params.slug}:`, error);
                    if (error instanceof NotFoundError) {
                        authSet.status = 404;
                        return { error: 'Not Found', message: error.message };
                    } else if (error instanceof ForbiddenError) {
                        authSet.status = 403;
                        return { error: 'Forbidden', message: error.message };
                    } else {
                        authSet.status = 500;
                        return { error: 'Internal Server Error', message: error.message || 'Failed to delete article.' };
                    }
                }
            })(context as any);
        },
        {
            params: t.Object({ slug: t.String() }),
            detail: {
                tags: ['articles'],
                description: 'Delete an article',
                security: [{ bearerAuth: [] }],
                responses: {
                    '204': {
                        description: 'Article deleted successfully'
                    },
                    ...commonErrorResponses
                }
            }
        }
    );
