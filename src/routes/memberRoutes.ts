import { Elysia } from 'elysia';
import { MemberService } from '../services/memberService';
import { auth, requireAdmin } from '../middlewares/auth';
import { sanitizeMemberData } from '../utils/sanitizer';
import { ElysiaBaseContext, AuthenticatedContext } from '../types/routes';
import { 
    memberSchema, 
    memberInputSchema, 
    memberUpdateSchema,
    permissionUpdateSchema,
    errorSchema 
} from '../schemas/memberSchemas';
import { 
    MemberInputData, 
    MemberUpdateData, 
    MemberDbInput, 
    MemberProfileUpdate
} from '../types/memberTypes';
import { UserPermission } from '../types/permissions';

export const memberRoutes = new Elysia({ prefix: '/members' })
    .get('/', async (context: ElysiaBaseContext) => {
        const { set } = context;
        try {
            return await MemberService.getAll();
        } catch (error) {
            set.status = 500;
            return {
                error: 'Failed to fetch members',
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }, {
        detail: {
            tags: ['members'],
            description: 'Get all registered members',
            responses: {
                '200': {
                    description: 'List of all members',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'array',
                                items: memberSchema
                            }
                        }
                    }
                },
                '500': {
                    description: 'Internal server error',
                    content: {
                        'application/json': {
                            schema: errorSchema
                        }
                    }
                }
            }
        }
    })
    .get('/:username', async (context: ElysiaBaseContext & { params: { username: string } }) => {
        const { params, set } = context;
        try {
            const member = await MemberService.getByUsername(params.username);
            if (!member) {
                set.status = 404;
                return {
                    error: 'Not found',
                    message: 'Member not found'
                };
            }
            return member;
        } catch (error) {
            set.status = 500;
            return {
                error: 'Failed to fetch member',
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
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
                    description: 'Member not found',
                    content: {
                        'application/json': {
                            schema: errorSchema
                        }
                    }
                },
                '500': {
                    description: 'Internal server error',
                    content: {
                        'application/json': {
                            schema: errorSchema
                        }
                    }
                }
            }
        }
    })
    .post('/', async (context: ElysiaBaseContext & { body: MemberInputData }) => {
        const { body, request, set } = context;
        return auth(async ({ user, set: authSet }: AuthenticatedContext) => {
            try {
                const sanitizedData = sanitizeMemberData({
                    username: body.username,
                    role: body.role,
                    bio: body.bio
                });

                let avatarUrl: string | undefined;
                if (body.avatar) {
                    if (body.avatar instanceof File) {
                        const arrayBuffer = await body.avatar.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        avatarUrl = await MemberService.handleAvatar(buffer, sanitizedData.username);
                    } else if (Buffer.isBuffer(body.avatar)) {
                        avatarUrl = await MemberService.handleAvatar(body.avatar, sanitizedData.username);
                    }
                }

                const memberInput: MemberDbInput = {
                    id: user.id,
                    username: sanitizedData.username,
                    role: sanitizedData.role,
                    bio: sanitizedData.bio,
                    avatar_url: avatarUrl
                };
                
                const member = await MemberService.create(memberInput);
                authSet.status = 201;
                return member;
            } catch (error) {
                authSet.status = error instanceof Error && error.message.includes('duplicate') ? 409 : 400;
                return {
                    error: 'Validation failed',
                    message: error instanceof Error ? error.message : 'Invalid input data'
                };
            }
        })(context as any);
    }, {
        body: memberInputSchema,
        detail: {
            tags: ['members'],
            description: 'Create new member profile',
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
                    description: 'Invalid input data',
                    content: {
                        'application/json': {
                            schema: errorSchema
                        }
                    }
                },
                '409': {
                    description: 'Username already exists',
                    content: {
                        'application/json': {
                            schema: errorSchema
                        }
                    }
                }
            }
        }
    })
    .patch('/me', async (context: ElysiaBaseContext & { body: MemberUpdateData & { newUsername?: string } }) => {
        const { body, request, set } = context;
        return auth(async ({ user, set: authSet }: AuthenticatedContext) => {
            try {
                const userId = user.id;

                const { newUsername, role, bio, avatar } = body;

                const sanitizedData = sanitizeMemberData({
                    role,
                    bio
                });

                let avatarUrl: string | undefined;
                if (avatar) {
                    const avatarPathUsername = user.user_metadata?.username || userId;
                    if (avatar instanceof File) {
                        const arrayBuffer = await avatar.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        avatarUrl = await MemberService.handleAvatar(buffer, avatarPathUsername);
                    } else if (Buffer.isBuffer(avatar)) {
                        avatarUrl = await MemberService.handleAvatar(avatar, avatarPathUsername);
                    }
                }

                const updates: MemberProfileUpdate & { newUsername?: string } = {
                    ...(sanitizedData.role && { role: sanitizedData.role }),
                    ...(sanitizedData.bio && { bio: sanitizedData.bio }),
                    ...(avatarUrl && { avatar_url: avatarUrl }),
                    ...(newUsername && { newUsername })
                };

                if (Object.keys(updates).length === 0) {
                    authSet.status = 400;
                    return { 
                        error: 'No changes', 
                        message: 'No update data provided'
                    };
                }

                const updatedMember = await MemberService.update(userId, updates);
                return updatedMember;
            } catch (error) {
                if (error instanceof Error && error.message.includes('Username already taken')) {
                    authSet.status = 409;
                    return { error: 'Conflict', message: error.message };
                }
                authSet.status = 400;
                return {
                    error: 'Update failed',
                    message: error instanceof Error ? error.message : 'Invalid update data'
                };
            }
        })(context as any);
    }, {
        body: memberUpdateSchema,
        detail: {
            tags: ['members'],
            description: 'Update the authenticated user\'s profile (including username)',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Member profile updated successfully',
                    content: {
                        'application/json': {
                            schema: memberSchema
                        }
                    }
                },
                '400': {
                    description: 'Invalid update data or no changes provided',
                    content: {
                        'application/json': {
                            schema: errorSchema
                        }
                    }
                },
                '401': {
                    description: 'Unauthorized',
                    content: {
                        'application/json': {
                            schema: errorSchema
                        }
                    }
                },
                '403': {
                    description: 'Forbidden',
                    content: {
                        'application/json': {
                            schema: errorSchema
                        }
                    }
                },
                '409': {
                    description: 'Username already taken',
                    content: {
                        'application/json': {
                            schema: errorSchema
                        }
                    }
                }
            }
        }
    })
    .patch('/:username/permission', async (context: ElysiaBaseContext & { 
        params: { username: string }, 
        body: { permission: UserPermission } 
    }) => {
        const { params, body, request, set } = context;
        return requireAdmin(async ({ user: adminUser, set: authSet }: AuthenticatedContext) => {
            try {
                const memberToUpdate = await MemberService.getByUsername(params.username);
                if (!memberToUpdate) {
                    authSet.status = 404;
                    return {
                        error: 'Not found',
                        message: 'Member not found'
                    };
                }

                const updatedMember = await MemberService.updatePermission(memberToUpdate.id, body.permission);
                return updatedMember;
            } catch (error) {
                authSet.status = 400;
                return {
                    error: 'Update failed',
                    message: error instanceof Error ? error.message : 'Invalid permission'
                };
            }
        })(context as any);
    }, {
        body: permissionUpdateSchema,
        detail: {
            tags: ['members'],
            description: 'Update member permission level (admin only)',
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Permission updated successfully',
                    content: {
                        'application/json': {
                            schema: memberSchema
                        }
                    }
                },
                '400': {
                    description: 'Invalid permission value',
                    content: {
                        'application/json': {
                            schema: errorSchema
                        }
                    }
                },
                '401': {
                    description: 'Unauthorized',
                    content: {
                        'application/json': {
                            schema: errorSchema
                        }
                    }
                },
                '403': {
                    description: 'Forbidden - requires admin permission',
                    content: {
                        'application/json': {
                            schema: errorSchema
                        }
                    }
                },
                '404': {
                    description: 'Member not found',
                    content: {
                        'application/json': {
                            schema: errorSchema
                        }
                    }
                }
            }
        }
    });
