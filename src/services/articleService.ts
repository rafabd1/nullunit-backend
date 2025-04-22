import { supabase } from '../config/supabase';
import { ArticleModule, SubArticle } from '../types/database';

interface CreateArticleModuleInput {
    member_id: string;
    slug: string;
    title: string;
    description?: string;
}

interface CreateSubArticleInput {
    module_id: string;
    author_id: string;
    slug: string;
    title: string;
    content: string;
}

/**
 * @description Service layer for article management
 */
export class ArticleService {
    private static readonly MODULE_QUERY = `
        *,
        sub_articles (
            id,
            slug,
            title,
            content,
            author_id,
            published_date,
            created_at,
            updated_at
        ),
        article_module_tags (
            tags (
                id,
                name
            )
        )`;

    /**
     * @description Get all article modules with their sub-articles
     */
    static async getAllModules(): Promise<ArticleModule[]> {
        const { data, error } = await supabase
            .from('article_modules')
            .select(this.MODULE_QUERY)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch article modules: ${error.message}`);
        return data;
    }

    /**
     * @description Get an article module by slug
     */
    static async getModuleBySlug(slug: string): Promise<ArticleModule> {
        const { data, error } = await supabase
            .from('article_modules')
            .select(this.MODULE_QUERY)
            .eq('slug', slug)
            .single();

        if (error || !data) throw new Error('Article module not found');
        return data;
    }

    /**
     * @description Get a sub-article by module slug and article slug
     */
    static async getSubArticle(moduleSlug: string, articleSlug: string): Promise<SubArticle> {
        const { data: module } = await supabase
            .from('article_modules')
            .select('id')
            .eq('slug', moduleSlug)
            .single();

        if (!module) throw new Error('Article module not found');

        const { data, error } = await supabase
            .from('sub_articles')
            .select(`
                *,
                article_module:article_modules!inner(
                    id,
                    slug,
                    title
                )
            `)
            .eq('module_id', module.id)
            .eq('slug', articleSlug)
            .single();

        if (error || !data) throw new Error('Sub-article not found');
        return data;
    }

    /**
     * @description Create a new article module
     */
    static async createModule(input: CreateArticleModuleInput): Promise<ArticleModule> {
        const { data, error } = await supabase
            .from('article_modules')
            .insert({
                ...input,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select(this.MODULE_QUERY)
            .single();

        if (error) throw new Error(`Failed to create article module: ${error.message}`);
        return data;
    }

    /**
     * @description Create a new sub-article
     */
    static async createSubArticle(input: CreateSubArticleInput): Promise<SubArticle> {
        const { data, error } = await supabase
            .from('sub_articles')
            .insert({
                ...input,
                published_date: new Date().toISOString(),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw new Error(`Failed to create sub-article: ${error.message}`);
        return data;
    }

    /**
     * @description Update an article module
     */
    static async updateModule(slug: string, updates: Partial<Omit<ArticleModule, 'id' | 'created_at'>>): Promise<ArticleModule> {
        const { data, error } = await supabase
            .from('article_modules')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('slug', slug)
            .select(this.MODULE_QUERY)
            .single();

        if (error) throw new Error(`Failed to update article module: ${error.message}`);
        return data;
    }

    /**
     * @description Update a sub-article
     */
    static async updateSubArticle(moduleSlug: string, articleSlug: string, updates: Partial<Omit<SubArticle, 'id' | 'created_at'>>): Promise<SubArticle> {
        const module = await this.getModuleBySlug(moduleSlug);

        const { data, error } = await supabase
            .from('sub_articles')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('module_id', module.id)
            .eq('slug', articleSlug)
            .select()
            .single();

        if (error) throw new Error(`Failed to update sub-article: ${error.message}`);
        return data;
    }

    /**
     * @description Delete an article module and all its sub-articles
     */
    static async deleteModule(slug: string): Promise<void> {
        const { error } = await supabase
            .from('article_modules')
            .delete()
            .eq('slug', slug);

        if (error) throw new Error(`Failed to delete article module: ${error.message}`);
    }

    /**
     * @description Delete a sub-article
     */
    static async deleteSubArticle(moduleSlug: string, articleSlug: string): Promise<void> {
        const module = await this.getModuleBySlug(moduleSlug);

        const { error } = await supabase
            .from('sub_articles')
            .delete()
            .eq('module_id', module.id)
            .eq('slug', articleSlug);

        if (error) throw new Error(`Failed to delete sub-article: ${error.message}`);
    }
}
