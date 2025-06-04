import { supabase } from '../config/supabase';
import {
    Article,
    ArticleDbInput,
    ArticleDbUpdate
} from '../types/articleTypes';
import { generateSlug } from '../utils/slugUtils';
import { TagService } from './tagService';
import { Tag } from '../types/tagTypes';
import { DatabaseError, NotFoundError, ForbiddenError } from '../utils/errors';

const TABLE_ARTICLES = 'articles';
const TABLE_ARTICLE_TAGS = 'article_tags';

/**
 * @description Service layer for article management
 */
export class ArticleService {
    private static readonly ARTICLE_FIELDS_SELECT = `
        id,
        member_id,
        slug,
        title,
        description,
        content,
        published,
        verified,
        created_at,
        updated_at
    `;

    /**
     * @description Fetches tags for a given article ID.
     */
    private static async _getArticleTags(articleId: string): Promise<Tag[]> {
        try {
            const { data: tagRelations, error: relationError } = await supabase
                .from(TABLE_ARTICLE_TAGS)
                .select('tag_id')
                .eq('article_id', articleId);

            if (relationError) {
                console.error(`Error fetching tag relations for article ${articleId}:`, relationError);
                return [];
            }
            if (!tagRelations || tagRelations.length === 0) return [];

            const tagIds = tagRelations.map(r => r.tag_id);
            return await TagService.getTagsByIds(tagIds);

        } catch (error) {
            console.error(`Error fetching tags for article ${articleId}:`, error);
            return [];
        }
    }

    /**
     * @description Manages (clears and inserts) tag associations for an entity.
     */
    private static async _manageTags(tagNames: string[] | undefined | null, entityId: string): Promise<string[]> {
        const idFieldName = 'article_id';

        const { error: deleteError } = await supabase
            .from(TABLE_ARTICLE_TAGS)
            .delete()
            .eq(idFieldName, entityId);

        if (deleteError) {
            console.error(`Error clearing old tags for ${idFieldName} ${entityId} in ${TABLE_ARTICLE_TAGS}:`, deleteError);
            throw new DatabaseError(`Failed to clear old tags: ${deleteError.message}`);
        }

        if (!tagNames || tagNames.length === 0) {
            return [];
        }

        const uniqueTagNames = [...new Set(tagNames.map(name => name.trim()).filter(Boolean))];
        if (uniqueTagNames.length === 0) return [];

        const tagPromises = uniqueTagNames.map(name => TagService.createTag({ name }));
        const tags = await Promise.all(tagPromises);
        const tagIds = tags.map(tag => tag.id);

        const associations = tagIds.map(tagId => ({
            [idFieldName]: entityId,
            tag_id: tagId
        }));

        const { error: insertError } = await supabase
            .from(TABLE_ARTICLE_TAGS)
            .insert(associations);

        if (insertError) {
            console.error(`Error inserting new tags for ${idFieldName} ${entityId} in ${TABLE_ARTICLE_TAGS}:`, insertError);
            throw new DatabaseError(`Failed to insert new tags: ${insertError.message}`);
        }

        return tagIds;
    }

    /**
     * @description Get all published articles with their tags.
     * TODO: Add pagination, filtering by tags, etc. in the future.
     */
    static async getAllArticles(requestingMemberId?: string): Promise<Article[]> {
        let query = supabase
            .from(TABLE_ARTICLES)
            .select(this.ARTICLE_FIELDS_SELECT)
            .order('created_at', { ascending: false });

        if (requestingMemberId) {
            // If a member is requesting, show their own articles (published or not) OR any published articles.
            // This OR condition might be complex for Supabase direct query. 
            // A simpler approach: fetch all by member, then fetch all published, then merge and deduplicate.
            // Or, adjust query to be `(published = true OR member_id = requestingMemberId)`
            query = query.or(`published.eq.true,member_id.eq.${requestingMemberId}`);
        } else {
            // No member requesting, only show published articles
            query = query.eq('published', true);
        }

        const { data, error } = await query;

        if (error) throw new DatabaseError(`Failed to fetch articles: ${error.message}`);
        if (!data) return [];

        const articlesWithTags = await Promise.all(data.map(async (article) => ({
            ...article,
            tags: await this._getArticleTags(article.id)
        })));

        return articlesWithTags;
    }

    /**
     * @description Get a specific article by its slug, including tags.
     * It fetches the article only if it's published, or if the requesting member is the author.
     */
    static async getArticleBySlug(slug: string, requestingMemberId?: string): Promise<Article | null> {
        const { data, error } = await supabase
            .from(TABLE_ARTICLES)
            .select(this.ARTICLE_FIELDS_SELECT)
            .eq('slug', slug)
            .maybeSingle();

        if (error) {
            throw new DatabaseError(`Failed to fetch article by slug: ${error.message}`);
        }
        if (!data) {
            return null;
        }

        if (!data.published && data.member_id !== requestingMemberId) {
            return null;
        }

        return {
            ...data,
            tags: await this._getArticleTags(data.id)
        };
    }
    
