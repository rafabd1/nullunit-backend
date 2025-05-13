// src/schemas/articleSchemas.ts
import { t } from 'elysia';
import { tagSchema } from './tagSchemas'; // Importar tagSchema

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
    tags: t.Optional(t.Array(tagSchema)), // Tags associadas
    sub_articles: t.Optional(t.Array(t.Object({
        id: t.String(),
        module_id: t.String(),
        slug: t.String(),
        title: t.String(),
        content: t.String(),
        created_at: t.String(),
        updated_at: t.Optional(t.String()),
        tags: t.Optional(t.Array(tagSchema)) // Tags associadas ao sub-artigo dentro do módulo
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
    updated_at: t.Optional(t.String()),
    tags: t.Optional(t.Array(tagSchema)) // Tags associadas
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
    tagNames: t.Optional(t.Array(t.String({
        minLength: 2,
        maxLength: 50,
        description: 'Tag name (2-50 characters)'
    }), { 
        minItems: 0, 
        maxItems: 10, 
        description: 'List of tag names (0-10 tags)' 
    })),
    // slug: t.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', minLength: 3, maxLength: 100 }), // Removido
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
    tagNames: t.Optional(t.Array(t.String({
        minLength: 2,
        maxLength: 50,
        description: 'Tag name (2-50 characters)'
    }), { 
        minItems: 0, 
        maxItems: 10, 
        description: 'List of tag names (0-10 tags)' 
    })),
    // slug: t.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', minLength: 3, maxLength: 150 }), // Removido
});

/**
 * Schema for error responses
 */
export const errorSchema = t.Object({
    error: t.String(),
    message: t.String()
});
