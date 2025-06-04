import { Elysia, t } from 'elysia';
import { TagService } from '../services/tagService';
import { requireAuthor } from '../middlewares/auth';
import {
    tagSchema,
    tagInputSchema,
    tagUpdateSchema,
    paramIdSchema,
    genericParamIdSchema,
    errorSchema,
    deleteSuccessSchema
} from '../schemas/tagSchemas';
import { TagInputData, TagUpdateData } from '../types/tagTypes';
import { ElysiaBaseContext, AuthenticatedContext } from '../types/routes';

const commonErrorResponses = {
    '400': { description: 'Bad Request', content: { 'application/json': { schema: errorSchema } } },
    '401': { description: 'Unauthorized', content: { 'application/json': { schema: errorSchema } } },
    '403': { description: 'Forbidden', content: { 'application/json': { schema: errorSchema } } },
    '404': { description: 'Not Found', content: { 'application/json': { schema: errorSchema } } },
    '409': { description: 'Conflict', content: { 'application/json': { schema: errorSchema } } },
    '500': { description: 'Internal Server Error', content: { 'application/json': { schema: errorSchema } } }
};

export const tagRoutes = new Elysia({ prefix: '/tags' })
    // CRUD for Tags
    .post('/', async (context: ElysiaBaseContext & { body: TagInputData }) => {
        const { body, set, request } = context;
        return requireAuthor(async ({ user, set: authSet }: AuthenticatedContext) => {
            try {
                const newTag = await TagService.createTag(body);
                authSet.status = 201;
                return newTag;
            } catch (error: any) {
                if (error.message.includes('already exists')) {
                    authSet.status = 409;
                    return { error: 'Conflict', message: error.message };
                } else if (error.message.toLowerCase().includes('failed to create')) {
                    authSet.status = 500;
                    return { error: 'Database Error', message: error.message };
                }
                authSet.status = 400;
                return { error: 'Bad Request', message: error.message };
            }
        })(context as any);
    }, {
        body: tagInputSchema,
        detail: {
            tags: ['Tags'],
            description: 'Creates a new tag. Requires author permission. If a tag with the same name (case-insensitive) already exists, the existing tag might be returned or a conflict error, depending on service logic.',
            security: [{ bearerAuth: [] }],
            responses: {
                '201': { description: 'Tag created successfully', content: { 'application/json': { schema: tagSchema } } },
                ...commonErrorResponses
            }
        }
    })
    .get('/', async (context: ElysiaBaseContext) => {
        const { set } = context;
        try {
            const tags = await TagService.getAllTags();
            return tags;
        } catch (error: any) {
            set.status = 500;
            return { error: 'Internal Server Error', message: error.message };
        }
    }, {
        detail: {
            tags: ['Tags'],
            description: 'Retrieves a list of all available tags, ordered by name.',
            responses: {
                '200': { description: 'A list of tags', content: { 'application/json': { schema: t.Array(tagSchema) } } },
                '500': commonErrorResponses['500']
            }
        }
    })
    .get('/:id', async (context: ElysiaBaseContext & { params: { id: string } }) => {
        const { params, set } = context;
        try {
            const tag = await TagService.getTagById(params.id);
            if (!tag) {
                set.status = 404;
                return { error: 'Not Found', message: 'Tag not found' };
            }
            return tag;
        } catch (error: any) {
            set.status = 500;
            return { error: 'Internal Server Error', message: error.message };
        }
    }, {
        params: paramIdSchema,
        detail: {
            tags: ['Tags'],
            description: 'Retrieves a specific tag by its UUID.',
            responses: {
                '200': { description: 'The tag', content: { 'application/json': { schema: tagSchema } } },
                '404': commonErrorResponses['404'],
                '500': commonErrorResponses['500']
            }
        }
    })
    .put('/:id', async (context: ElysiaBaseContext & { params: { id: string }, body: TagUpdateData }) => {
        const { params, body, set, request } = context;
        return requireAuthor(async ({ user, set: authSet }: AuthenticatedContext) => {
            if (Object.keys(body).length === 0 || !body.name?.trim()) {
                authSet.status = 400;
                return { error: 'Bad Request', message: 'Name is required for updating a tag.' };
            }
            try {
                const updatedTag = await TagService.updateTag(params.id, body);
                if (!updatedTag) {
                    authSet.status = 404;
                    return { error: 'Not Found', message: 'Tag not found or no changes made' };
                }
                return updatedTag;
            } catch (error: any) {
                if (error.message.includes('already exists')) {
                    authSet.status = 409;
                    return { error: 'Conflict', message: error.message };
                } else if (error.message.toLowerCase().includes('failed to update')) {
                    authSet.status = 500;
                    return { error: 'Database Error', message: error.message };
                }
                authSet.status = 400;
                return { error: 'Bad Request', message: error.message };
            }
        })(context as any);
    }, {
        params: paramIdSchema,
        body: tagUpdateSchema,
        detail: {
            tags: ['Tags'],
            description: 'Updates an existing tag by its UUID. Requires author permission.',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': { description: 'Tag updated successfully', content: { 'application/json': { schema: tagSchema } } },
                ...commonErrorResponses
            }
        }
    })
    .delete('/:id', async (context: ElysiaBaseContext & { params: { id: string } }) => {
        const { params, set, request } = context;
        return requireAuthor(async ({ user, set: authSet }: AuthenticatedContext) => {
            try {
                const result = await TagService.deleteTag(params.id);
                if (result.count === 0) {
                    authSet.status = 404;
                    return { error: 'Not Found', message: 'Tag not found or already deleted' };
                }
                return { message: 'Tag and its associations deleted successfully' };
            } catch (error: any) {
                 authSet.status = 500;
                 return { error: 'Internal Server Error', message: error.message };
            }
        })(context as any);
    }, {
        params: paramIdSchema,
        detail: {
            tags: ['Tags'],
            description: 'Deletes a tag by its UUID and all its associations with articles, modules, and projects. Requires author permission.',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': { description: 'Tag deleted successfully', content: { 'application/json': { schema: deleteSuccessSchema } } },
                ...commonErrorResponses
            }
        }
    })
    // Routes to get tags by associated content ID
    .get('/module/:moduleId', async (context: ElysiaBaseContext & { params: { moduleId: string } }) => {
        const { params, set } = context;
        try {
            const tags = await TagService.getTagsByModuleId(params.moduleId);
            return tags;
        } catch (error: any) {
            set.status = 500;
            return { error: 'Internal Server Error', message: error.message };
        }
    }, {
        params: genericParamIdSchema('moduleId'),
        detail: {
            tags: ['Tags'],
            description: 'Retrieves all tags associated with a specific article module UUID.',
            responses: {
                '200': { description: 'List of tags for the module', content: { 'application/json': { schema: t.Array(tagSchema) } } },
                '404': commonErrorResponses['404'], // If module ID is valid but module not found (service might handle this)
                '500': commonErrorResponses['500']
            }
        }
    })
    .get('/sub-article/:subArticleId', async (context: ElysiaBaseContext & { params: { subArticleId: string } }) => {
        const { params, set } = context;
        try {
            const tags = await TagService.getTagsBySubArticleId(params.subArticleId);
            return tags;
        } catch (error: any) {
            set.status = 500;
            return { error: 'Internal Server Error', message: error.message };
        }
    }, {
        params: genericParamIdSchema('subArticleId'),
        detail: {
            tags: ['Tags'],
            description: 'Retrieves all tags associated with a specific sub-article UUID.',
            responses: {
                '200': { description: 'List of tags for the sub-article', content: { 'application/json': { schema: t.Array(tagSchema) } } },
                '404': commonErrorResponses['404'],
                '500': commonErrorResponses['500']
            }
        }
    })
    .get('/project/:projectId', async (context: ElysiaBaseContext & { params: { projectId: string } }) => {
        const { params, set } = context;
        try {
            const tags = await TagService.getTagsByProjectId(params.projectId);
            return tags;
        } catch (error: any) {
            set.status = 500;
            return { error: 'Internal Server Error', message: error.message };
        }
    }, {
        params: genericParamIdSchema('projectId'),
        detail: {
            tags: ['Tags'],
            description: 'Retrieves all tags associated with a specific portfolio project UUID.',
            responses: {
                '200': { description: 'List of tags for the project', content: { 'application/json': { schema: t.Array(tagSchema) } } },
                '404': commonErrorResponses['404'],
                '500': commonErrorResponses['500']
            }
        }
    }); 