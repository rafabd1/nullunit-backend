import { t } from 'elysia';

// Schema para a resposta de um projeto individual
export const portfolioSchema = t.Object({
    id: t.String({ format: 'uuid', description: 'Project unique identifier' }),
    member_id: t.String({ format: 'uuid', description: 'Author member ID' }),
    created_at: t.String({ format: 'date-time', description: 'Creation timestamp' }),
    updated_at: t.Nullable(t.String({ format: 'date-time', description: 'Last update timestamp' })),
    slug: t.String({ description: 'URL-friendly unique slug' }),
    title: t.String({ description: 'Project title' }),
    description: t.Nullable(t.String({ description: 'Project description' })),
    repo_url: t.Nullable(t.String({ format: 'uri', description: 'Repository URL' }))
    // Se adicionar dados do autor:
    // author: t.Optional(t.Object({
    //     username: t.String(),
    //     avatar_url: t.Optional(t.String({ format: 'uri' }))
    // }))
});

// Schema para a entrada de criação
export const portfolioInputSchema = t.Object({
    title: t.String({
        minLength: 3,
        maxLength: 100,
        description: 'Project title (3-100 characters)'
    }),
    description: t.Optional(t.String({
        maxLength: 5000,
        description: 'Project description (max 5000 characters)'
    })),
    repo_url: t.Optional(t.String({
        format: 'uri',
        maxLength: 2048,
        description: 'Project repository URL'
    }))
    // Slug será gerado automaticamente a partir do título ou fornecido?
    // Se fornecido:
    // slug: t.String({ pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', minLength: 3, maxLength: 100, description: 'URL slug (lowercase, numbers, hyphens)' })
});

// Schema para a entrada de atualização
export const portfolioUpdateSchema = t.Partial(portfolioInputSchema, {
    // Tornar todos os campos opcionais para atualização
    description: 'Update project data. All fields are optional.'
});

// Schema para a resposta de erro (podemos reutilizar um global se existir)
export const portfolioErrorSchema = t.Object({
    error: t.String({ description: 'Error message' }),
    details: t.Optional(t.String({ description: 'Optional error details' }))
}); 