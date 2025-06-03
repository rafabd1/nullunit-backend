// src/schemas/articleSchemas.ts
import { t } from 'elysia';
import { tagSchema } from './tagSchemas'; // Importar tagSchema

/**
 * Schema for the unified Article data returned by the API.
 */
export const articleSchema = t.Object({
    id: t.String({ format: 'uuid', description: 'Article unique identifier' }),
    member_id: t.String({ format: 'uuid', description: 'Author member ID' }),
    slug: t.String({ description: 'URL-friendly slug' }),
    title: t.String({ description: 'Article title' }),
    description: t.Optional(t.String({ description: 'Optional short description or summary' })),
    content: t.String({ description: 'Full article content (e.g., Markdown)' }),
    created_at: t.String({ format: 'date-time', description: 'Creation timestamp' }),
    updated_at: t.Optional(
        t.String({
            format: 'date-time',
            description: 'Last update timestamp (nullable)',
            nullable: true // Indicação para OpenAPI que o valor pode ser nulo
        })
    ),
    published: t.Boolean({ description: 'Publication status' }),
    verified: t.Boolean({ description: 'Verification status' }),
    tags: t.Optional(t.Array(tagSchema, { description: 'Tags associated with the article' }))
});

/**
 * Schema for validating input when creating or updating an Article.
 */
export const articleInputSchema = t.Object({
    title: t.String({
        minLength: 3,
        maxLength: 150, // Ajustado de 100 para títulos potencialmente mais longos
        description: 'Article title (3-150 characters)'
    }),
    description: t.Optional(t.String({
        maxLength: 500,
        description: 'Optional article description (max 500 characters)'
    })),
    content: t.String({
        minLength: 50, // Manter um mínimo para conteúdo substancial
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
    // published: t.Optional(t.Boolean({...})) // Removido
    // verified: t.Optional(t.Boolean({...}))  // Removido
});

/**
 * Schema for error responses
 */
export const errorSchema = t.Object({
    error: t.String(),
    message: t.String()
});
