import { Elysia, t } from 'elysia';
import { MemberService } from '../services/memberService';

export const memberRoutes = new Elysia({ prefix: '/members' })
    .get('/', async () => {
        return await MemberService.getAll();
    })
    .get('/:username', async ({ params: { username } }) => {
        const member = await MemberService.getByUsername(username);
        if (!member) throw new Error('Member not found');
        return member;
    })
    .post('/', async ({ body }) => {
        return await MemberService.create(body as any);
    }, {
        body: t.Object({
            username: t.String(),
            role: t.String(),
            bio: t.String(),
            avatar_url: t.Optional(t.String())
        })
    })
    .put('/:username', async ({ params: { username }, body }) => {
        return await MemberService.update(username, body as any);
    }, {
        body: t.Object({
            role: t.Optional(t.String()),
            bio: t.Optional(t.String()),
            avatar_url: t.Optional(t.String())
        })
    })
    .delete('/:username', async ({ params: { username } }) => {
        await MemberService.delete(username);
        return { message: 'Member deleted successfully' };
    });
