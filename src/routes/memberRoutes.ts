import { Elysia } from 'elysia';
import { MemberService } from '../services/memberService';
import { auth, requireAdmin } from '../middlewares/auth';
import { sanitizeMemberData } from '../utils/sanitizer';
import { RouteContext, AuthenticatedContext } from '../types/routes';
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
    MemberDbInput 
} from '../types/memberTypes';
import { UserPermission } from '../types/permissions';

export const memberRoutes = new Elysia({ prefix: '/members' })
    .get('/', async () => {
        try {
            return await MemberService.getAll();
        } catch (error) {
            return {
                error: 'Failed to fetch members',
                message: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }, {
        detail: {
            tags: ['members'],
            summary: 'List all members',
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
    .get('/:username', async ({ params, set }: RouteContext & { params: { username: string } }) => {
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
            summary: 'Get member details',
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
    .post('/', async ({ body, request, set }: RouteContext & { body: MemberInputData }) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
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
                set.status = 201;
                return member;
            } catch (error) {
                set.status = error instanceof Error && error.message.includes('duplicate') ? 409 : 400;
                return {
                    error: 'Validation failed',
                    message: error instanceof Error ? error.message : 'Invalid input data'
                };
            }
        })({ body, request, set });
    }, {
        body: memberInputSchema,
        detail: {
            tags: ['members'],
            summary: 'Create member',
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
    .patch('/:username', async ({ params, body, request, set }: RouteContext & { params: { username: string }, body: MemberUpdateData }) => {
        return auth(async ({ user, set }: AuthenticatedContext) => {
            try {
                const member = await MemberService.getByUsername(params.username);
                if (!member) {
                    set.status = 404;
                    return {
                        error: 'Not found',
                        message: 'Member not found'
                    };
                }

                if (member.id !== user.id) {
                    set.status = 403;
                    return {
                        error: 'Forbidden',
                        message: 'You can only update your own profile'
                    };
                }

                const sanitizedData = sanitizeMemberData({
                    role: body.role,
                    bio: body.bio
                });

                let avatarUrl: string | undefined;
                if (body.avatar) {
                    if (body.avatar instanceof File) {
                        const arrayBuffer = await body.avatar.arrayBuffer();
                        const buffer = Buffer.from(arrayBuffer);
                        avatarUrl = await MemberService.handleAvatar(buffer, member.username);
                    } else if (Buffer.isBuffer(body.avatar)) {
                        avatarUrl = await MemberService.handleAvatar(body.avatar, member.username);
                    }
                }

                const updates: Partial<MemberDbInput> = {
                    ...(sanitizedData.role && { role: sanitizedData.role }),
                    ...(sanitizedData.bio && { bio: sanitizedData.bio }),
                    ...(avatarUrl && { avatar_url: avatarUrl })
                };
                
                const updatedMember = await MemberService.update(member.id, updates);
                return updatedMember;
            } catch (error) {
                set.status = 400;
                return {
                    error: 'Update failed',
                    message: error instanceof Error ? error.message : 'Invalid update data'
                };
            }
        })({ params, body, request, set });
    }, {
        body: memberUpdateSchema,
        detail: {
            tags: ['members'],
            summary: 'Update member',
            description: 'Update member profile',
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
                    description: 'Invalid update data',
                    content: {
                        'application/json': {
                            schema: errorSchema
                        }
                    }
                },
                '403': {
                    description: 'Forbidden - not your profile',
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
    })
    .patch('/:username/permission', async ({ params, body, request, set }: RouteContext & { 
        params: { username: string }, 
        body: { permission: UserPermission } 
    }) => {
        return requireAdmin(async ({ set }: AuthenticatedContext) => {
            try {
                const member = await MemberService.getByUsername(params.username);
                if (!member) {
                    set.status = 404;
                    return {
                        error: 'Not found',
                        message: 'Member not found'
                    };
                }

                const updatedMember = await MemberService.updatePermission(member.id, body.permission);
                return updatedMember;
            } catch (error) {
                set.status = 400;
                return {
                    error: 'Update failed',
                    message: error instanceof Error ? error.message : 'Invalid permission'
                };
            }
        })({ params, body, request, set });
    }, {
        body: permissionUpdateSchema,
        detail: {
            tags: ['members'],
            summary: 'Update member permission',
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
