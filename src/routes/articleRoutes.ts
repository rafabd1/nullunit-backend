import { Elysia, t } from 'elysia';
import { ArticleService } from '../services/articleService';
import { auth } from '../middlewares/auth';
import { sanitizeModuleData, sanitizeSubArticleData } from '../utils/articleSanitizer';
import { User } from '@supabase/supabase-js';

interface RouteContext {
    params?: {
        moduleSlug?: string;
        articleSlug?: string;
    };
    body?: Record<string, any>;
    request: Request;
    set: {
        status: number;
    };
}

interface CreateModuleBody {
    title: string;
    description?: string;
    slug?: string;
}

interface CreateSubArticleBody {
    title: string;
    content: string;
    slug?: string;
}

interface UpdateModuleBody {
    title?: string;
    description?: string;
    slug?: string;
}

interface UpdateSubArticleBody {
    title?: string;
    content?: string;
    slug?: string;
}

/**
 * @description Article routes with authentication and validation
 */
export const articleRoutes = new Elysia({ prefix: '/articles' })
    .get('/', async () => {
        return await ArticleService.getAllModules();
    })
    .get('/:moduleSlug', async ({ params: { moduleSlug } }: { params: { moduleSlug: string } }) => {
        return await ArticleService.getModuleBySlug(moduleSlug);
    })
    .get('/:moduleSlug/:articleSlug', async ({ 
        params: { moduleSlug, articleSlug } 
    }: { 
        params: { moduleSlug: string; articleSlug: string } 
    }) => {
        return await ArticleService.getSubArticle(moduleSlug, articleSlug);
    })
    .post('/', {
        body: t.Object({
            title: t.String({ minLength: 3, maxLength: 100 }),
            description: t.Optional(t.String({ maxLength: 500 })),
            slug: t.Optional(t.String())
        }),
        handler: async ({ 
            body,
            request, 
            set 
        }: RouteContext & { body: CreateModuleBody }) => {
            return auth(async ({ user, set }) => {
                try {
                    const sanitizedData = sanitizeModuleData({
                        title: body.title,
                        description: body.description,
                        slug: body.slug
                    });

                    const module = await ArticleService.createModule({
                        ...sanitizedData,
                        member_id: user.id
                    });

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
    .put('/:moduleSlug', {
        body: t.Object({
            title: t.Optional(t.String({ minLength: 3, maxLength: 100 })),
            description: t.Optional(t.String({ maxLength: 500 })),
            slug: t.Optional(t.String())
        }),
        handler: async ({ 
            params: { moduleSlug }, 
            body, 
            request, 
            set 
        }: RouteContext & { 
            params: { moduleSlug: string }; 
            body: UpdateModuleBody;
        }) => {
            return auth(async ({ user, set }) => {
                try {
                    const currentModule = await ArticleService.getModuleBySlug(moduleSlug);
                    if (currentModule.member_id !== user.id) {
                        set.status = 403;
                        return { error: 'Forbidden: You can only update your own modules' };
                    }

                    const sanitizedData = sanitizeModuleData({
                        title: body.title || currentModule.title,
                        description: body.description,
                        slug: body.slug
                    });

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
    .delete('/:moduleSlug', async ({ 
        params: { moduleSlug }, 
        request, 
        set 
    }: RouteContext & { 
        params: { moduleSlug: string }
    }) => {
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
    })
    .post('/:moduleSlug/articles', {
        body: t.Object({
            title: t.String({ minLength: 3, maxLength: 100 }),
            content: t.String({ minLength: 50 }),
            slug: t.Optional(t.String())
        }),
        handler: async ({ 
            params: { moduleSlug }, 
            body, 
            request, 
            set 
        }: RouteContext & { 
            params: { moduleSlug: string }; 
            body: CreateSubArticleBody;
        }) => {
            return auth(async ({ user, set }) => {
                try {
                    const currentModule = await ArticleService.getModuleBySlug(moduleSlug);
                    if (currentModule.member_id !== user.id) {
                        set.status = 403;
                        return { error: 'Forbidden: You can only add articles to your own modules' };
                    }

                    const sanitizedData = sanitizeSubArticleData({
                        title: body.title,
                        content: body.content,
                        slug: body.slug
                    });

                    const article = await ArticleService.createSubArticle({
                        ...sanitizedData,
                        module_id: currentModule.id,
                        author_id: user.id
                    });

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
    .put('/:moduleSlug/:articleSlug', {
        body: t.Object({
            title: t.Optional(t.String({ minLength: 3, maxLength: 100 })),
            content: t.Optional(t.String({ minLength: 50 })),
            slug: t.Optional(t.String())
        }),
        handler: async ({ 
            params: { moduleSlug, articleSlug }, 
            body, 
            request, 
            set 
        }: RouteContext & { 
            params: { moduleSlug: string; articleSlug: string }; 
            body: UpdateSubArticleBody;
        }) => {
            return auth(async ({ user, set }) => {
                try {
                    const currentArticle = await ArticleService.getSubArticle(moduleSlug, articleSlug);
                    if (currentArticle.author_id !== user.id) {
                        set.status = 403;
                        return { error: 'Forbidden: You can only update your own articles' };
                    }

                    if (!body.title && !body.content && !body.slug) {
                        set.status = 400;
                        return { error: 'At least one field must be provided for update' };
                    }

                    const sanitizedData = sanitizeSubArticleData({
                        title: body.title || currentArticle.title,
                        content: body.content || currentArticle.content,
                        slug: body.slug
                    });

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
    .delete('/:moduleSlug/:articleSlug', async ({ 
        params: { moduleSlug, articleSlug }, 
        request, 
        set 
    }: RouteContext & { 
        params: { moduleSlug: string; articleSlug: string } 
    }) => {
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
    });
