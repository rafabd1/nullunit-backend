// src/types/routes.ts

// Remove old local definitions of RouteContext and AuthenticatedContext

// Import and re-export context types from middlewares/auth.ts
// These are now the single source of truth for route handler context types.
export {
    ElysiaBaseContext, // Can be used for routes with no specific auth, or renamed on import if desired
    AuthenticatedContext,    // For routes requiring successful authentication
    OptionallyAuthenticatedContext // For routes where authentication is optional
} from '../middlewares/auth';

// Keep other specific type definitions if they are not context-related
export interface ValidationError {
    error: string;
    message: string;
}
