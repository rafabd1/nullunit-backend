import { Elysia, t } from 'elysia';
import { ArticleService } from '../services/articleService';
import { auth } from '../middlewares/auth';
import { sanitizeModuleData, sanitizeSubArticleData } from '../utils/articleSanitizer';

export const articleRoutes = new Elysia({ prefix: '/articles' })
    .model({
        articleModule: t.Object({
            id: t.String(),
            member_id: t.String(),
            slug: t.String(),
            title: t.String(),
            description: t.Optional(t.String()),
            created_at: t.String(),
            updated_at: t.String()
        }),
        subArticle: t.Object({
            id: t.String(),
            module_id: t.String(),
            author_id: t.String(),
            slug: t.String(),
            title: t.String(),
            content: t.String(),
            published_date: t.String(),
            created_at: t.String(),
            updated_at: t.String()
        }),
        moduleInput: t.Object({
            title: t.String({ minLength: 3, maxLength: 100 }),
            description: t.Optional(t.String({ maxLength: 500 })),
            slug: t.Optional(t.String())
        }),
        subArticleInput: t.Object({
            title: t.String({ minLength: 3, maxLength: 100 }),
            content: t.String({ minLength: 50 }),
            slug: t.Optional(t.String())
        })
    })
    .get('/', {
        detail: {
            tags: ['articles'],
            description: 'Get all article modules',
            responses: {
                '200': {
                    description: 'List of all article modules',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'array',
                                items: { $ref: '#/components/schemas/articleModule' }
                            }
                        }
                    }
                }
            }
        },
        handler: async () => {
            return await ArticleService.getAllModules();
        }
    })
    .get('/:moduleSlug', {
        detail: {
            tags: ['articles'],
            description: 'Get article module by slug',
            responses: {
                '200': {
                    description: 'Article module details',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/articleModule' }
                        }
                    }
                },
                '404': {
                    description: 'Article module not found'
                }
            }
        },
        handler: async ({ params: { moduleSlug } }) => {
            return await ArticleService.getModuleBySlug(moduleSlug);
        }
    })
    .get('/:moduleSlug/:articleSlug', {
        detail: {
            tags: ['articles'],
            description: 'Get sub-article by slug',
            responses: {
                '200': {
                    description: 'Sub-article details',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/subArticle' }
                        }
                    }
                },
                '404': {
                    description: 'Sub-article not found'
                }
            }
        },
        handler: async ({ params: { moduleSlug, articleSlug } }) => {
            return await ArticleService.getSubArticle(moduleSlug, articleSlug);
        }
    })
    .post('/', {
        detail: {
            tags: ['articles'],
            description: 'Create new article module',
            security: [{ bearerAuth: [] }],
            responses: {
                '201': {
                    description: 'Article module created successfully',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/articleModule' }
                        }
                    }
                },
                '400': {
                    description: 'Invalid input data'
                },
                '401': {
                    description: 'Unauthorized'
                }
            }
        },
        body: 'moduleInput',
        handler: async ({ body, request, set }) => {
            return auth(async ({ user, set }) => {
                try {
                    const sanitizedData = sanitizeModuleData(body);
                    const module = await ArticleService.createModule({
                        ...sanitizedData,
                        member_id: user.id
                    });

                    set.status = 201;
                    return module;
                } catch (validationError: unknown) {
                    set.status = 400;
                    return {
                        error: 'Validation failed',
                        message: validationError instanceof Error ?
                            validationError.message : 'Invalid input data'
                    };
                }
            })({ body, request, set });
        }
    })
    .post('/:moduleSlug/articles', {
        detail: {
            tags: ['articles'],
            description: 'Create new sub-article',
            security: [{ bearerAuth: [] }],
            responses: {
                '201': {
                    description: 'Sub-article created successfully',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/subArticle' }
                        }
                    }
                },
                '400': {
                    description: 'Invalid input data'
                },
                '401': {
                    description: 'Unauthorized'
                },
                '403': {
                    description: 'Forbidden - Can only add articles to own modules'
                }
            }
        },
        body: 'subArticleInput',
        handler: async ({ params: { moduleSlug }, body, request, set }) => {
            return auth(async ({ user, set }) => {
                try {
                    const currentModule = await ArticleService.getModuleBySlug(moduleSlug);
                    if (currentModule.member_id !== user.id) {
                        set.status = 403;
                        return { error: 'Forbidden: You can only add articles to your own modules' };
                    }

                    const sanitizedData = sanitizeSubArticleData(body);
                    const article = await ArticleService.createSubArticle({
                        ...sanitizedData,
                        module_id: currentModule.id,
                        author_id: user.id
                    });

                    set.status = 201;
                    return article;
                } catch (validationError: unknown) {
                    set.status = 400;
                    return {
                        error: 'Validation failed',
                        message: validationError instanceof Error ?
                            validationError.message : 'Invalid input data'
                    };
                }
            })({ body, request, set });
        }
    })
    .put('/:moduleSlug', {
        detail: {
            tags: ['articles'],
            description: 'Update article module',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Article module updated successfully',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/articleModule' }
                        }
                    }
                },
                '400': {
                    description: 'Invalid input data'
                },
                '401': {
                    description: 'Unauthorized'
                },
                '403': {
                    description: 'Forbidden - Can only update own modules'
                }
            }
        },
        body: 'moduleInput',
        handler: async ({ params: { moduleSlug }, body, request, set }) => {
            return auth(async ({ user, set }) => {
                try {
                    const currentModule = await ArticleService.getModuleBySlug(moduleSlug);
                    if (currentModule.member_id !== user.id) {
                        set.status = 403;
                        return { error: 'Forbidden: You can only update your own modules' };
                    }

                    const sanitizedData = sanitizeModuleData(body);
                    const module = await ArticleService.updateModule(moduleSlug, sanitizedData);
                    return module;
                } catch (validationError: unknown) {
                    set.status = 400;
                    return {
                        error: 'Validation failed',
                        message: validationError instanceof Error ?
                            validationError.message : 'Invalid input data'
                    };
                }
            })({ body, request, set });
        }
    })
    .put('/:moduleSlug/:articleSlug', {
        detail: {
            tags: ['articles'],
            description: 'Update sub-article',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Sub-article updated successfully',
                    content: {
                        'application/json': {
                            schema: { $ref: '#/components/schemas/subArticle' }
                        }
                    }
                },
                '400': {
                    description: 'Invalid input data'
                },
                '401': {
                    description: 'Unauthorized'
                },
                '403': {
                    description: 'Forbidden - Can only update own articles'
                }
            }
        },
        body: 'subArticleInput',
        handler: async ({ params: { moduleSlug, articleSlug }, body, request, set }) => {
            return auth(async ({ user, set }) => {
                try {
                    const currentArticle = await ArticleService.getSubArticle(moduleSlug, articleSlug);
                    if (currentArticle.author_id !== user.id) {
                        set.status = 403;
                        return { error: 'Forbidden: You can only update your own articles' };
                    }

                    const sanitizedData = sanitizeSubArticleData(body);
                    const article = await ArticleService.updateSubArticle(
                        moduleSlug,
                        articleSlug,
                        sanitizedData
                    );
                    return article;
                } catch (validationError: unknown) {
                    set.status = 400;
                    return {
                        error: 'Validation failed',
                        message: validationError instanceof Error ?
                            validationError.message : 'Invalid input data'
                    };
                }
            })({ body, request, set });
        }
    })
    .delete('/:moduleSlug', {
        detail: {
            tags: ['articles'],
            description: 'Delete article module',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Article module deleted successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    status: { type: 'string' },
                                    message: { type: 'string' },
                                    timestamp: { type: 'string', format: 'date-time' }
                                }
                            }
                        }
                    }
                },
                '401': {
                    description: 'Unauthorized'
                },
                '403': {
                    description: 'Forbidden - Can only delete own modules'
                }
            }
        },
        handler: async ({ params: { moduleSlug }, request, set }) => {
            return auth(async ({ user, set }) => {
                try {
                    const currentModule = await ArticleService.getModuleBySlug(moduleSlug);
                    if (currentModule.member_id !== user.id) {
                        set.status = 403;
                        return { error: 'Forbidden: You can only delete your own modules' };
                    }

                    await ArticleService.deleteModule(moduleSlug);
                    return {
                        status: 'success',
                        message: 'Article module deleted successfully',
                        timestamp: new Date().toISOString()
                    };
                } catch (error) {
                    set.status = 500;
                    return { error: 'Failed to delete module' };
                }
            })({ request, set });
        }
    })
    .delete('/:moduleSlug/:articleSlug', {
        detail: {
            tags: ['articles'],
            description: 'Delete sub-article',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Sub-article deleted successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    status: { type: 'string' },
                                    message: { type: 'string' },
                                    timestamp: { type: 'string', format: 'date-time' }
                                }
                            }
                        }
                    }
                },
                '401': {
                    description: 'Unauthorized'
                },
                '403': {
                    description: 'Forbidden - Can only delete own articles'
                }
            }
        },
        handler: async ({ params: { moduleSlug, articleSlug }, request, set }) => {
            return auth(async ({ user, set }) => {
                try {
                    const currentArticle = await ArticleService.getSubArticle(moduleSlug, articleSlug);
                    if (currentArticle.author_id !== user.id) {
                        set.status = 403;
                        return { error: 'Forbidden: You can only delete your own articles' };
                    }

                    await ArticleService.deleteSubArticle(moduleSlug, articleSlug);
                    return {
                        status: 'success',
                        message: 'Article deleted successfully',
                        timestamp: new Date().toISOString()
                    };
                } catch (error) {
                    set.status = 500;
                    return { error: 'Failed to delete article' };
                }
            })({ request, set });
        }
    });
