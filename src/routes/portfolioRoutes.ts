import { Elysia, t } from 'elysia';
import { auth } from '../middlewares/auth';
import { PortfolioService } from '../services/portfolioService';
import { portfolioSchema, portfolioInputSchema, portfolioUpdateSchema, portfolioErrorSchema } from '../schemas/portfolioSchemas';
import { AuthenticatedContext, RouteContext } from '../types/routes';
import { PortfolioInputData, PortfolioUpdateData, PortfolioDbInput } from '../types/portfolioTypes';
import { UserPermission } from '../types/permissions'; // Para checar permissão de AUTHOR

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
            summary: 'List all portfolio projects',
            description: 'Retrieves a list of all publicly available portfolio projects.',
            responses: {
                '200': {
                    description: 'A list of portfolio projects',
                    content: { 'application/json': { schema: t.Array(portfolioSchema) } }
                },
                '500': {
                    description: 'Internal server error',
                    content: { 'application/json': { schema: portfolioErrorSchema } }
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
            summary: 'Get a portfolio project by slug',
            description: 'Retrieves a specific portfolio project by its unique slug.',
            responses: {
                '200': {
                    description: 'The portfolio project',
                    content: { 'application/json': { schema: portfolioSchema } }
                },
                '404': {
                    description: 'Project not found',
                    content: { 'application/json': { schema: portfolioErrorSchema } }
                },
                '500': {
                    description: 'Internal server error',
                    content: { 'application/json': { schema: portfolioErrorSchema } }
                }
            }
        }
    })
    // POST /api/portfolio - Criar novo projeto (autenticado, author+)
    .post('/', async ({ body, request, set }: RouteContext & { body: PortfolioInputData }) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
            // Verificar permissão do usuário (AUTHOR ou superior)
            if (!user.app_metadata.permissions || user.app_metadata.permissions < UserPermission.AUTHOR) {
                set.status = 403;
                return { error: 'Forbidden: Insufficient permissions. Author role required.' };
            }
            try {
                const dbInput: PortfolioDbInput = {
                    member_id: user.id,
                    title: body.title,
                    // slug é gerado pelo serviço
                    description: body.description,
                    repo_url: body.repo_url
                };
                const project = await PortfolioService.create(dbInput);
                set.status = 201;
                return project;
            } catch (error) {
                set.status = error instanceof Error && error.message.includes('duplicate slug') ? 409 : 400;
                return { 
                    error: 'Failed to create portfolio project', 
                    details: error instanceof Error ? error.message : 'Unknown error' 
                };
            }
        })({ request, body, set });
    }, {
        body: portfolioInputSchema,
        detail: {
            tags: ['portfolio'],
            summary: 'Create a new portfolio project',
            description: 'Creates a new portfolio project. Requires authentication and author permissions.',
            security: [{ bearerAuth: [] }],
            responses: {
                '201': {
                    description: 'Portfolio project created successfully',
                    content: { 'application/json': { schema: portfolioSchema } }
                },
                '400': {
                    description: 'Invalid input data or failed to create',
                    content: { 'application/json': { schema: portfolioErrorSchema } }
                },
                '401': {
                    description: 'Unauthorized',
                    content: { 'application/json': { schema: portfolioErrorSchema } }
                },
                '403': {
                    description: 'Forbidden - Insufficient permissions',
                    content: { 'application/json': { schema: portfolioErrorSchema } }
                },
                '409': {
                    description: 'Conflict - Slug already exists (try a different title)',
                    content: { 'application/json': { schema: portfolioErrorSchema } }
                }
            }
        }
    })
    // PUT /api/portfolio/:slug - Atualizar projeto (autenticado, author+, owner)
    .put('/:slug', async ({ params, body, request, set }: RouteContext & { params: { slug: string }, body: PortfolioUpdateData }) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
            if (!user.app_metadata.permissions || user.app_metadata.permissions < UserPermission.AUTHOR) {
                set.status = 403;
                return { error: 'Forbidden: Insufficient permissions. Author role required.' };
            }
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
                set.status = error instanceof Error && error.message.startsWith('Project not found or user not authorized') ? 404 :
                             error instanceof Error && error.message.startsWith('Attempted to update slug') ? 400 : 400;
                return { 
                    error: 'Failed to update portfolio project', 
                    details: error instanceof Error ? error.message : 'Unknown error' 
                };
            }
        })({ request, params, body, set });
    }, {
        params: t.Object({ slug: t.String() }),
        body: portfolioUpdateSchema,
        detail: {
            tags: ['portfolio'],
            summary: 'Update an existing portfolio project',
            description: 'Updates an existing portfolio project. Requires authentication, author permissions, and ownership of the project.',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Portfolio project updated successfully',
                    content: { 'application/json': { schema: portfolioSchema } }
                },
                '400': {
                    description: 'Invalid input data or failed to update',
                    content: { 'application/json': { schema: portfolioErrorSchema } }
                },
                '401': {
                    description: 'Unauthorized',
                    content: { 'application/json': { schema: portfolioErrorSchema } }
                },
                '403': {
                    description: 'Forbidden - Insufficient permissions or not project owner',
                    content: { 'application/json': { schema: portfolioErrorSchema } }
                },
                '404': {
                    description: 'Project not found',
                    content: { 'application/json': { schema: portfolioErrorSchema } }
                }
            }
        }
    })
    // DELETE /api/portfolio/:slug - Deletar projeto (autenticado, author+, owner)
    .delete('/:slug', async ({ params, request, set }: RouteContext & { params: { slug: string }}) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
            if (!user.app_metadata.permissions || user.app_metadata.permissions < UserPermission.AUTHOR) {
                set.status = 403;
                return { error: 'Forbidden: Insufficient permissions. Author role required.' };
            }
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
                return result; // Should be { message: '...' }
            } catch (error) {
                set.status = error instanceof Error && error.message.startsWith('Project not found or user not authorized') ? 404 : 500;
                return { 
                    error: 'Failed to delete portfolio project', 
                    details: error instanceof Error ? error.message : 'Unknown error' 
                };
            }
        })({ request, params, set });
    }, {
        params: t.Object({ slug: t.String() }),
        detail: {
            tags: ['portfolio'],
            summary: 'Delete a portfolio project',
            description: 'Deletes an existing portfolio project. Requires authentication, author permissions, and ownership of the project.',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': { // Ou 204 No Content, mas 200 com mensagem é comum
                    description: 'Portfolio project deleted successfully',
                    content: { 'application/json': { schema: t.Object({ message: t.String() }) } }
                },
                '401': {
                    description: 'Unauthorized',
                    content: { 'application/json': { schema: portfolioErrorSchema } }
                },
                '403': {
                    description: 'Forbidden - Insufficient permissions or not project owner',
                    content: { 'application/json': { schema: portfolioErrorSchema } }
                },
                '404': {
                    description: 'Project not found',
                    content: { 'application/json': { schema: portfolioErrorSchema } }
                },
                '500': {
                    description: 'Internal server error',
                    content: { 'application/json': { schema: portfolioErrorSchema } }
                }
            }
        }
    }); 