import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';

/**
 * @description Configure CORS for the application
 */
export const configureCors = (app: Elysia) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'; // Revertido
    
    return app.use(cors({
        origin: [frontendUrl], // Revertido
        // origin: '*', // Comentado
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
        exposeHeaders: ['Location', 'Set-Cookie'], // Manter 'Set-Cookie' é importante
        credentials: true, 
        maxAge: 3600
    }));
}
