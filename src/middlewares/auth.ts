import { User } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import { UserPermission } from '../types/permissions';
import { MemberWithPermissionAndSubscription } from '../types/memberTypes';
import { CourseService } from '../services/courseService';

// Base context properties from Elysia
export interface ElysiaBaseContext {
    request: Request;
    set: { status: number }; 
    body?: any;
    query?: Record<string, string | undefined>;
    params?: Record<string, string | undefined>;
    [key: string]: any;
}

// Context for strictly authenticated routes
export type AuthenticatedContext = ElysiaBaseContext & {
    user: User; 
    member: MemberWithPermissionAndSubscription;
};

// Context for routes where authentication is optional
export type OptionallyAuthenticatedContext = ElysiaBaseContext & {
    user?: User;
    member?: MemberWithPermissionAndSubscription;
};

// Simplifying PermissionLevel to diagnose linter error
// Original: type PermissionLevel = { [key in UserPermission]: number; };
type PermissionLevel = {
    [key: string]: number; // Changed UserPermission to string
};

const permissionLevels: PermissionLevel = {
    // Assuming UserPermission enum values are strings like 'ADMIN', 'AUTHOR', 'GUEST'
    // If UserPermission.ADMIN is e.g. 0, this would need to be permissionLevels[0] or similar.
    // But given the previous code, string keys are expected.
    [UserPermission.ADMIN as string]: 3, 
    [UserPermission.AUTHOR as string]: 2,
    [UserPermission.GUEST as string]: 1
};

/**
 * @description Higher-order function for protecting routes that require authentication.
 * It fetches Supabase user and the corresponding member profile (including permissions and subscription status).
 */
export const auth = (handler: (context: AuthenticatedContext) => Promise<any>) => {
    // This is the actual middleware function Elysia will use
    return async (context: ElysiaBaseContext) => {
        const authHeader = context.request.headers.get('authorization');
        
        if (!authHeader?.startsWith('Bearer ')) {
            context.set.status = 401;
            throw new Error('Unauthorized: Missing or malformed token');
        }

        const token = authHeader.split(' ')[1];
        const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !supabaseUser) {
            context.set.status = 401;
            throw new Error('Unauthorized: Invalid token or user not found');
        }

        // Fetch member details from 'members' table
        const { data: memberDetails, error: memberError } = await supabase
            .from('members')
            .select('id, permission, is_subscriber') // Fetching necessary fields
            .eq('id', supabaseUser.id)
            .single();

        if (memberError || !memberDetails) {
            context.set.status = 404; // Or 500 if it's a db error vs member not found
            // Log the actual error for debugging
            console.error('Error fetching member details:', memberError?.message);
            throw new Error('Authenticated member profile not found or database error.');
        }
        
        const typedMember = memberDetails as MemberWithPermissionAndSubscription;
        
        // Prepare the authenticated context for the handler
        const authenticatedContext: AuthenticatedContext = {
            ...context, // Pass through existing context properties (like params, query)
            user: supabaseUser,
            member: typedMember,
            set: context.set // Ensure 'set' is correctly passed
        };

        return handler(authenticatedContext);
    };
};

/**
 * @description Higher-order function for requiring specific permission level.
 * This HOF expects to be used *after* the 'auth' HOF has populated context.member.
 */
export const requirePermission = (requiredPermission: UserPermission) => {
    return (handler: (context: AuthenticatedContext) => Promise<any>) => {
        // This function is called by Elysia, it receives the context potentially modified by previous middlewares (like 'auth')
        return async (context: AuthenticatedContext) => {
            // context.member should be populated by the 'auth' middleware
            if (!context.member) {
                // This case should ideally not be reached if 'auth' is always run before it
                context.set.status = 500;
                throw new Error("Authentication error: Member context not found. Ensure 'auth' runs first.");
            }
            
            // Now check permission on context.member
            const memberPerm = context.member.permission as string;
            const requiredPerm = requiredPermission as string;
            if (!(memberPerm in permissionLevels) || permissionLevels[memberPerm] < permissionLevels[requiredPerm]) {
                context.set.status = 403;
                throw new Error('Insufficient permissions');
            }
            return handler(context); // Proceed to the actual route handler
        };
    };
};

/**
 * @description Shorthand for requiring admin permission
 */
export const requireAdmin = (handler: (context: AuthenticatedContext) => Promise<any>) => 
    auth(requirePermission(UserPermission.ADMIN)(handler));

/**
 * @description Shorthand for requiring author permission
 */
