import { User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';

type AuthContext = {
    request: Request;
    set: { status: number };
    user: User;
    body?: any;
    params?: any;
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
 * @description Higher-order function for requiring admin role
 */
export const requireAdmin = (handler: (context: AuthContext) => Promise<any>) => {
    return async (ctx: { request: Request; set: { status: number }; [key: string]: any }) => {
        return auth(async (authContext: AuthContext) => {
            const { data } = await supabase
                .from('members')
                .select('role')
                .eq('id', authContext.user.id)
                .single();

            if (data?.role !== 'admin') {
                authContext.set.status = 403;
                throw new Error('Forbidden');
            }

            return handler(authContext);
        })(ctx);
    };
};

/**
 * @description Helper to check if user has admin role
 */
export const isAdmin = async (userId: string) => {
    const { data, error } = await supabase
        .from('members')
        .select('role')
        .eq('id', userId)
        .single();

    if (error) throw error;
    return data?.role === 'admin';
};
