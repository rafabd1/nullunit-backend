import { supabase } from '../config/supabase';
import { validateImage } from '../config/storage';
import { MemberDbInput, MemberResponse } from '../types/memberTypes';
import { UserPermission } from '../types/permissions';

/**
 * @description Service layer for member management
 */
export class MemberService {
    /**
     * @description Get all members
     */
    static async getAll(): Promise<MemberResponse[]> {
        const { data, error } = await supabase
            .from('members')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    /**
     * @description Get member by username
     */
    static async getByUsername(username: string): Promise<MemberResponse | null> {
        const { data, error } = await supabase
            .from('members')
            .select('*')
            .eq('username', username)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    /**
     * @description Create new member profile
     */
    static async create(input: MemberDbInput): Promise<MemberResponse> {
        const { data: existing } = await supabase
            .from('members')
            .select('username')
            .eq('username', input.username)
            .single();

        if (existing) {
            throw new Error('Username already taken');
        }

        const { data, error } = await supabase
            .from('members')
            .insert({
                ...input,
                permission: input.permission || UserPermission.GUEST
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * @description Update member profile
     */
    static async update(id: string, updates: Partial<MemberDbInput>): Promise<MemberResponse> {
        // Não permitir atualização de permission através deste método
        const { permission, ...safeUpdates } = updates;
        
        const { data, error } = await supabase
            .from('members')
            .update(safeUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * @description Update member permission
     * This is a separate method that should only be called by admin routes
     */
    static async updatePermission(id: string, newPermission: UserPermission): Promise<MemberResponse> {
        const { data, error } = await supabase
            .from('members')
            .update({ permission: newPermission })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * @description Handle avatar upload
     */
    static async handleAvatar(file: Buffer, username: string): Promise<string> {
        const isValid = await validateImage(file);
        if (!isValid) {
            throw new Error('Invalid image file');
        }

        const filePath = `avatars/${username}`;
        const { error: uploadError } = await supabase.storage
            .from('members')
            .upload(filePath, file, {
                contentType: 'image/jpeg',
                upsert: true
            });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('members')
            .getPublicUrl(filePath);

        return publicUrl;
    }
}
