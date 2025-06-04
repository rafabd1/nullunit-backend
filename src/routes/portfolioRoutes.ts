import { Elysia, t } from 'elysia';
import { auth, requireAuthor } from '../middlewares/auth';
import { PortfolioService } from '../services/portfolioService';
import { portfolioInputSchema, portfolioUpdateSchema } from '../schemas/portfolioSchemas';
import { ElysiaBaseContext, AuthenticatedContext } from '../types/routes';
import { PortfolioInputData, PortfolioUpdateData, PortfolioDbInput } from '../types/portfolioTypes';

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
    .get('/', async (context: ElysiaBaseContext) => {
        const { set } = context;
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
    .get('/:slug', async (context: ElysiaBaseContext & { params: { slug: string } }) => {
        const { params, set } = context;
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
    .post('/', async (context: ElysiaBaseContext & { body: PortfolioInputData }) => {
        const { body, request, set } = context;
        return requireAuthor(async ({ user, set: authSet }: AuthenticatedContext) => {
            try {
                const dbInput: PortfolioDbInput = {
                    member_id: user.id,
                    title: body.title,
                    description: body.description,
                    repo_url: body.repo_url,
                    slug: '' // Placeholder
                };
                const project = await PortfolioService.create(dbInput as any);
                authSet.status = 201;
                return project;
            } catch (error) {
                const errorMessage = 'Failed to create portfolio project';
                const errorDetails = error instanceof Error ? error.message : 'Unknown error';
                authSet.status = error instanceof Error && error.message.includes('duplicate slug') ? 409 :
                             error instanceof Error && error.message.includes('Failed to generate unique slug') ? 500 : 400;
                return { error: errorMessage, details: errorDetails };
            }
        })(context as any);
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
    .put('/:slug', async (context: ElysiaBaseContext & { params: { slug: string }, body: PortfolioUpdateData }) => {
        const { params, body, request, set } = context;
        return requireAuthor(async ({ user, set: authSet }: AuthenticatedContext) => {
            try {
                const existingProject = await PortfolioService.getBySlug(params.slug);
                if (!existingProject) {
                    authSet.status = 404;
                    return { error: 'Portfolio project not found' };
                }
                if (existingProject.member_id !== user.id) {
                    authSet.status = 403;
                    return { error: 'Forbidden: You do not own this project.' };
                }
                const project = await PortfolioService.update(existingProject.id, user.id, body);
                return project;
            } catch (error) {
                const errorMessage = 'Failed to update portfolio project';
                const errorDetails = error instanceof Error ? error.message : 'Unknown error';
                authSet.status = error instanceof Error && error.message.startsWith('Project not found or user not authorized') ? 404 :
                             error instanceof Error && error.message.startsWith('Attempted to update slug') ? 400 : 400;
                return { error: errorMessage, details: errorDetails };
            }
        })(context as any);
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
    .delete('/:slug', async (context: ElysiaBaseContext & { params: { slug: string }}) => {
        const { params, request, set } = context;
        return requireAuthor(async ({ user, set: authSet }: AuthenticatedContext) => {
            try {
                const existingProject = await PortfolioService.getBySlug(params.slug);
                if (!existingProject) {
                    authSet.status = 404;
                    return { error: 'Portfolio project not found' };
                }
                if (existingProject.member_id !== user.id) {
                    authSet.status = 403;
                    return { error: 'Forbidden: You do not own this project.' };
                }
                
                // Assuming PortfolioService.delete will throw an error if deletion fails for some reason
                // (e.g., database constraint), or if project not found (though checked above).
                // If it completes without error, the deletion is successful.
                await PortfolioService.delete(existingProject.id, user.id);
                
                authSet.status = 204; // No Content for successful deletion
                return; // Return nothing for 204

            } catch (error) {
                const errorMessage = 'Failed to delete portfolio project';
                const errorDetails = error instanceof Error ? error.message : 'Unknown error';
                
                // More specific error handling can be added if PortfolioService.delete throws typed errors
                if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
                    authSet.status = 404;
                } else if (error instanceof Error && error.message.toLowerCase().includes('forbidden')) {
                    authSet.status = 403;
                } else {
                    authSet.status = 500;
                }
                return { error: errorMessage, details: errorDetails };
            }
        })(context as any); // Pass outer context to requireAuthor HOF
    }, {
        params: t.Object({ slug: t.String() }),
        detail: {
            tags: ['portfolio'],
            description: 'Deletes an existing portfolio project. Requires authentication, author permissions, and ownership of the project.',
            security: [{ bearerAuth: [] }],
            responses: {
                '204': { description: 'Portfolio project deleted successfully' },
                '401': { description: 'Unauthorized', content: { 'application/json': { schema: simpleErrorSchema } } },
                '403': { description: 'Forbidden - Insufficient permissions or not project owner', content: { 'application/json': { schema: simpleErrorSchema } } },
                '404': { description: 'Project not found', content: { 'application/json': { schema: simpleErrorSchema } } },
                '500': { description: 'Internal server error', content: { 'application/json': { schema: simpleErrorSchema } } }
            }
        }
    }); 