export const requireAuthor = (handler: (context: AuthenticatedContext) => Promise<any>) => 
    auth(requirePermission(UserPermission.AUTHOR)(handler));

// --- New Middleware for Paid Course Access ---

/**
 * @description Middleware to check access to paid course content.
 * Assumes 'auth' middleware has run and populated context.member if user is authenticated.
 * Expects 'courseSlug' in route params.
 */
export const checkPaidCourseAccess = () => {
    return async (context: OptionallyAuthenticatedContext & { params: { courseSlug?: string } }) => {
        const { member, params, set } = context;
        const courseSlug = params?.courseSlug;

        if (!courseSlug) {
            set.status = 400; // Bad Request
            throw new Error('Course slug not provided in route parameters.');
        }

        // Fetch course - member object (which can be undefined) is now passed directly.
        // The service's getCourseBySlug already handles general published/owner visibility.
        const course = await CourseService.getCourseBySlug(courseSlug, member);

        if (!course) {
            set.status = 404;
            throw new Error('Course not found or you do not have permission to access it.');
        }

        // If the course is published AND marked as paid, then enforce subscription/ownership.
        if (course.published && course.is_paid) {
            if (member) { // User is authenticated
                if (course.member_id === member.id) {
                    // Owner has access, proceed.
                    return;
                }
                if (member.is_subscriber) {
                    // Authenticated subscriber has access, proceed.
                    return;
                }
                // Authenticated, course is paid, but not owner and not subscriber.
                set.status = 403;
                throw new Error('Full access to this course requires an active subscription.');
            } else {
                // User is not authenticated, and course is published and paid.
                set.status = 401; // Unauthorized, prompt login
                throw new Error('Access to this course requires authentication and a subscription.');
            }
        }
        // If the course is not published (but owner is accessing it - service layer allows this),
        // or if the course is not paid (is_paid is false),
        // or if course is paid and user has access (handled by returns above),
        // then access is granted. Implicitly proceed to next handler.
    };
};

// --- Optional Authentication Middleware ---
/**
 * @description Middleware for optional authentication.
 * It tries to authenticate the user and fetches their profile if successful.
 * If authentication fails or no token is provided, it proceeds without setting user/member in context,
 * allowing public access while enabling enhanced features for logged-in users.
 */
export const optionalAuth = () => {
    return async (context: ElysiaBaseContext) => { // Use 'any' for initial context, then narrow
        const enrichedContext = context as OptionallyAuthenticatedContext;
        enrichedContext.user = undefined;
        enrichedContext.member = undefined;
        const authHeader = context.request.headers.get('authorization');
        
        if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const { data: { user: supabaseUser }, error: userError } = await supabase.auth.getUser(token);

                if (!userError && supabaseUser) {
                    // User is authenticated via Supabase, now fetch member details
                    const { data: memberDetails, error: memberError } = await supabase
                        .from('members')
                        .select('id, permission, is_subscriber')
                        .eq('id', supabaseUser.id)
                        .single();

                    if (!memberError && memberDetails) {
                        enrichedContext.user = supabaseUser;
                        enrichedContext.member = memberDetails as MemberWithPermissionAndSubscription;
                    } else {
                        // Supabase user found, but member profile not found or error fetching it.
                        // Log this, but don't block if it's optional auth.
                        console.warn(`Optional auth: Supabase user ${supabaseUser.id} found, but no member profile or error:`, memberError?.message);
                    }
                } else {
                    // Token provided but invalid or Supabase error
                    console.warn('Optional auth: Invalid token or Supabase user fetch error:', userError?.message);
                }
            } catch (error) {
                // Catch any unexpected errors during optional auth
                console.error('Optional auth: Unexpected error:', error);
            }
        } else {
            // No auth header, proceed as guest
            enrichedContext.user = undefined;
            enrichedContext.member = undefined;
        }
        // Always proceed to the next handler. 
        // The route handler will check for context.member if it needs authenticated user data.
    };
};

// Note: The original requireAdmin and requireAuthor were HOFs that returned a function
// that then called auth(handlerWithPermissionsCheck).
// The new structure: auth is standalone, requirePermission is standalone.
// For combined usage as before:
// export const requireAdmin = (handler) => auth(requirePermission(UserPermission.ADMIN)(handler))
// This means the handler passed to requireAdmin/Author is the *final* route handler.
// And requirePermission(UserPermission.ADMIN) returns a function that expects an AuthenticatedContext
// And auth calls its handler with AuthenticatedContext.
// This composition should work.
