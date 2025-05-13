import { supabase } from '../config/supabase';
import { 
    ArticleModule, 
    SubArticle, 
    ModuleDbInput, 
    SubArticleDbInput, 
    ModuleDbUpdate, 
    SubArticleDbUpdate 
} from '../types/articleTypes';
import { generateSlug } from '../utils/slugUtils';
import { TagService } from './tagService';
import { Tag } from '../types/tagTypes';
import { DatabaseError } from '../utils/errors';

const TABLE_MODULE_TAGS = 'article_module_tags';
const TABLE_SUB_ARTICLE_TAGS = 'sub_article_tags';

/**
 * @description Service layer for article management
 */
export class ArticleService {
    private static readonly SUB_ARTICLE_FIELDS = `
        id,
        module_id,
        slug,
        title,
        content,
        created_at,
        updated_at
    `;

    private static readonly MODULE_QUERY = `
        id,
        member_id,
        slug,
        title,
        description,
        created_at,
        updated_at,
        sub_articles (
            ${this.SUB_ARTICLE_FIELDS.split('\n').map(l => l.trim()).filter(Boolean).join(',')}
        )
    `;

    private static async _getModuleTags(moduleId: string): Promise<Tag[]> {
        try {
            return await TagService.getTagsByModuleId(moduleId);
        } catch (error) {
            console.error(`Error fetching tags for module ${moduleId}:`, error);
            return [];
        }
    }

    private static async _getSubArticleTags(subArticleId: string): Promise<Tag[]> {
        try {
            return await TagService.getTagsBySubArticleId(subArticleId);
        } catch (error) {
            console.error(`Error fetching tags for sub-article ${subArticleId}:`, error);
            return [];
        }
    }

    private static async _manageTags(tagNames: string[] | undefined | null, entityId: string, associationTable: string, idFieldName: string): Promise<string[]> {
        if (!tagNames || tagNames.length === 0) {
            const { error: deleteError } = await supabase
                .from(associationTable)
                .delete()
                .eq(idFieldName, entityId);
            if (deleteError) {
                console.error(`Error clearing tags for ${idFieldName} ${entityId} in ${associationTable}:`, deleteError);
            }
            return [];
        }

        const uniqueTagNames = [...new Set(tagNames.map(name => name.trim()).filter(Boolean))];
        if (uniqueTagNames.length === 0) return [];

        const tagPromises = uniqueTagNames.map(name => TagService.createTag({ name }));
        const tags = await Promise.all(tagPromises);
        const tagIds = tags.map(tag => tag.id);

        const { error: deleteError } = await supabase
            .from(associationTable)
            .delete()
            .eq(idFieldName, entityId);
        
        if (deleteError) {
            console.error(`Error clearing old tags for ${idFieldName} ${entityId} in ${associationTable}:`, deleteError);
            throw new DatabaseError(`Failed to clear old tags: ${deleteError.message}`);
        }

        const associations = tagIds.map(tagId => ({
            [idFieldName]: entityId,
            tag_id: tagId
        }));

        const { error: insertError } = await supabase
            .from(associationTable)
            .insert(associations);

        if (insertError) {
            console.error(`Error inserting new tags for ${idFieldName} ${entityId} in ${associationTable}:`, insertError);
            throw new DatabaseError(`Failed to insert new tags: ${insertError.message}`);
        }

        return tagIds;
    }

    /**
     * @description Get all article modules with their sub-articles and tags
     */
    static async getAllModules(): Promise<ArticleModule[]> {
        const { data, error } = await supabase
            .from('article_modules')
            .select(this.MODULE_QUERY)
            .order('created_at', { ascending: false });

        if (error) throw new DatabaseError(`Failed to fetch article modules: ${error.message}`);
        if (!data) return [];

        const modulesWithTags = await Promise.all(data.map(async (module) => ({
            ...module,
            tags: await this._getModuleTags(module.id),
            sub_articles: module.sub_articles 
                ? await Promise.all(module.sub_articles.map(async (sub) => ({
                    ...sub,
                    tags: await this._getSubArticleTags(sub.id)
                  })))
                : []
        })));

        return modulesWithTags;
    }

    /**
     * @description Get a specific article module by its slug, including tags
     */
    static async getModuleBySlug(slug: string): Promise<ArticleModule | null> {
        const { data, error } = await supabase
            .from('article_modules')
            .select(this.MODULE_QUERY)
            .eq('slug', slug)
            .maybeSingle();

        if (error) {
            throw new DatabaseError(`Failed to fetch article module: ${error.message}`);
        }
        if (!data) {
            return null;
        }

        const moduleWithTags = {
            ...data,
            tags: await this._getModuleTags(data.id),
            sub_articles: data.sub_articles 
                ? await Promise.all(data.sub_articles.map(async (sub) => ({
                    ...sub,
                    tags: await this._getSubArticleTags(sub.id)
                  })))
                : []
        };

        return moduleWithTags;
    }

