import { supabase } from '../config/supabase';
import { Tag, TagDbInput, TagDbUpdate } from '../types/tagTypes';
import { DatabaseError } from '../utils/errors';

const TABLE_TAGS = 'tags';
const TABLE_ARTICLE_MODULE_TAGS = 'article_module_tags';
const TABLE_SUB_ARTICLE_TAGS = 'sub_article_tags';
const TABLE_PROJECT_TAGS = 'project_tags';

export class TagService {

    /**
     * Cria uma nova tag.
     * Verifica se já existe uma tag com o mesmo nome (case-insensitive).
     */
    static async createTag(data: TagDbInput): Promise<Tag> {
        const { name } = data;

        // 1. Verificar se tag com mesmo nome já existe (case-insensitive)
        const { data: existing, error: selectError } = await supabase
            .from(TABLE_TAGS)
            .select('id, name')
            .ilike('name', name) // Case-insensitive match
            .maybeSingle();

        if (selectError) {
            console.error('Error checking for existing tag:', selectError);
            throw new DatabaseError(`Failed to check for existing tag: ${selectError.message}`);
        }

        if (existing) {
            // Se já existe, retorna a tag existente em vez de criar duplicata
            // Ou poderia lançar um erro 409 (Conflict), dependendo da preferência
             console.warn(`Tag with name "${name}" already exists with ID ${existing.id}. Returning existing tag.`);
            return existing as Tag;
            // throw new Error(`Tag with name "${name}" already exists.`); // Alternativa: lançar erro
        }

        // 2. Criar a nova tag
        const { data: newTag, error: insertError } = await supabase
            .from(TABLE_TAGS)
            .insert({ name: name.trim() })
            .select()
            .single();

        if (insertError || !newTag) {
            console.error('Error creating tag:', insertError);
            throw new DatabaseError(`Failed to create tag: ${insertError?.message || 'Unknown error'}`);
        }

        return newTag as Tag;
    }

    /**
     * Lista todas as tags.
     */
    static async getAllTags(): Promise<Tag[]> {
        const { data, error } = await supabase
            .from(TABLE_TAGS)
            .select('id, name')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching tags:', error);
            throw new DatabaseError(`Failed to fetch tags: ${error.message}`);
        }

