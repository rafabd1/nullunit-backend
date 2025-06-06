import { supabase } from '../config/supabase';
import { validateImage } from '../config/storage';
import { MemberDbInput, MemberResponse, MemberProfileUpdate } from '../types/memberTypes';
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
     * @description Get member by ID
     */
    static async getById(id: string): Promise<MemberResponse | null> {
        const { data, error } = await supabase
            .from('members')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    }

    /**
     * @description Create new member profile
     */    static async create(input: MemberDbInput): Promise<MemberResponse> {
        // Agora o create é interno, usado apenas pelo AuthService
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
    static async update(id: string, updates: MemberProfileUpdate & { newUsername?: string }): Promise<MemberResponse> {
        const { newUsername, ...profileUpdates } = updates;
        let currentUsername: string | undefined = undefined;

        // Se newUsername for fornecido, precisamos lidar com a atualização do username
        if (newUsername) {
            // 1. Verificar se o novo username já está em uso por outro membro
            const { data: existingMemberByNewUsername, error: usernameCheckError } = await supabase
                .from('members')
                .select('id, username')
                .eq('username', newUsername)
                .neq('id', id) // Excluir o próprio usuário da verificação
                .single();

            if (usernameCheckError && usernameCheckError.code !== 'PGRST116') { // PGRST116 = no rows found
                throw new Error('Error checking username availability');
            }
            if (existingMemberByNewUsername) {
                throw new Error('Username already taken');
            }

            // Guardar o username atual para possível rollback no Auth
            const { data: currentMemberData, error: currentMemberError } = await supabase
                .from('members')
                .select('username')
                .eq('id', id)
                .single();

            if (currentMemberError || !currentMemberData) {
                throw new Error('Failed to fetch current member data for username update.');
            }
            currentUsername = currentMemberData.username;

            // Adiciona username ao profileUpdates para ser atualizado na tabela members
            (profileUpdates as any).username = newUsername;
        }

        // Atualiza a tabela 'members'
        const { data: updatedMember, error: memberUpdateError } = await supabase
            .from('members')
            .update(profileUpdates)
            .eq('id', id)
            .select()
            .single();

        if (memberUpdateError) {
            throw memberUpdateError;
        }

        // Se o username foi alterado, atualiza também no Supabase Auth user_metadata
        if (newUsername && updatedMember) {
            const { data: authUser, error: authUpdateError } = await supabase.auth.admin.updateUserById(
                id,
                { user_metadata: { username: newUsername } }
            );

            if (authUpdateError) {
                // Rollback da alteração do username na tabela 'members'
                await supabase
                    .from('members')
                    .update({ username: currentUsername }) // Reverte para o username antigo
                    .eq('id', id);
                throw new Error('Failed to update username in authentication system. Member username has been reverted.');
            }
        }

        return updatedMember;
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
