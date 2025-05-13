import { supabase } from '../config/supabase';
import { ContentType, Like } from '../types/permissions';

/**
 * @description Service layer for like management
 */
export class LikeService {
    /**
     * @description Toggle like status for content
     */
    static async toggleLike(userId: string, contentType: ContentType, contentId: string): Promise<boolean> {
        // First check if like exists
        const { data: existingLike } = await supabase
            .from('likes')
            .select('id')
            .eq('user_id', userId)
            .eq('content_type', contentType)
            .eq('content_id', contentId)
            .single();

        if (existingLike) {
            // Unlike: remove existing like
            const { error } = await supabase
                .from('likes')
                .delete()
                .eq('id', existingLike.id);

            if (error) throw new Error(`Failed to remove like: ${error.message}`);
            return false; // Returns false to indicate content is now unliked
        }

        // Like: create new like
        const { error } = await supabase
            .from('likes')
            .insert({
                user_id: userId,
                content_type: contentType,
                content_id: contentId,
                created_at: new Date().toISOString()
            });

        if (error) throw new Error(`Failed to add like: ${error.message}`);
        return true; // Returns true to indicate content is now liked
    }

    /**
     * @description Get like count for content
     */
    static async getLikeCount(contentType: ContentType, contentId: string): Promise<number> {
        const { count, error } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('content_type', contentType)
            .eq('content_id', contentId);

        if (error) throw new Error(`Failed to get like count: ${error.message}`);
        return count || 0;
    }

    /**
     * @description Check if user has liked content
     */
    static async hasUserLiked(userId: string, contentType: ContentType, contentId: string): Promise<boolean> {
        const { count, error } = await supabase
            .from('likes')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('content_type', contentType)
            .eq('content_id', contentId);

        if (error) throw new Error(`Failed to check like status: ${error.message}`);
        return (count || 0) > 0;
    }

    /**
     * @description Get all likes for content
     */
    static async getContentLikes(contentType: ContentType, contentId: string): Promise<Like[]> {
        const { data, error } = await supabase
            .from('likes')
            .select('*')
            .eq('content_type', contentType)
            .eq('content_id', contentId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to get likes: ${error.message}`);
        return data;
    }

    /**
     * @description Get all liked content IDs and types for a user
     */
    static async getUserLikedContent(userId: string): Promise<Array<{ content_id: string; content_type: ContentType; liked_at: string }>> {
        const { data, error } = await supabase
            .from('likes')
            .select('content_id, content_type, created_at') // Seleciona os campos relevantes
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching user liked content:', error);
            throw new Error('Failed to get user liked content');
        }

        // Mapeia para o formato esperado, especialmente renomeando created_at para liked_at
        return data.map(like => ({
            content_id: like.content_id,
            content_type: like.content_type as ContentType, // Certifica-se de que o tipo está correto
            liked_at: like.created_at
        }));
    }
}
