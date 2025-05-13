import { Elysia, t } from 'elysia';
import { auth, requireAuthor } from '../middlewares/auth';
import { PortfolioService } from '../services/portfolioService';
import { portfolioInputSchema, portfolioUpdateSchema } from '../schemas/portfolioSchemas';
import { AuthenticatedContext, RouteContext } from '../types/routes';
import { PortfolioInputData, PortfolioUpdateData, PortfolioDbInput } from '../types/portfolioTypes';
import { UserPermission } from '../types/permissions'; // Para checar permissão de AUTHOR

// Mantendo a definição manual que deveria funcionar
const portfolioResponseOpenAPISchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        member_id: { type: 'string' },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time', nullable: true },
        slug: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string', nullable: true },
        repo_url: { type: 'string', format: 'uri', nullable: true }
    },
    required: ['id', 'member_id', 'created_at', 'slug', 'title'],
    additionalProperties: false
};

const deleteSuccessResponseSchema = {
    type: 'object',
    properties: { 
        message: { type: 'string' } 
    },
    required: ['message'],
    additionalProperties: false
};

// Não vamos definir schema de erro por enquanto para simplificar

// Tentar definir os schemas de resposta usando t.* diretamente, 
// mas sem t.Nullable para os campos opcionais. Swagger pode não ser
// 100% preciso sobre nulidade, mas pode evitar o erro de tipo.

const portfolioResponseSchema = t.Object({
    id: t.String(),
    member_id: t.String(),
    created_at: t.String({ format: 'date-time' }), 
    updated_at: t.String({ format: 'date-time' }), // Sem t.Nullable
    slug: t.String(),
    title: t.String(),
    description: t.String(), // Sem t.Nullable
    repo_url: t.String({ format: 'uri' }) // Sem t.Nullable
});

const simpleErrorSchema = t.Object({ 
    error: t.String(),
    details: t.Optional(t.String()) // Usar t.Optional para detalhes
});

