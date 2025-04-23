import { Elysia, t } from 'elysia';
import { ArticleService } from '../services/articleService';
import { auth } from '../middlewares/auth';
import { sanitizeModuleData, sanitizeSubArticleData } from '../utils/articleSanitizer';
import { RouteContext, AuthenticatedContext } from '../types/routes';
import { ModuleInputData, SubArticleInputData } from '../types/articleTypes';
import { articleModuleSchema, subArticleSchema, moduleInputSchema, subArticleInputSchema } from '../schemas/articleSchemas';

export const articleRoutes = new Elysia({ prefix: '/articles' })
    .get('/', async () => {
        return await ArticleService.getAllModules();
    }, {
        detail: {
            tags: ['articles'],
            description: 'Get all article modules',
            responses: {
                '200': {
                    description: 'List of all article modules',
                    content: {
                        'application/json': {
                            schema: t.Array(articleModuleSchema)
                        }
                    }
                }
            }
        }
    })
    .get('/:moduleSlug', async ({ params }: RouteContext & { 
        params: { moduleSlug: string } 
    }) => {
        return await ArticleService.getModuleBySlug(params.moduleSlug);
    }, {
        detail: {
            tags: ['articles'],
            description: 'Get article module by slug',
            responses: {
                '200': {
                    description: 'Article module details',
                    content: {
                        'application/json': {
                            schema: articleModuleSchema
                        }
                    }
                }
            }
        }
    })
    .get('/:moduleSlug/:articleSlug', async ({ params }: RouteContext & { 
        params: { moduleSlug: string; articleSlug: string } 
    }) => {
        return await ArticleService.getSubArticle(params.moduleSlug, params.articleSlug);
    }, {
        detail: {
            tags: ['articles'],
            description: 'Get sub-article by slug',
            responses: {
                '200': {
                    description: 'Sub-article details',
                    content: {
                        'application/json': {
                            schema: subArticleSchema
                        }
                    }
                }
            }
        }
    })
    .post('/', async ({ body, request, set }: RouteContext & { 
        body: ModuleInputData 
    }) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
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
    }, {
        body: moduleInputSchema,
        detail: {
            tags: ['articles'],
            description: 'Create new article module',
            security: [{ bearerAuth: [] }],
            responses: {
                '201': {
                    description: 'Article module created successfully',
                    content: {
                        'application/json': {
                            schema: articleModuleSchema
                        }
                    }
                }
            }
        }
    })
    .post('/:moduleSlug/articles', async ({ params, body, request, set }: RouteContext & { 
        params: { moduleSlug: string }, 
        body: SubArticleInputData 
    }) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
            try {
                const currentModule = await ArticleService.getModuleBySlug(params.moduleSlug);
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
    }, {
        body: subArticleInputSchema,
        detail: {
            tags: ['articles'],
            description: 'Create new sub-article',
            security: [{ bearerAuth: [] }],
            responses: {
                '201': {
                    description: 'Sub-article created successfully',
                    content: {
                        'application/json': {
                            schema: subArticleSchema
                        }
                    }
                }
            }
        }
    })
    .put('/:moduleSlug', async ({ params, body, request, set }: RouteContext & { 
        params: { moduleSlug: string }, 
        body: ModuleInputData 
    }) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
            try {
                const currentModule = await ArticleService.getModuleBySlug(params.moduleSlug);
                if (currentModule.member_id !== user.id) {
                    set.status = 403;
                    return { error: 'Forbidden: You can only update your own modules' };
                }

                const sanitizedData = sanitizeModuleData(body);
                const module = await ArticleService.updateModule(params.moduleSlug, sanitizedData);
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
    }, {
        body: moduleInputSchema,
        detail: {
            tags: ['articles'],
            description: 'Update article module',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Article module updated successfully',
                    content: {
                        'application/json': {
                            schema: articleModuleSchema
                        }
                    }
                }
            }
        }
    })
    .put('/:moduleSlug/:articleSlug', async ({ params, body, request, set }: RouteContext & { 
        params: { moduleSlug: string; articleSlug: string }, 
        body: SubArticleInputData 
    }) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
            try {
                const currentArticle = await ArticleService.getSubArticle(params.moduleSlug, params.articleSlug);
                if (currentArticle.author_id !== user.id) {
                    set.status = 403;
                    return { error: 'Forbidden: You can only update your own articles' };
                }

                const sanitizedData = sanitizeSubArticleData(body);
                const article = await ArticleService.updateSubArticle(
                    params.moduleSlug,
                    params.articleSlug,
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
    }, {
        body: subArticleInputSchema,
        detail: {
            tags: ['articles'],
            description: 'Update sub-article',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Sub-article updated successfully',
                    content: {
                        'application/json': {
                            schema: subArticleSchema
                        }
                    }
                }
            }
        }
    })
    .delete('/:moduleSlug', async ({ params, request, set }: RouteContext & { 
        params: { moduleSlug: string } 
    }) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
            try {
                const currentModule = await ArticleService.getModuleBySlug(params.moduleSlug);
                if (currentModule.member_id !== user.id) {
                    set.status = 403;
                    return { error: 'Forbidden: You can only delete your own modules' };
                }

                await ArticleService.deleteModule(params.moduleSlug);
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
    }, {
        detail: {
            tags: ['articles'],
            description: 'Delete article module',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Article module deleted successfully',
                    content: {
                        'application/json': {
                            schema: t.Object({
                                status: t.String(),
                                message: t.String(),
                                timestamp: t.String({ format: 'date-time' })
                            })
                        }
                    }
                }
            }
        }
    })
    .delete('/:moduleSlug/:articleSlug', async ({ params, request, set }: RouteContext & { 
        params: { moduleSlug: string; articleSlug: string } 
    }) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
            try {
                const currentArticle = await ArticleService.getSubArticle(params.moduleSlug, params.articleSlug);
                if (currentArticle.author_id !== user.id) {
                    set.status = 403;
                    return { error: 'Forbidden: You can only delete your own articles' };
                }

                await ArticleService.deleteSubArticle(params.moduleSlug, params.articleSlug);
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
    }, {
        detail: {
            tags: ['articles'],
            description: 'Delete sub-article',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Sub-article deleted successfully',
                    content: {
                        'application/json': {
                            schema: t.Object({
                                status: t.String(),
                                message: t.String(),
                                timestamp: t.String({ format: 'date-time' })
                            })
                        }
                    }
                }
            }
        }
    });