        return data || [];
    }

    /**
     * Obtém uma tag específica pelo ID.
     */
    static async getTagById(id: string): Promise<Tag | null> {
        const { data, error } = await supabase
            .from(TABLE_TAGS)
            .select('id, name')
            .eq('id', id)
            .maybeSingle();
        
        if (error) {
            console.error(`Error fetching tag with ID ${id}:`, error);
            // Não lançar erro aqui, apenas retornar null se não encontrado ou erro
            // throw new DatabaseError(`Failed to fetch tag: ${error.message}`);
        }

        return data || null;
    }

    /**
     * Atualiza o nome de uma tag existente.
     * Verifica se o novo nome já está em uso por outra tag.
     */
    static async updateTag(id: string, data: TagDbUpdate): Promise<Tag | null> {
        const { name } = data;

        if (!name) {
             throw new Error('Tag name cannot be empty for update.');
        }

        const trimmedName = name.trim();

        // 1. Verificar se o novo nome já existe em OUTRA tag (case-insensitive)
        const { data: conflictingTag, error: selectError } = await supabase
            .from(TABLE_TAGS)
            .select('id')
            .ilike('name', trimmedName)
            .neq('id', id) // Excluir a própria tag que estamos atualizando
            .maybeSingle();
        
        if (selectError) {
             console.error('Error checking for conflicting tag name:', selectError);
            throw new DatabaseError(`Failed to check for conflicting tag name: ${selectError.message}`);
        }

        if (conflictingTag) {
            throw new Error(`Another tag with the name "${trimmedName}" already exists.`); // 409 Conflict
        }

        // 2. Atualizar a tag
        const { data: updatedTag, error: updateError } = await supabase
            .from(TABLE_TAGS)
            .update({ name: trimmedName })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            if (updateError.code === 'PGRST116') { // Supabase code for 0 rows updated (not found)
                return null;
            }
            console.error(`Error updating tag with ID ${id}:`, updateError);
            throw new DatabaseError(`Failed to update tag: ${updateError.message}`);
        }

        return updatedTag as Tag;
    }

    /**
     * Deleta uma tag e suas associações.
     */
    static async deleteTag(id: string): Promise<{ count: number }> {
         // Nota: As exclusões de associações abaixo são uma camada extra de segurança.
         // Se 'ON DELETE CASCADE' está corretamente configurado nas foreign keys
         // das tabelas de junção no banco de dados, o Supabase/Postgres
         // deve remover automaticamente as associações quando a tag for deletada.

        const deletePromises = [
            supabase.from(TABLE_ARTICLE_MODULE_TAGS).delete().eq('tag_id', id),
            supabase.from(TABLE_SUB_ARTICLE_TAGS).delete().eq('tag_id', id),
            supabase.from(TABLE_PROJECT_TAGS).delete().eq('tag_id', id)
        ];

        const results = await Promise.allSettled(deletePromises);
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                 // Logar o erro, mas continuar para tentar deletar a tag principal
                 // Poderia lançar um erro aqui se a remoção de associações for crítica
                 console.error(`Error deleting associations for tag ${id} from table ${index}:`, result.reason);
             }
         });

        // Agora deleta a tag principal
        const { count, error: deleteError } = await supabase
            .from(TABLE_TAGS)
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error(`Error deleting tag with ID ${id}:`, deleteError);
            throw new DatabaseError(`Failed to delete tag: ${deleteError.message}`);
        }

        if (count === 0) {
             // Isso pode acontecer se a tag já foi deletada ou o ID é inválido
             // Pode ser útil retornar 0 ou lançar um erro 404
             console.warn(`Attempted to delete tag with ID ${id}, but it was not found.`);
             // throw new Error('Tag not found'); // Alternativa: lançar 404
        }

        return { count: count ?? 0 };
    }

    /**
     * Obtém todas as tags associadas a um Article Module ID.
     */
    static async getTagsByModuleId(moduleId: string): Promise<Tag[]> {
        const { data, error } = await supabase
            .from(TABLE_ARTICLE_MODULE_TAGS)
            .select(`
                tags (id, name)
            `)
            .eq('article_module_id', moduleId);

        if (error) {
            console.error(`Error fetching tags for module ID ${moduleId}:`, error);
            throw new DatabaseError(`Failed to fetch tags for module: ${error.message}`);
        }
        
        // O resultado será [{ tags: {id, name} }, ...], precisamos extrair
        return (data?.map(item => item.tags).filter(tag => tag !== null) as Tag[]) || [];
    }

    /**
     * Obtém todas as tags associadas a um Sub Article ID.
     */
    static async getTagsBySubArticleId(subArticleId: string): Promise<Tag[]> {
        const { data, error } = await supabase
            .from(TABLE_SUB_ARTICLE_TAGS)
            .select(`
                tags (id, name)
            `)
            .eq('sub_article_id', subArticleId);

        if (error) {
            console.error(`Error fetching tags for sub-article ID ${subArticleId}:`, error);
            throw new DatabaseError(`Failed to fetch tags for sub-article: ${error.message}`);
        }

        return (data?.map(item => item.tags).filter(tag => tag !== null) as Tag[]) || [];
    }

    /**
     * Obtém todas as tags associadas a um Project ID.
     */
    static async getTagsByProjectId(projectId: string): Promise<Tag[]> {
        const { data, error } = await supabase
            .from(TABLE_PROJECT_TAGS)
            .select(`
                tags (id, name)
            `)
            .eq('project_id', projectId);

        if (error) {
            console.error(`Error fetching tags for project ID ${projectId}:`, error);
            throw new DatabaseError(`Failed to fetch tags for project: ${error.message}`);
        }

        return (data?.map(item => item.tags).filter(tag => tag !== null) as Tag[]) || [];
    }

    /**
     * Obtém múltiplas tags por seus IDs.
     */
    static async getTagsByIds(ids: string[]): Promise<Tag[]> {
        if (!ids || ids.length === 0) return [];
        
        const { data, error } = await supabase
            .from(TABLE_TAGS)
            .select('id, name')
            .in('id', ids);

        if (error) {
            console.error('Error fetching tags by IDs:', error);
            throw new DatabaseError(`Failed to fetch tags by IDs: ${error.message}`);
        }
        return data || [];
    }
} 