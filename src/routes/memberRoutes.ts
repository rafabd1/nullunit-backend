import { Elysia, t } from 'elysia';
import { MemberService } from '../services/memberService';
import { supabase } from '../config/supabase';
import { uploadAvatar, validateImage } from '../config/storage';
import { sanitizeMemberData } from '../utils/sanitizer';

interface MemberInput {
    id: string;
    username: string;
    role: string;
    bio: string;
    avatar_url?: string;
}

/**
 * @description Validates and processes auth token
 */
const validateAuth = async (request: Request) => {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        throw new Error('Unauthorized');
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
        throw new Error('Unauthorized');
    }

    return user;
};

/**
 * @description Validates admin role
 */
const validateAdmin = async (userId: string) => {
    const { data } = await supabase
        .from('members')
        .select('role')
        .eq('id', userId)
        .single();

    if (data?.role !== 'admin') {
        throw new Error('Forbidden: Admin access required');
    }
};

/**
 * @description Member routes with authentication and validation
 */
export const memberRoutes = new Elysia({ prefix: '/members' })
    .get('/', async () => {
        return await MemberService.getAll();
    })
    .get('/:username', async ({ params: { username } }) => {
        return await MemberService.getByUsername(username);
    })
    .post('/', async ({ body, request, set }) => {
        try {
            const user = await validateAuth(request);
            
            try {
                // Sanitize and validate all user input
                const sanitizedData = sanitizeMemberData({
                    username: body.username,
                    role: body.role,
                    bio: body.bio
                });

                // Check if username is already taken
                const existingMember = await supabase
                    .from('members')
                    .select('username')
                    .eq('username', sanitizedData.username)
                    .single();
                
                if (existingMember.data) {
                    set.status = 400;
                    return { error: 'Username already taken' };
                }

                // Handle avatar upload if provided with deep validation
                let avatarUrl: string | undefined;
                if (body.avatar && body.avatar instanceof Buffer) {
                    const imageValidation = await validateImage(body.avatar);
                    if (!imageValidation.isValid) {
                        set.status = 400;
                        return { error: imageValidation.error };
                    }
                    avatarUrl = await uploadAvatar(body.avatar, sanitizedData.username);
                }                
                const memberInput: MemberInput = {
                    id: user.id,
                    username: sanitizedData.username,
                    role: sanitizedData.role,
                    bio: sanitizedData.bio,
                    avatar_url: avatarUrl
                };
                
                const member = await MemberService.create(memberInput);

                return member;
            } catch (validationError: unknown) {
                set.status = 400;
                return { 
                    error: 'Validation failed',
                    message: validationError instanceof Error ? 
                        validationError.message : 'Invalid input data'
                };
            }
        } catch (err: unknown) {
            const error = err as Error;
            set.status = error.message === 'Unauthorized' ? 401 : 500;
            return { error: error.message };
        }
    }, {
        body: t.Object({
            username: t.String({ minLength: 3, maxLength: 30 }),
            role: t.String({ minLength: 2, maxLength: 50 }),
            bio: t.String({ minLength: 10, maxLength: 500 }),
            avatar: t.Optional(t.Any())
        })
    })
    .put('/:username', async ({ params: { username }, body, request, set }) => {
        try {
            const user = await validateAuth(request);
            
            const currentMember = await MemberService.getByUsername(username);
            const { data: memberCheck } = await supabase
                .from('members')
                .select('role')
                .eq('id', user.id)
                .single();

            if (currentMember.id !== user.id && memberCheck?.role !== 'admin') {
                set.status = 403;
                return { error: 'Forbidden: You can only update your own profile' };
            }

            // Sanitize update data
            const sanitizedData = sanitizeMemberData({
                role: body.role,
                bio: body.bio
            });

            // Handle avatar update with deep validation
            let avatarUrl: string | undefined;
            if (body.avatar && body.avatar instanceof Buffer) {
                const imageValidation = await validateImage(body.avatar);
                if (!imageValidation.isValid) {
                    set.status = 400;
                    return { error: imageValidation.error };
                }
                avatarUrl = await uploadAvatar(body.avatar, username);
            }

            const updatedMember = await MemberService.update(username, {
                ...sanitizedData,
                ...(avatarUrl && { avatar_url: avatarUrl })
            });

            return updatedMember;
        } catch (err: unknown) {
            const error = err as Error;
            set.status = error.message === 'Unauthorized' ? 401 : 500;
            return { error: error.message };
        }
    }, {
        body: t.Object({
            role: t.Optional(t.String({ minLength: 2, maxLength: 50 })),
            bio: t.Optional(t.String({ minLength: 10, maxLength: 500 })),
            avatar: t.Optional(t.Any())
        })
    })
    .delete('/:username', async ({ params: { username }, request, set }) => {
        try {
            const user = await validateAuth(request);
            await validateAdmin(user.id);
            
            await MemberService.delete(username);
            
            return {
                status: 'success',
                message: 'Member deleted successfully',
                timestamp: new Date().toISOString()
            };
        } catch (err: unknown) {
            const error = err as Error;
            set.status = 
                error.message === 'Unauthorized' ? 401 :
                error.message.startsWith('Forbidden') ? 403 : 500;
            return { error: error.message };
        }
    });