    /**
     * @description Create a new article module, managing tags
     */
    static async createModule(input: ModuleDbInput): Promise<ArticleModule> { 
        const { member_id, title, description, tagNames } = input;
        
        let slug = generateSlug(title);
        let existingModule = await this.getModuleBySlugInternal(slug);
        let suffix = 1;
        while (existingModule) {
            slug = `${generateSlug(title)}-${suffix}`;
            existingModule = await this.getModuleBySlugInternal(slug);
            suffix++;
        }

        const { data: newModule, error } = await supabase
            .from('article_modules')
            .insert({ 
                member_id,
                title, 
                description,
                slug
            })
            .select()
            .single();

        if (error || !newModule) {
            console.error('Error creating article module:', error);
            if (error?.code === '23505') {
                throw new DatabaseError('A module with a similar title (resulting in a duplicate slug) already exists. Please try a slightly different title.');
            }
            throw new DatabaseError('Failed to create article module.');
        }

        const tagIds = await this._manageTags(tagNames, newModule.id, TABLE_MODULE_TAGS, 'article_module_id');
        const tags = tagIds.length > 0 ? await TagService.getTagsByIds(tagIds) : []; 

        return { ...newModule, tags, sub_articles: [] };
    }

    /**
     * @description Update an article module, managing tags
     */
    static async updateModule(moduleId: string, input: ModuleDbUpdate): Promise<ArticleModule> { 
        const { tagNames, ...moduleUpdates } = input;
        
        if ('slug' in moduleUpdates) {
            console.warn('Attempted to update slug in ArticleService.updateModule. Slug updates are not directly supported here.');
            delete (moduleUpdates as any).slug;
        }

        let updatedModuleData: ArticleModule | null = null;

        if (Object.keys(moduleUpdates).length > 0) {
            const { data, error } = await supabase
                .from('article_modules')
                .update({ ...moduleUpdates, updated_at: new Date().toISOString() })
                .eq('id', moduleId)
                .select(this.MODULE_QUERY)
                .single();

            if (error) {
                 if (error.code === 'PGRST116') throw new DatabaseError('Module not found for update.');
                 throw new DatabaseError(`Failed to update module data: ${error.message}`);
            }
            updatedModuleData = data;
        } else {
             updatedModuleData = await this.getModuleByIdInternal(moduleId); 
             if (!updatedModuleData) throw new DatabaseError('Module not found.');
        }

        const tagIds = await this._manageTags(tagNames, moduleId, TABLE_MODULE_TAGS, 'article_module_id');
        const tags = tagIds.length > 0 ? await TagService.getTagsByIds(tagIds) : [];
        
        const subArticles = updatedModuleData.sub_articles 
            ? await Promise.all(updatedModuleData.sub_articles.map(async (sub) => ({
                ...sub,
                tags: await this._getSubArticleTags(sub.id)
              })))
            : [];

        return { ...updatedModuleData, tags, sub_articles: subArticles };
    }

    /**
     * @description Create a new sub-article, managing tags
     */
    static async createSubArticle(input: SubArticleDbInput): Promise<SubArticle> { 
        const { module_id, title, content, tagNames } = input;
        
        let slug = generateSlug(title);
        let existingArticle = await this.getSubArticleByModuleIdAndSlug(module_id, slug);
        let suffix = 1;
        while (existingArticle) {
            slug = `${generateSlug(title)}-${suffix}`;
            existingArticle = await this.getSubArticleByModuleIdAndSlug(module_id, slug);
            suffix++;
        }

        const { data: newSubArticle, error } = await supabase
            .from('sub_articles')
            .insert({ 
                module_id, 
                title, 
                content,
                slug
            })
            .select(this.SUB_ARTICLE_FIELDS)
            .single();

        if (error || !newSubArticle) {
            console.error('Error creating sub-article:', error);
            if (error?.code === '23505') {
                throw new DatabaseError('A sub-article with a similar title (resulting in a duplicate slug) already exists within this module. Please try a slightly different title.');
            }
            throw new DatabaseError('Failed to create sub-article.');
        }

        const tagIds = await this._manageTags(tagNames, newSubArticle.id, TABLE_SUB_ARTICLE_TAGS, 'sub_article_id');
        const tags = tagIds.length > 0 ? await TagService.getTagsByIds(tagIds) : [];

        return { ...newSubArticle, tags };
    }

    /**
     * @description Get a specific sub-article by its slug and module slug, including tags
     */
    static async getSubArticleBySlug(moduleSlug: string, subArticleSlug: string): Promise<SubArticle | null> {
        const { data: module, error: moduleError } = await supabase
            .from('article_modules')
            .select('id')
            .eq('slug', moduleSlug)
            .maybeSingle();

        if (moduleError) throw new DatabaseError(`Failed to fetch module: ${moduleError.message}`);
        if (!module) return null;

        const { data, error } = await supabase
            .from('sub_articles')
            .select(this.SUB_ARTICLE_FIELDS)
            .eq('module_id', module.id)
            .eq('slug', subArticleSlug)
            .maybeSingle();

        if (error) throw new DatabaseError(`Failed to fetch sub-article: ${error.message}`);
        if (!data) return null;

        const tags = await this._getSubArticleTags(data.id);

        return { ...data, tags };
    }

