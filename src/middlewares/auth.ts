import { User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { UserPermission } from '../types/permissions';
import { MemberWithPermission } from '../types/memberTypes';

type AuthContext = {
    request: Request;
    set: { status: number };
    user: User;
    body?: any;
    params?: any;
};

type PermissionLevel = {
    [key in UserPermission]: number;
};

const permissionLevels: PermissionLevel = {
    [UserPermission.ADMIN]: 3,
    [UserPermission.AUTHOR]: 2,
    [UserPermission.GUEST]: 1
};

/**
 * @description Higher-order function for protecting routes that require authentication
 */
export const auth = (handler: (context: AuthContext) => Promise<any>) => {
    return async ({ request, set, ...ctx }: { request: Request; set: { status: number }; [key: string]: any }) => {
        const authHeader = request.headers.get('authorization');
        
        if (!authHeader?.startsWith('Bearer ')) {
            set.status = 401;
            throw new Error('Unauthorized');
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            set.status = 401;
            throw new Error('Unauthorized');
        }

        return handler({ ...ctx, request, set, user });
    };
};

/**
 * @description Higher-order function for requiring specific permission level
 */
export const requirePermission = (requiredPermission: UserPermission) => {
    return (handler: (context: AuthContext) => Promise<any>) => {
        return async (ctx: { request: Request; set: { status: number }; [key: string]: any }) => {
            return auth(async (authContext: AuthContext) => {
                const { data: member, error } = await supabase
                    .from('members')
                    .select('id, permission')
                    .eq('id', authContext.user.id)
                    .single();

                if (error || !member) {
                    authContext.set.status = 404;
                    throw new Error('Member not found');
                }

                const typedMember = member as MemberWithPermission;
                
                if (permissionLevels[typedMember.permission] < permissionLevels[requiredPermission]) {
                    authContext.set.status = 403;
                    throw new Error('Insufficient permissions');
                }

                return handler(authContext);
            })(ctx);
        };
    };
};

/**
 * @description Shorthand for requiring admin permission
 */
export const requireAdmin = requirePermission(UserPermission.ADMIN);

/**
 * @description Shorthand for requiring author permission
 */
export const requireAuthor = requirePermission(UserPermission.AUTHOR);
