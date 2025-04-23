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
    created_at: t.String({ format: 'date-time' }), // Use format for clarity
    updated_at: t.String({ format: 'date-time' })  // Use format for clarity
});

/**
 * Schema for the Sub-Article data returned by the API.
 */
export const subArticleSchema = t.Object({
    id: t.String(),
    module_id: t.String(),
    author_id: t.String(),
    slug: t.String(),
    title: t.String(),
    content: t.String(), // Consider if there's a max length
    published_date: t.String({ format: 'date-time' }), // Use format for clarity
    created_at: t.String({ format: 'date-time' }),
    updated_at: t.String({ format: 'date-time' })
});

/**
 * Schema for validating input when creating or updating an Article Module.
 */
export const moduleInputSchema = t.Object({
    title: t.String({ minLength: 3, maxLength: 100 }),
    description: t.Optional(t.String({ maxLength: 500 })),
    // Slug is usually generated, but allow optional input if needed for specific cases
    slug: t.Optional(t.RegExp(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        error: 'Slug must be lowercase alphanumeric with hyphens'
    }))
});

/**
 * Schema for validating input when creating or updating a Sub-Article.
 */
export const subArticleInputSchema = t.Object({
    title: t.String({ minLength: 3, maxLength: 150 }), // Increased title length
    content: t.String({ minLength: 50 }), // Ensure content has some substance
    // Slug is usually generated, but allow optional input
    slug: t.Optional(t.RegExp(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
        error: 'Slug must be lowercase alphanumeric with hyphens'
    }))
});

// Optional: Schema for update operations if they differ significantly
// export const moduleUpdateSchema = t.Partial(moduleInputSchema);
// export const subArticleUpdateSchema = t.Partial(subArticleInputSchema);
