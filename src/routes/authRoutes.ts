import { Elysia, t } from 'elysia';
import { supabase } from '../config/supabase';

/**
 * @description Authentication routes handler
 */
export const authRoutes = new Elysia({ prefix: '/auth' })
    .post('/signup', async ({ body, set }) => {
        try {
            const { data, error } = await supabase.auth.signUp({
                email: body.email,
                password: body.password
            });

            if (error) throw error;

            return {
                message: 'Verification email sent',
                user: data.user
            };
        } catch (err: unknown) {
            const error = err as Error;
            set.status = 400;
            return { error: error.message };
        }
    }, {
        body: t.Object({
            email: t.String({ format: 'email' }),
            password: t.String({ minLength: 8 })
        })
    })
    .post('/login', async ({ body, set }) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: body.email,
                password: body.password
            });

            if (error) throw error;

            return {
                session: data.session,
                user: data.user
            };
        } catch (err: unknown) {
            const error = err as Error;
            set.status = 401;
            return { error: error.message };
        }
    }, {
        body: t.Object({
            email: t.String({ format: 'email' }),
            password: t.String()
        })
    })
    .post('/logout', async ({ request, set }) => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;

            return { message: 'Logged out successfully' };
        } catch (err: unknown) {
            const error = err as Error;
            set.status = 500;
            return { error: error.message };
        }
    })
    .post('/refresh', async ({ request, set }) => {
        try {
            const { data, error } = await supabase.auth.refreshSession();
            if (error) throw error;

            return {
                session: data.session,
                user: data.user
            };
        } catch (err: unknown) {
            const error = err as Error;
            set.status = 401;
            return { error: error.message };
        }
    });
