import { Elysia } from 'elysia';
import { supabase } from './config/supabase';
import { memberRoutes } from './routes/memberRoutes';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const app = new Elysia()
    .get('/', () => ({
        status: 'online',
        message: 'NullUnit API is running',
        timestamp: new Date().toISOString()
    }))  
    .group('/api', app => app
            .get('/health', async () => {
                try {
                    const { data, error } = await supabase.from('members').select('count');
                    if (error) throw error;
                    return {
                    status: 'healthy',
                    database: 'connected',
                    timestamp: new Date().toISOString()
                    };
                } catch (error) {
                    return {
                    status: 'error',
                    database: 'disconnected',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    timestamp: new Date().toISOString()
                    };
                }
            })
            .use(memberRoutes)
    )
    .listen(PORT);

console.log(
    `🚀 NullUnit API is running at ${app.server?.hostname}:${app.server?.port}`
);