    private static async getArticleBySlugInternal(slug: string): Promise<Pick<Article, 'id' | 'slug' | 'member_id' | 'published'> | null> {
        const { data, error } = await supabase
            .from(TABLE_ARTICLES)
            .select('id, slug, member_id, published')
            .eq('slug', slug)
            .maybeSingle();
        if (error) {
            console.error(`Internal error fetching article by slug ${slug}:`, error);
            return null;
        }
        return data;
    }

    /**
     * @description Create a new article, managing tags.
     */
    static async createArticle(input: ArticleDbInput): Promise<Article> {
        const { member_id, title, description, content, tagNames } = input;
        
        let slug = generateSlug(title);
        let existingArticle = await this.getArticleBySlugInternal(slug);
        let suffix = 1;
        while (existingArticle) {
            slug = `${generateSlug(title)}-${suffix}`;
            existingArticle = await this.getArticleBySlugInternal(slug);
            suffix++;
        }

        const articleToInsert = {
            member_id,
            title,
            description,
            content,
            slug,
            published: false,
            verified: false,
        };

        const { data: newArticle, error } = await supabase
            .from(TABLE_ARTICLES)
            .insert(articleToInsert)
            .select(this.ARTICLE_FIELDS_SELECT)
            .single();

        if (error || !newArticle) {
            console.error('Error creating article:', error);
            if (error?.code === '23505') {
                throw new DatabaseError('An article with a similar title (resulting in a duplicate slug) already exists. Please try a slightly different title.');
            }
            throw new DatabaseError('Failed to create article.');
        }

        const newTagIds = await this._manageTags(tagNames, newArticle.id);
        const tags = newTagIds.length > 0 ? await TagService.getTagsByIds(newTagIds) : [];

        return { ...newArticle, tags } as Article;
    }

    /**
     * @description Update an article, managing tags. User must be the author.
     * Slugs are not updatable through this method to preserve permalinks.
     */
    static async updateArticle(articleSlug: string, input: ArticleDbUpdate, requestingMemberId: string): Promise<Article> {
        const { tagNames, ...articleUpdates } = input;

        const existingArticle = await this.getArticleBySlugInternal(articleSlug);
        if (!existingArticle) {
            throw new NotFoundError('Article not found.');
        }
        if (existingArticle.member_id !== requestingMemberId) {
            throw new ForbiddenError('You do not have permission to update this article.');
        }

        delete (articleUpdates as any).published;
        delete (articleUpdates as any).verified;

        const hasMeaningfulUpdate = Object.keys(articleUpdates).length > 0;

        if (!hasMeaningfulUpdate && (tagNames === undefined)) {
            const currentArticleData = await this.getArticleBySlug(articleSlug, requestingMemberId);
            if (!currentArticleData) throw new NotFoundError('Article not found after no-op update check.');
            return currentArticleData;
        }
        
        let updatedArticleData: Omit<Article, 'tags'> | null = null;

        if (hasMeaningfulUpdate) {
            const { data, error } = await supabase
                .from(TABLE_ARTICLES)
                .update({ ...articleUpdates, updated_at: new Date().toISOString() })
                .eq('id', existingArticle.id)
                .select(this.ARTICLE_FIELDS_SELECT)
                .single();

            if (error) {
                 if (error.code === 'PGRST116') throw new NotFoundError('Article not found for update.');
                 throw new DatabaseError(`Failed to update article data: ${error.message}`);
            }
            updatedArticleData = data;
        } else {
            const currentData = await supabase
                .from(TABLE_ARTICLES)
                .select(this.ARTICLE_FIELDS_SELECT)
                .eq('id', existingArticle.id)
                .single();
            if (currentData.error || !currentData.data) throw new DatabaseError('Failed to fetch article data for tag-only update.');
            updatedArticleData = currentData.data;
        }

        const updatedTagIds = await this._manageTags(tagNames, existingArticle.id);
        const tags = updatedTagIds.length > 0 ? await TagService.getTagsByIds(updatedTagIds) : [];
        
        return { ...updatedArticleData!, tags } as Article;
    }

    /**
     * @description Delete an article. User must be the author.
     */
    static async deleteArticle(articleSlug: string, requestingMemberId: string): Promise<void> {
        const article = await this.getArticleBySlugInternal(articleSlug);

        if (!article) {
            throw new NotFoundError('Article not found.');
        }

        if (article.member_id !== requestingMemberId) {
            throw new ForbiddenError('You do not have permission to delete this article.');
        }

        const { error } = await supabase
            .from(TABLE_ARTICLES)
            .delete()
            .eq('id', article.id);

        if (error) {
            console.error(`Failed to delete article ${article.id}:`, error);
            throw new DatabaseError(`Failed to delete article: ${error.message}`);
        }
    }
}
