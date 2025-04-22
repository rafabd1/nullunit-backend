import { supabase } from '../config/supabase';
import { uploadAvatar, deleteOldAvatar, validateImage } from '../config/storage';
import { Member } from '../types/database';

/**
 * @description Interface for member creation
 */
interface CreateMemberInput {
    id: string;
    username: string;
    role: string;
    bio: string;
    avatar_url?: string;
}

/**
 * @description Service layer for member management
 */
export class MemberService {
    private static readonly SELECT_QUERY = `
        *,
        member_social_links (
            id,
            platform,
            url
        )`;

    /**
     * @description Get all members with their social links
     */
    static async getAll(): Promise<Member[]> {
        const { data, error } = await supabase
            .from('members')
            .select(this.SELECT_QUERY)
            .order('username');

        if (error) throw new Error(`Failed to fetch members: ${error.message}`);
        return data;
    }

    /**
     * @description Get a member by username with their social links
     */
    static async getByUsername(username: string): Promise<Member> {
        const { data, error } = await supabase
            .from('members')
            .select(this.SELECT_QUERY)
            .eq('username', username)
            .single();

        if (error || !data) throw new Error('Member not found');
        return data;
    }

    /**
     * @description Create a new member with their user ID
     */
    static async create(input: CreateMemberInput): Promise<Member> {
        const { data, error } = await supabase
            .from('members')
            .insert({
                id: input.id,
                username: input.username,
                role: input.role,
                bio: input.bio,
                avatar_url: input.avatar_url,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select(this.SELECT_QUERY)
            .single();

        if (error) {
            // Cleanup avatar if member creation fails
            if (input.avatar_url) {
                await deleteOldAvatar(input.avatar_url);
            }
            throw new Error(`Failed to create member: ${error.message}`);
        }

        return data;
    }

    /**
     * @description Update a member's information
     */
    static async update(username: string, updates: Partial<Member>): Promise<Member> {
        const currentMember = await this.getByUsername(username);
        
        const { data, error } = await supabase
            .from('members')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('username', username)
            .select(this.SELECT_QUERY)
            .single();

        if (error) {
            // Cleanup new avatar if update fails
            if (updates.avatar_url) {
                await deleteOldAvatar(updates.avatar_url);
            }
            throw new Error(`Failed to update member: ${error.message}`);
        }

        // Delete old avatar if new one was uploaded successfully
        if (updates.avatar_url && currentMember.avatar_url) {
            await deleteOldAvatar(currentMember.avatar_url);
        }

        return data;
    }

    /**
     * @description Delete a member and their avatar
     */    static async delete(username: string): Promise<void> {
        const member = await this.getByUsername(username);
        
        const { error } = await supabase
            .from('members')
            .delete()
            .eq('username', username);

        if (error) throw new Error(`Failed to delete member: ${error.message}`);

        // Delete avatar after member is deleted successfully
        if (member.avatar_url) {
            await deleteOldAvatar(member.avatar_url);
        }
    }

    /**
     * @description Handle avatar upload and cleanup old avatar if exists
     */
    static async handleAvatar(avatar: Buffer, username: string): Promise<string> {
        const imageValidation = validateImage(avatar);
        if (!imageValidation.isValid) {
            throw new Error(imageValidation.error || 'Invalid image format');
        }
        return await uploadAvatar(avatar, username);
    }
}
