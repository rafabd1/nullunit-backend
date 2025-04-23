// src/schemas/articleSchemas.ts
import { t } from 'elysia';

/**
 * Schema for the Article Module data returned by the API.
 */
export const articleModuleSchema = t.Object({
    id: t.String(),
    member_id: t.String(),
    slug: t.String(),
    title: t.String(),
    description: t.Optional(t.String()),
    created_at: t.String(),
    updated_at: t.Optional(t.String()),
    sub_articles: t.Optional(t.Array(t.Object({
        id: t.String(),
        module_id: t.String(),
        slug: t.String(),
        title: t.String(),
        content: t.String(),
        created_at: t.String(),
        updated_at: t.Optional(t.String())
    })))
});

/**
 * Schema for the Sub-Article data returned by the API.
 */
export const subArticleSchema = t.Object({
    id: t.String(),
    module_id: t.String(),
    slug: t.String(),
    title: t.String(),
    content: t.String(),
    created_at: t.String(),
    updated_at: t.Optional(t.String())
});

/**
 * Schema for validating input when creating or updating an Article Module.
 */
export const moduleInputSchema = t.Object({
    title: t.String({ 
        minLength: 3, 
        maxLength: 100,
        description: 'Module title (3-100 characters)'
    }),
    description: t.Optional(t.String({ 
        maxLength: 500,
        description: 'Module description (max 500 characters)'
    })),
    slug: t.Optional(t.RegExp(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        error: 'Slug must be lowercase alphanumeric with hyphens',
        description: 'URL-friendly identifier'
    }))
});

/**
 * Schema for validating input when creating or updating a Sub-Article.
 */
export const subArticleInputSchema = t.Object({
    title: t.String({ 
        minLength: 3, 
        maxLength: 150,
        description: 'Article title (3-150 characters)'
    }),
    content: t.String({ 
        minLength: 50,
        description: 'Article content (minimum 50 characters)'
    }),
    slug: t.Optional(t.RegExp(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        error: 'Slug must be lowercase alphanumeric with hyphens',
        description: 'URL-friendly identifier'
    }))
});

/**
 * Schema for error responses
 */
export const errorSchema = t.Object({
    error: t.String(),
    message: t.String()
});
