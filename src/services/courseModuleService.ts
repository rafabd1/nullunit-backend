import { supabase } from '../config/supabase';
import {
    CourseModule,
    CourseModuleDbInput,
    CourseModuleDbUpdate
} from '../types/courseTypes';
import { CourseService } from './courseService'; // Para verificar o proprietário do curso
import { DatabaseError, NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';

const TABLE_COURSE_MODULES = 'course_modules';

export class CourseModuleService {
    private static readonly MODULE_FIELDS_SELECT = `
        id,
        course_id,
        title,
        description,
        order,
        created_at,
        updated_at
    `;

    /**
     * @description Get all modules for a specific course, ordered by 'order'.
     * Publicly accessible if the course itself is accessible.
     */
    static async getAllModulesForCourse(courseSlug: string): Promise<CourseModule[]> {
        const courseMeta = await CourseService.getCourseBySlug(courseSlug); // Verifica se o curso existe e se está publicado (se getAllCourses filtrar por isso)
        if (!courseMeta) {
            throw new NotFoundError('Course not found, so cannot fetch modules.');
        }
        // Adicionar aqui uma verificação se o curso não estiver publicado e o usuário não for admin/dono (futuro)

        const { data, error } = await supabase
            .from(TABLE_COURSE_MODULES)
            .select(this.MODULE_FIELDS_SELECT)
            .eq('course_id', courseMeta.id)
            .order('order', { ascending: true });

        if (error) {
            throw new DatabaseError(`Failed to fetch modules for course ${courseSlug}: ${error.message}`);
        }
        return data || [];
    }
    
    /**
     * @description Get a specific module by its ID.
     * Primarily for internal use or when module ID is known directly.
     * For public fetching, consider route through course slug and module order/slug if implemented.
     */
    static async getModuleById(moduleId: string): Promise<CourseModule | null> {
        const { data, error } = await supabase
            .from(TABLE_COURSE_MODULES)
            .select(this.MODULE_FIELDS_SELECT)
            .eq('id', moduleId)
            .maybeSingle();

        if (error) {
            throw new DatabaseError(`Failed to fetch module by ID ${moduleId}: ${error.message}`);
        }
        return data;
    }


    static async createModule(courseSlug: string, input: CourseModuleDbInput, requestingMemberId: string): Promise<CourseModule> {
        const courseMeta = await CourseService.getCourseOwnerAndIdBySlug(courseSlug);
        if (!courseMeta) {
            throw new NotFoundError(`Course with slug "${courseSlug}" not found.`);
        }
        if (courseMeta.ownerId !== requestingMemberId) {
            throw new ForbiddenError('You do not have permission to add modules to this course.');
        }

        const { title, description, order } = input;

        if (order === undefined || order < 0) {
            throw new ValidationError("Module 'order' must be a non-negative integer.");
        }
        
        const moduleToInsert = {
            course_id: courseMeta.courseId,
            title,
            description,
            order
        };

        const { data: newModule, error } = await supabase
            .from(TABLE_COURSE_MODULES)
            .insert(moduleToInsert)
            .select(this.MODULE_FIELDS_SELECT)
            .single();

        if (error || !newModule) {
            console.error('Error creating course module:', error);
            // TODO: Check for specific error codes, e.g., unique constraint on (course_id, order) if added
            throw new DatabaseError('Failed to create course module.');
        }
        return newModule;
    }

    static async updateModule(moduleId: string, courseSlug: string, input: CourseModuleDbUpdate, requestingMemberId: string): Promise<CourseModule> {
        const courseMeta = await CourseService.getCourseOwnerAndIdBySlug(courseSlug);
        if (!courseMeta) {
            throw new NotFoundError(`Course with slug "${courseSlug}" not found.`);
        }
        if (courseMeta.ownerId !== requestingMemberId) {
            throw new ForbiddenError('You do not have permission to update modules in this course.');
        }

        const existingModule = await this.getModuleById(moduleId);
        if (!existingModule) {
            throw new NotFoundError('Module not found.');
        }
        if (existingModule.course_id !== courseMeta.courseId) {
            throw new ForbiddenError('Module does not belong to the specified course.');
        }
        
        const { title, description, order } = input;
        if (order !== undefined && order < 0) {
            throw new ValidationError("Module 'order' must be a non-negative integer.");
        }

        const moduleUpdates: Partial<CourseModuleDbUpdate & { updated_at: string }> = { ...input };
        
        // Ensure at least one field is being updated
        if (Object.keys(moduleUpdates).length === 0) {
            return existingModule; // No actual update to perform
        }
        moduleUpdates.updated_at = new Date().toISOString();


        const { data: updatedModule, error } = await supabase
            .from(TABLE_COURSE_MODULES)
            .update(moduleUpdates)
            .eq('id', moduleId)
            .select(this.MODULE_FIELDS_SELECT)
            .single();

        if (error || !updatedModule) {
            if (error?.code === 'PGRST116') throw new NotFoundError('Module not found for update.');
            console.error(`Error updating module ${moduleId}:`, error);
            throw new DatabaseError('Failed to update course module.');
        }
        return updatedModule;
    }

    static async deleteModule(moduleId: string, courseSlug: string, requestingMemberId: string): Promise<void> {
        const courseMeta = await CourseService.getCourseOwnerAndIdBySlug(courseSlug);
        if (!courseMeta) {
            throw new NotFoundError(`Course with slug "${courseSlug}" not found.`);
        }
        if (courseMeta.ownerId !== requestingMemberId) {
            throw new ForbiddenError('You do not have permission to delete modules from this course.');
        }

        const existingModule = await this.getModuleById(moduleId);
        if (!existingModule) {
            throw new NotFoundError('Module not found.');
        }
        if (existingModule.course_id !== courseMeta.courseId) {
            throw new ForbiddenError('Module does not belong to the specified course.');
        }

        // Lessons associated with this module should be deleted by ON DELETE CASCADE in the database
        const { error } = await supabase
            .from(TABLE_COURSE_MODULES)
            .delete()
            .eq('id', moduleId);

        if (error) {
            console.error(`Failed to delete module ${moduleId}:`, error);
            throw new DatabaseError(`Failed to delete course module: ${error.message}`);
        }
    }
} 