import { Elysia, t } from 'elysia';
import { MemberService } from '../services/memberService';
import { auth } from '../middlewares/auth';
import { sanitizeMemberData } from '../utils/sanitizer';
import { validateImage } from '../config/storage';
import { RouteContext, AuthenticatedContext } from '../types/routes';

interface MemberInputData {
    username: string;
    role: string;
    bio: string;
    avatar?: Buffer;
}

interface MemberUpdateData {
    role?: string;
    bio?: string;
    avatar?: Buffer;
}

interface MemberDbInput {
    id: string;
    username: string;
    role: string;
    bio: string;
    avatar_url?: string;
}

const memberSchema = t.Object({
    id: t.String(),
    username: t.String(),
    role: t.String(),
    bio: t.String(),
    avatar_url: t.Optional(t.String()),
    created_at: t.String(),
    updated_at: t.String()
});

const memberInputSchema = t.Object({
    username: t.String({ minLength: 3, maxLength: 30 }),
    role: t.String({ minLength: 2, maxLength: 50 }),
    bio: t.String({ minLength: 10, maxLength: 500 }),
    avatar: t.Optional(t.Any())
});

const memberUpdateSchema = t.Object({
    role: t.Optional(t.String({ minLength: 2, maxLength: 50 })),
    bio: t.Optional(t.String({ minLength: 10, maxLength: 500 })),
    avatar: t.Optional(t.Any())
});

export const memberRoutes = new Elysia({ prefix: '/members' })
    .get('/', () => MemberService.getAll(), {
        detail: {
            tags: ['members'],
            description: 'Get all members',
            responses: {
                '200': {
                    description: 'List of all members',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'array',
                                items: { $ref: '#/components/schemas/member' }
                            }
                        }
                    }
                }
            }
        }
    })
    .get('/:username', async ({ params }: RouteContext & { params: { username: string } }) => {
        return await MemberService.getByUsername(params.username);
    }, {
        detail: {
            tags: ['members'],
            description: 'Get member by username',
            responses: {
                '200': {
                    description: 'Member details',
                    content: {
                        'application/json': {
                            schema: memberSchema
                        }
                    }
                },
                '404': {
                    description: 'Member not found'
                }
            }
        }
    })
    .post('/', async ({ body, request, set }: RouteContext & { body: MemberInputData }) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
            try {
                const sanitizedData = sanitizeMemberData({
                    username: body.username,
                    role: body.role,
                    bio: body.bio
                });

                let avatarUrl: string | undefined;
                if (body.avatar && body.avatar instanceof Buffer) {
                    avatarUrl = await MemberService.handleAvatar(body.avatar, sanitizedData.username);
                }

                const memberInput: MemberDbInput = {
                    id: user.id,
                    username: sanitizedData.username,
                    role: sanitizedData.role,
                    bio: sanitizedData.bio,
                    avatar_url: avatarUrl
                };
                
                const member = await MemberService.create(memberInput);
                set.status = 201;
                return member;
            } catch (validationError: unknown) {
                set.status = 400;
                return { 
                    error: 'Validation failed',
                    message: validationError instanceof Error ? 
                        validationError.message : 'Invalid input data'
                };
            }
        })({ body, request, set });
    }, {
        body: memberInputSchema,
        detail: {
            tags: ['members'],
            description: 'Create new member',
            security: [{ bearerAuth: [] }],
            responses: {
                '201': {
                    description: 'Member created successfully',
                    content: {
                        'application/json': {
                            schema: memberSchema
                        }
                    }
                },
                '400': {
                    description: 'Invalid input data'
                },
                '401': {
                    description: 'Unauthorized'
                }
            }
        }
    })
    .put('/:username', async ({ params, body, request, set }: RouteContext & { 
        params: { username: string }, 
        body: MemberUpdateData 
    }) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
            try {
                const currentMember = await MemberService.getByUsername(params.username);
                if (currentMember.id !== user.id) {
                    set.status = 403;
                    return { error: 'Forbidden: You can only update your own profile' };
                }

                const sanitizedData = sanitizeMemberData({
                    role: body.role,
                    bio: body.bio
                });

                let avatarUrl: string | undefined;
                if (body.avatar && body.avatar instanceof Buffer) {
                    avatarUrl = await MemberService.handleAvatar(body.avatar, params.username);
                }

                const updatedMember = await MemberService.update(params.username, {
                    ...sanitizedData,
                    ...(avatarUrl && { avatar_url: avatarUrl })
                });

                return updatedMember;
            } catch (validationError: unknown) {
                set.status = 400;
                return { 
                    error: 'Validation failed',
                    message: validationError instanceof Error ? 
                        validationError.message : 'Invalid input data'
                };
            }
        })({ body, request, set });
    }, {
        body: memberUpdateSchema,
        detail: {
            tags: ['members'],
            description: 'Update member',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Member updated successfully',
                    content: {
                        'application/json': {
                            schema: memberSchema
                        }
                    }
                },
                '400': {
                    description: 'Invalid input data'
                },
                '401': {
                    description: 'Unauthorized'
                },
                '403': {
                    description: 'Forbidden - Can only update own profile'
                }
            }
        }
    })
    .delete('/:username', async ({ params, request, set }: RouteContext & { 
        params: { username: string } 
    }) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
            try {
                const currentMember = await MemberService.getByUsername(params.username);
                if (currentMember.id !== user.id) {
                    set.status = 403;
                    return { error: 'Forbidden: You can only delete your own profile' };
                }

                await MemberService.delete(params.username);
                return {
                    status: 'success',
                    message: 'Member deleted successfully',
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                set.status = 500;
                return { error: 'Failed to delete member' };
            }
        })({ request, set });
    }, {
        detail: {
            tags: ['members'],
            description: 'Delete member',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Member deleted successfully',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    status: { type: 'string' },
                                    message: { type: 'string' },
                                    timestamp: { type: 'string', format: 'date-time' }
                                }
                            }
                        }
                    }
                },
                '401': {
                    description: 'Unauthorized'
                },
                '403': {
                    description: 'Forbidden - Admin access required'
                }
            }
        }
    });
