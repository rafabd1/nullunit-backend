import { Elysia } from 'elysia';

/**
 * @description Error handling middleware with proper HTTP status codes
 */
export const errorMiddleware = new Elysia()
    .onError(({ code, error, set }) => {
        if (error instanceof Error) {
            switch (error.message) {
                case 'Unauthorized':
                    set.status = 401;
                    return { error: 'Unauthorized' };
                case 'Forbidden: Admin access required':
                case 'Forbidden: You can only update your own profile':
                    set.status = 403;
                    return { error: error.message };
                default:
                break;
            }
        }

        switch (code) {
        case 'VALIDATION':
            set.status = 400;
            return { 
                error: 'Validation failed',
                details: error.toString()
            };
        case 'NOT_FOUND':
            set.status = 404;
            return { error: 'Resource not found' };
        default:
            set.status = 500;
            return { 
                error: 'Internal server error',
                details: process.env.NODE_ENV === 'development' ? 
                    error.toString() : undefined
            };
        }
    });
