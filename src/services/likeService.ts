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
}