export const portfolioRoutes = new Elysia({ prefix: '/portfolio' })
    // GET /api/portfolio - Listar todos os projetos
    .get('/', async ({ set }) => {
        try {
            const projects = await PortfolioService.getAll();
            return projects;
        } catch (error) {
            set.status = 500;
            return { error: 'Failed to fetch portfolio projects' };
        }
    }, {
        detail: {
            tags: ['portfolio'],
            description: 'Retrieves a list of all publicly available portfolio projects.',
            responses: {
                '200': {
                    description: 'A list of portfolio projects',
                    content: { 'application/json': { schema: t.Array(portfolioResponseSchema) } } // Usar schema t.*
                },
                '500': {
                    description: 'Internal server error',
                    content: { 'application/json': { schema: simpleErrorSchema } } // Usar schema t.*
                }
            }
        }
    })
    // GET /api/portfolio/:slug - Obter projeto por slug
    .get('/:slug', async ({ params, set }) => {
        try {
            const project = await PortfolioService.getBySlug(params.slug);
            if (!project) {
                set.status = 404;
                return { error: 'Portfolio project not found' };
            }
            return project;
        } catch (error) {
            set.status = 500;
            return { error: 'Failed to fetch portfolio project' };
        }
    }, {
        params: t.Object({ slug: t.String() }),
        detail: {
            tags: ['portfolio'],
            description: 'Retrieves a specific portfolio project by its unique slug.',
            responses: {
                '200': {
                    description: 'The portfolio project',
                    content: { 'application/json': { schema: portfolioResponseSchema } } // Usar schema t.*
                },
                '404': {
                    description: 'Project not found',
                    content: { 'application/json': { schema: simpleErrorSchema } } // Usar schema t.*
                },
                '500': {
                    description: 'Internal server error',
                    content: { 'application/json': { schema: simpleErrorSchema } } // Usar schema t.*
                }
            }
        }
    })
    // POST /api/portfolio - Criar novo projeto (autenticado, author+)
    .post('/', async ({ body, request, set }: RouteContext & { body: PortfolioInputData }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const dbInput: PortfolioDbInput = {
                    member_id: user.id,
                    title: body.title,
                    description: body.description,
                    repo_url: body.repo_url,
                    slug: '' // Placeholder
                };
                const project = await PortfolioService.create(dbInput as any);
                set.status = 201;
                return project;
            } catch (error) {
                const errorMessage = 'Failed to create portfolio project';
                const errorDetails = error instanceof Error ? error.message : 'Unknown error';
                set.status = error instanceof Error && error.message.includes('duplicate slug') ? 409 :
                             error instanceof Error && error.message.includes('Failed to generate unique slug') ? 500 : 400;
                return { error: errorMessage, details: errorDetails };
            }
        })({ body, request, set });
    }, {
        body: portfolioInputSchema,
        detail: {
            tags: ['portfolio'],
            description: 'Creates a new portfolio project. Requires authentication and author permissions.',
            security: [{ bearerAuth: [] }],
            responses: {
                '201': {
                    description: 'Portfolio project created successfully',
                    content: { 'application/json': { schema: portfolioResponseSchema } } // Usar schema t.*
                },
                '400': {
                    description: 'Invalid input data or failed to create',
                    content: { 'application/json': { schema: simpleErrorSchema } } // Usar schema t.*
                },
                '401': {
                    description: 'Unauthorized',
                    content: { 'application/json': { schema: simpleErrorSchema } } // Usar schema t.*
                },
                '403': {
                    description: 'Forbidden - Insufficient permissions',
                    content: { 'application/json': { schema: simpleErrorSchema } } // Usar schema t.*
                },
                '409': {
                    description: 'Conflict - Slug already exists (try a different title)',
                    content: { 'application/json': { schema: simpleErrorSchema } } // Usar schema t.*
                },
                '500': {
                    description: 'Internal Server Error - Failed to generate unique slug',
                    content: { 'application/json': { schema: simpleErrorSchema } } // Usar schema t.*
                }
            }
        }
    })
    // PUT /api/portfolio/:slug - Atualizar projeto (autenticado, author+, owner)
    .put('/:slug', async ({ params, body, request, set }: RouteContext & { params: { slug: string }, body: PortfolioUpdateData }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const existingProject = await PortfolioService.getBySlug(params.slug);
                if (!existingProject) {
                    set.status = 404;
                    return { error: 'Portfolio project not found' };
                }
                if (existingProject.member_id !== user.id) {
                    set.status = 403;
                    return { error: 'Forbidden: You do not own this project.' };
                }
                const project = await PortfolioService.update(existingProject.id, user.id, body);
                return project;
            } catch (error) {
                const errorMessage = 'Failed to update portfolio project';
                const errorDetails = error instanceof Error ? error.message : 'Unknown error';
                set.status = error instanceof Error && error.message.startsWith('Project not found or user not authorized') ? 404 :
                             error instanceof Error && error.message.startsWith('Attempted to update slug') ? 400 : 400;
                return { error: errorMessage, details: errorDetails };
            }
        })({ request, params, body, set });
    }, {
        params: t.Object({ slug: t.String() }),
        body: portfolioUpdateSchema,
        detail: {
            tags: ['portfolio'],
            description: 'Updates an existing portfolio project. Requires authentication, author permissions, and ownership of the project.',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Portfolio project updated successfully',
                    content: { 'application/json': { schema: portfolioResponseSchema } } // Usar schema t.*
                },
                '400': {
                    description: 'Invalid input data or failed to update',
                    content: { 'application/json': { schema: simpleErrorSchema } } // Usar schema t.*
                },
                '401': {
                    description: 'Unauthorized',
                    content: { 'application/json': { schema: simpleErrorSchema } } // Usar schema t.*
                },
                '403': {
                    description: 'Forbidden - Insufficient permissions or not project owner',
                    content: { 'application/json': { schema: simpleErrorSchema } } // Usar schema t.*
                },
                '404': {
                    description: 'Project not found',
                    content: { 'application/json': { schema: simpleErrorSchema } } // Usar schema t.*
                }
            }
        }
    })
    // DELETE /api/portfolio/:slug - Deletar projeto (autenticado, author+, owner)
    .delete('/:slug', async ({ params, request, set }: RouteContext & { params: { slug: string }}) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const existingProject = await PortfolioService.getBySlug(params.slug);
                if (!existingProject) {
                    set.status = 404;
                    return { error: 'Portfolio project not found' };
                }
                if (existingProject.member_id !== user.id) {
                    set.status = 403;
                    return { error: 'Forbidden: You do not own this project.' };
                }
                const result = await PortfolioService.delete(existingProject.id, user.id);
                return result;
            } catch (error) {
                const errorMessage = 'Failed to delete portfolio project';
                const errorDetails = error instanceof Error ? error.message : 'Unknown error';
                set.status = error instanceof Error && error.message.startsWith('Project not found or user not authorized') ? 404 : 500;
                return { error: errorMessage, details: errorDetails };
            }
        })({ request, params, set });
    }, {
        params: t.Object({ slug: t.String() }),
        detail: {
            tags: ['portfolio'],
            description: 'Deletes an existing portfolio project. Requires authentication, author permissions, and ownership of the project.',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Portfolio project deleted successfully',
                    content: { 'application/json': { schema: t.Object({ message: t.String() }) } } 
                },
                '401': {
                    description: 'Unauthorized',
                    content: { 'application/json': { schema: simpleErrorSchema } }
                },
                '403': {
                    description: 'Forbidden - Insufficient permissions or not project owner',
                    content: { 'application/json': { schema: simpleErrorSchema } }
                },
                '404': {
                    description: 'Project not found',
                    content: { 'application/json': { schema: simpleErrorSchema } }
                },
                '500': {
                    description: 'Internal server error',
                    content: { 'application/json': { schema: simpleErrorSchema } }
                }
            }
        }
    }); 