    /**
     * @description Delete an article module and all its sub-articles
     * (ON DELETE CASCADE should handle sub-articles and tag associations)
     */
    static async deleteModule(moduleId: string): Promise<void> {
        const { error } = await supabase
            .from('article_modules')
            .delete()
            .eq('id', moduleId);

        if (error) throw new DatabaseError(`Failed to delete article module: ${error.message}`);
    }

    /**
     * @description Update a sub-article, managing tags
     */
    static async updateSubArticle(articleId: string, input: SubArticleDbUpdate): Promise<SubArticle> { 
         const { tagNames, ...subArticleUpdates } = input;

        if ('slug' in subArticleUpdates) {
            console.warn('Attempted to update slug in ArticleService.updateSubArticle. Slug updates are not directly supported here.');
            delete (subArticleUpdates as any).slug;
        }

        let updatedSubArticleData: SubArticle | null = null;

        if (Object.keys(subArticleUpdates).length > 0) {
             const { data, error } = await supabase
                .from('sub_articles')
                .update({ ...subArticleUpdates, updated_at: new Date().toISOString() })
                .eq('id', articleId)
                .select(this.SUB_ARTICLE_FIELDS)
                .single();
            
             if (error) {
                 if (error.code === 'PGRST116') throw new DatabaseError('Sub-article not found for update.');
                 throw new DatabaseError(`Failed to update sub-article data: ${error.message}`);
             }
             updatedSubArticleData = data;
        } else {
             updatedSubArticleData = await this.getSubArticleByIdInternal(articleId);
             if (!updatedSubArticleData) throw new DatabaseError('Sub-article not found.');
        }

        const tagIds = await this._manageTags(tagNames, articleId, TABLE_SUB_ARTICLE_TAGS, 'sub_article_id');
        const tags = tagIds.length > 0 ? await TagService.getTagsByIds(tagIds) : [];

        return { ...updatedSubArticleData, tags };
    }

    /**
     * @description Delete a sub-article
     * (ON DELETE CASCADE should handle tag associations)
     */
    static async deleteSubArticle(articleId: string): Promise<void> {
        const { error } = await supabase
            .from('sub_articles')
            .delete()
            .eq('id', articleId);

        if (error) throw new DatabaseError(`Failed to delete sub-article: ${error.message}`);
    }

    private static async getModuleBySlugInternal(slug: string): Promise<ArticleModule | null> {
         const { data, error } = await supabase
            .from('article_modules')
            .select('*')
            .eq('slug', slug)
            .maybeSingle();
        if (error) {
            console.error(`Internal error fetching module by slug ${slug}:`, error);
            return null;
        }
        return data;
    }
    
    private static async getModuleByIdInternal(id: string): Promise<ArticleModule | null> {
         const { data, error } = await supabase
            .from('article_modules')
            .select(this.MODULE_QUERY)
            .eq('id', id)
            .maybeSingle();
        if (error) {
            console.error(`Internal error fetching module by ID ${id}:`, error);
            return null;
        }
        return data;
    }

    static async getSubArticleByModuleIdAndSlugInternal(moduleId: string, slug: string): Promise<SubArticle | null> {
        const { data, error } = await supabase
            .from('sub_articles')
            .select(this.SUB_ARTICLE_FIELDS)
            .eq('module_id', moduleId)
            .eq('slug', slug)
            .maybeSingle();
        
        if (error) {
            console.error(`Internal error fetching sub-article by module ${moduleId} and slug ${slug}:`, error);
            return null;
        }
        return data;
    }

     private static async getSubArticleByIdInternal(id: string): Promise<SubArticle | null> {
        const { data, error } = await supabase
            .from('sub_articles')
            .select(this.SUB_ARTICLE_FIELDS)
            .eq('id', id)
            .maybeSingle();
        
        if (error) {
            console.error(`Internal error fetching sub-article by ID ${id}:`, error);
            return null;
        }
        return data;
    }

    static async getModuleById(id: string): Promise<ArticleModule | null> {
        const moduleData = await this.getModuleByIdInternal(id);
        if (!moduleData) return null;

        const tags = await this._getModuleTags(moduleData.id);
        const subArticlesWithTags = moduleData.sub_articles 
            ? await Promise.all(moduleData.sub_articles.map(async (sub) => ({
                ...sub,
                tags: await this._getSubArticleTags(sub.id)
              })))
            : [];

        return { ...moduleData, tags, sub_articles: subArticlesWithTags };
    }

    static async getSubArticleById(id: string): Promise<SubArticle | null> {
        const subArticleData = await this.getSubArticleByIdInternal(id);
        if (!subArticleData) return null;

        const tags = await this._getSubArticleTags(subArticleData.id);
        return { ...subArticleData, tags };
    }
}
