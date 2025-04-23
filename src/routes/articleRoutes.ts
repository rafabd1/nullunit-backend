import { Elysia } from 'elysia';
import { ArticleService } from '../services/articleService';
import { auth, requireAuthor } from '../middlewares/auth';
import { sanitizeModuleData, sanitizeSubArticleData } from '../utils/articleSanitizer';
import { RouteContext, AuthenticatedContext } from '../types/routes';
import { ModuleInputData, SubArticleInputData } from '../types/articleTypes';
import { 
    articleModuleSchema, 
    subArticleSchema, 
    moduleInputSchema, 
    subArticleInputSchema,
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
            const modules = await ArticleService.getAllModules();
            return modules;
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
            summary: 'Get all article modules',
            description: 'Retrieve all article modules with their sub-articles',
            responses: {
                '200': {
                    description: 'List of all article modules',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'array',
                                items: articleModuleSchema
                            }
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .get('/:moduleSlug', async ({ params, set }) => {
        try {
            const module = await ArticleService.getModuleBySlug(params.moduleSlug);
            if (!module) {
                set.status = 404;
                return {
                    error: 'Not found',
                    message: 'Article module not found'
                };
            }
            return module;
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
            summary: 'Get article module',
            description: 'Get article module by its slug',
            responses: {
                '200': {
                    description: 'Article module details',
                    content: {
                        'application/json': {
                            schema: articleModuleSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .get('/:moduleSlug/:articleSlug', async ({ params, set }) => {
        try {
            const article = await ArticleService.getSubArticleBySlug(params.moduleSlug, params.articleSlug);
            if (!article) {
                set.status = 404;
                return {
                    error: 'Not found',
                    message: 'Sub-article not found'
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
            summary: 'Get sub-article',
            description: 'Get sub-article by its slug and parent module slug',
            responses: {
                '200': {
                    description: 'Sub-article details',
                    content: {
                        'application/json': {
                            schema: subArticleSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .post('/', async ({ body, request, set }: RouteContext & { body: ModuleInputData }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const sanitizedData = sanitizeModuleData(body);
                const module = await ArticleService.createModule({
                    ...sanitizedData,
                    member_id: user.id
                });
                set.status = 201;
                return module;
            } catch (error) {
                set.status = 400;
                return {
                    error: 'Validation failed',
                    message: error instanceof Error ? error.message : 'Invalid input data'
                };
            }
        })({ body, request, set });
    }, {
        body: moduleInputSchema,
        detail: {
            tags: ['articles'],
            summary: 'Create article module',
            description: 'Create new article module (requires author permission)',
            security: [{ bearerAuth: [] }],
            responses: {
                '201': {
                    description: 'Article module created',
                    content: {
                        'application/json': {
                            schema: articleModuleSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .post('/:moduleSlug/articles', async ({ params, body, request, set }: RouteContext & { 
        params: { moduleSlug: string }, 
        body: SubArticleInputData 
    }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const module = await ArticleService.getModuleBySlug(params.moduleSlug);
                if (!module) {
                    set.status = 404;
                    return {
                        error: 'Not found',
                        message: 'Article module not found'
                    };
                }

                if (module.member_id !== user.id) {
                    set.status = 403;
                    return {
                        error: 'Forbidden',
                        message: 'You can only add articles to your own modules'
                    };
                }

                const sanitizedData = sanitizeSubArticleData(body);
                const subArticle = await ArticleService.createSubArticle({
                    ...sanitizedData,
                    module_id: module.id
                });

                set.status = 201;
                return subArticle;
            } catch (error) {
                set.status = 400;
                return {
                    error: 'Validation failed',
                    message: error instanceof Error ? error.message : 'Invalid input data'
                };
            }
        })({ params, body, request, set });
    }, {
        body: subArticleInputSchema,
        detail: {
            tags: ['articles'],
            summary: 'Create sub-article',
            description: 'Create new sub-article in a module (requires author permission)',
            security: [{ bearerAuth: [] }],
            responses: {
                '201': {
                    description: 'Sub-article created',
                    content: {
                        'application/json': {
                            schema: subArticleSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .put('/:moduleSlug', async ({ params, body, request, set }: RouteContext & { 
        params: { moduleSlug: string }, 
        body: ModuleInputData 
    }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const module = await ArticleService.getModuleBySlug(params.moduleSlug);
                if (!module) {
                    set.status = 404;
                    return {
                        error: 'Not found',
                        message: 'Article module not found'
                    };
                }

                if (module.member_id !== user.id) {
                    set.status = 403;
                    return {
                        error: 'Forbidden',
                        message: 'You can only update your own modules'
                    };
                }

                const sanitizedData = sanitizeModuleData(body);
                const updatedModule = await ArticleService.updateModule(module.id, sanitizedData);
                return updatedModule;
            } catch (error) {
                set.status = 400;
                return {
                    error: 'Update failed',
                    message: error instanceof Error ? error.message : 'Invalid input data'
                };
            }
        })({ params, body, request, set });
    }, {
        body: moduleInputSchema,
        detail: {
            tags: ['articles'],
            summary: 'Update article module',
            description: 'Update an existing article module (requires author permission)',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Module updated successfully',
                    content: {
                        'application/json': {
                            schema: articleModuleSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .put('/:moduleSlug/:articleSlug', async ({ params, body, request, set }: RouteContext & { 
        params: { moduleSlug: string; articleSlug: string }, 
        body: SubArticleInputData 
    }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const module = await ArticleService.getModuleBySlug(params.moduleSlug);
                if (!module) {
                    set.status = 404;
                    return {
                        error: 'Not found',
                        message: 'Article module not found'
                    };
                }

                if (module.member_id !== user.id) {
                    set.status = 403;
                    return {
                        error: 'Forbidden',
                        message: 'You can only update articles in your own modules'
                    };
                }

                const article = await ArticleService.getSubArticleBySlug(params.moduleSlug, params.articleSlug);
                if (!article) {
                    set.status = 404;
                    return {
                        error: 'Not found',
                        message: 'Sub-article not found'
                    };
                }

                const sanitizedData = sanitizeSubArticleData(body);
                const updatedArticle = await ArticleService.updateSubArticle(article.id, sanitizedData);
                return updatedArticle;
            } catch (error) {
                set.status = 400;
                return {
                    error: 'Update failed',
                    message: error instanceof Error ? error.message : 'Invalid input data'
                };
            }
        })({ params, body, request, set });
    }, {
        body: subArticleInputSchema,
        detail: {
            tags: ['articles'],
            summary: 'Update sub-article',
            description: 'Update an existing sub-article (requires author permission)',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Sub-article updated successfully',
                    content: {
                        'application/json': {
                            schema: subArticleSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .delete('/:moduleSlug', async ({ params, request, set }: RouteContext & { params: { moduleSlug: string } }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const module = await ArticleService.getModuleBySlug(params.moduleSlug);
                if (!module) {
                    set.status = 404;
                    return {
                        error: 'Not found',
                        message: 'Article module not found'
                    };
                }

                if (module.member_id !== user.id) {
                    set.status = 403;
                    return {
                        error: 'Forbidden',
                        message: 'You can only delete your own modules'
                    };
                }

                await ArticleService.deleteModule(module.id);
                set.status = 204;
                return null;
            } catch (error) {
                set.status = 500;
                return {
                    error: 'Delete failed',
                    message: error instanceof Error ? error.message : 'Failed to delete module'
                };
            }
        })({ params, request, set });
    }, {
        detail: {
            tags: ['articles'],
            summary: 'Delete article module',
            description: 'Delete an article module and all its sub-articles (requires author permission)',
            security: [{ bearerAuth: [] }],
            responses: {
                '204': {
                    description: 'Module deleted successfully'
                },
                ...commonErrorResponses
            }
        }
    })
    .delete('/:moduleSlug/:articleSlug', async ({ params, request, set }: RouteContext & { 
        params: { moduleSlug: string; articleSlug: string } 
    }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const module = await ArticleService.getModuleBySlug(params.moduleSlug);
                if (!module) {
                    set.status = 404;
                    return {
                        error: 'Not found',
                        message: 'Article module not found'
                    };
                }

                if (module.member_id !== user.id) {
                    set.status = 403;
                    return {
                        error: 'Forbidden',
                        message: 'You can only delete articles from your own modules'
                    };
                }

                const article = await ArticleService.getSubArticleBySlug(params.moduleSlug, params.articleSlug);
                if (!article) {
                    set.status = 404;
                    return {
                        error: 'Not found',
                        message: 'Sub-article not found'
                    };
                }

                await ArticleService.deleteSubArticle(article.id);
                set.status = 204;
                return null;
            } catch (error) {
                set.status = 500;
                return {
                    error: 'Delete failed',
                    message: error instanceof Error ? error.message : 'Failed to delete sub-article'
                };
            }
        })({ params, request, set });
    }, {
        detail: {
            tags: ['articles'],
            summary: 'Delete sub-article',
            description: 'Delete a sub-article (requires author permission)',
            security: [{ bearerAuth: [] }],
            responses: {
                '204': {
                    description: 'Sub-article deleted successfully'
                },
                ...commonErrorResponses
            }
        }
    });
