import { supabase } from '../config/supabase';
import { Member, SocialLink } from '../types/database';

export class MemberService {
    static async getAll(): Promise<Member[]> {
        const { data, error } = await supabase
            .from('members')
            .select('*')
            .order('username');

        if (error) throw error;
        return data;
    }

    static async getByUsername(username: string): Promise<Member | null> {
        const { data, error } = await supabase
            .from('members')
            .select(`
                *,
                member_social_links (
                id,
                platform,
                url
                )
            `)
            .eq('username', username)
            .single();

        if (error) throw error;
        return data;
    }

    static async create(member: Omit<Member, 'id' | 'created_at' | 'updated_at'>): Promise<Member> {
        const { data, error } = await supabase
            .from('members')
            .insert(member)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    static async update(username: string, member: Partial<Member>): Promise<Member> {
        const { data, error } = await supabase
            .from('members')
            .update(member)
            .eq('username', username)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    static async delete(username: string): Promise<void> {
        const { error } = await supabase
            .from('members')
            .delete()
            .eq('username', username);

        if (error) throw error;
    }
}
