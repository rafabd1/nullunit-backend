import { supabase } from '../config/supabase';
import {
    CourseModule,
    CourseModuleDbInput,
    CourseModuleDbUpdate,
    Lesson // Assuming Lesson type might be needed if we embed them directly
} from '../types/courseTypes';
import { CourseService } from './courseService';
import { LessonService } from './lessonService'; // Added for getFullModulesWithLessonsByCourseId
import { MemberWithPermissionAndSubscription } from '../types/memberTypes'; // Added
import { DatabaseError, NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import { generateSlug } from '../utils/slugUtils'; // Added for slug generation

const TABLE_COURSE_MODULES = 'course_modules';

export class CourseModuleService {
    private static readonly MODULE_FIELDS_SELECT = `
        id,
        course_id,
        title,
        slug, 
        description,
        "order",
        created_at,
        updated_at
    `;

    // Internal helper to get a module by slug for a specific course ID
    private static async _getModuleBySlugAndCourseId(courseId: string, moduleSlug: string): Promise<CourseModule | null> {
        const { data, error } = await supabase
            .from(TABLE_COURSE_MODULES)
            .select(this.MODULE_FIELDS_SELECT)
            .eq('course_id', courseId)
            .eq('slug', moduleSlug)
            .maybeSingle();
        if (error) {
            console.error(`Error fetching module by slug '${moduleSlug}' for course '${courseId}':`, error);
            return null; // Or throw new DatabaseError
        }
        return data;
    }

    static async getAllModulesForCourse(courseSlug: string, requestingMember?: MemberWithPermissionAndSubscription): Promise<CourseModule[]> {
        const courseMeta = await CourseService.getCourseBySlug(courseSlug, requestingMember);
        if (!courseMeta) {
            throw new NotFoundError('Course not found or not accessible, so cannot fetch modules.');
        }
        
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

    /**
     * @description Get a specific module by its slug, within a specific course slug.
     * Respects course accessibility based on requestingMember.
     */
    static async getModuleBySlugs(courseSlug: string, moduleSlug: string, requestingMember?: MemberWithPermissionAndSubscription): Promise<CourseModule | null> {
        const course = await CourseService.getCourseBySlug(courseSlug, requestingMember);
        if (!course) {
            // CourseService.getCourseBySlug already determined inaccessibility or non-existence.
            // It might have returned a preview for a paid course if user is not subscriber/owner.
            // If course is just a preview, it might not contain module details needed, or user shouldn't access them directly.
            throw new NotFoundError(`Course with slug '${courseSlug}' not found or not accessible.`);
        }

        // If the course returned is a preview (because it's paid and user isn't owner/subscriber),
        // then the user shouldn't be able to fetch full module details via this route.
        // The `checkPaidCourseAccess` middleware on the route should ideally prevent this call for paid courses if access isn't granted.
        // However, an additional check here can be a safeguard.
        if (course.is_paid && requestingMember && course.member_id !== requestingMember.id && !requestingMember.is_subscriber) {
             // This case implies courseService.getCourseBySlug returned a preview because user doesn't have full access.
             // Thus, they shouldn't fetch a full module either.
             throw new ForbiddenError('Full access to this course\'s modules requires subscription or ownership.');
        }

        const module = await this._getModuleBySlugAndCourseId(course.id, moduleSlug);
        if (!module) {
            throw new NotFoundError(`Module with slug '${moduleSlug}' not found in course '${courseSlug}'.`);
        }
        return module;
    }

    /**
     * @description Get a preview list of modules for a course (id, title, slug, order).
     * Used by CourseService to populate previews for paid courses.
     */
    static async getModulesPreviewByCourseId(courseId: string): Promise<Pick<CourseModule, 'id' | 'title' | 'slug' | 'order'>[]> {
        const { data, error } = await supabase
            .from(TABLE_COURSE_MODULES)
            .select('id, title, slug, order')
            .eq('course_id', courseId)
            .order('order', { ascending: true });

        if (error) {
            console.error(`Error fetching module previews for course ${courseId}:`, error);
            // Consider throwing DatabaseError here instead of returning empty, to be consistent
            return []; 
        }
        return data || [];
    }

    /**
     * @description Get all modules for a course, with their lessons fully populated.
     * Assumes prior checks have granted full access to the course content.
     */
    static async getFullModulesWithLessonsByCourseId(
        courseId: string, 
        courseSlug: string, 
        // requestingMember?: MemberWithPermissionAndSubscription // Not directly used here, but could be for future lesson-level permissions
    ): Promise<Array<CourseModule & { lessons: Lesson[] }>> {
        const { data: modulesData, error: modulesError } = await supabase
            .from(TABLE_COURSE_MODULES)
            .select(this.MODULE_FIELDS_SELECT) // Ensures slug is selected
            .eq('course_id', courseId)
            .order('order', { ascending: true });

        if (modulesError) {
            throw new DatabaseError(`Failed to fetch modules for course ID ${courseId}: ${modulesError.message}`);
        }
        if (!modulesData || modulesData.length === 0) return [];

        const modulesWithLessons = await Promise.all(
            modulesData.map(async (module) => {
                // LessonService.getAllLessonsForModule requires moduleId and courseSlug.
                // It internally checks if the module belongs to the course implicitly via courseSlug check.
                const lessons = await LessonService.getAllLessonsForModule(module.id, courseSlug);
                return { ...module, lessons: lessons || [] };
            })
        );
        return modulesWithLessons;
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
        if (!title) {
            throw new ValidationError("Module 'title' is required.");
        }
        
        let slug = generateSlug(title);
        let existingModuleWithSlug = await this._getModuleBySlugAndCourseId(courseMeta.courseId, slug);
        let suffix = 1;
        while (existingModuleWithSlug) {
            slug = `${generateSlug(title)}-${suffix}`;
            existingModuleWithSlug = await this._getModuleBySlugAndCourseId(courseMeta.courseId, slug);
            suffix++;
        }
        
        const moduleToInsert = {
            course_id: courseMeta.courseId,
            title,
            slug, // Added slug
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

        const moduleUpdates: Partial<CourseModuleDbUpdate & { updated_at: string; slug?: string }> = {};
        if (input.title !== undefined) moduleUpdates.title = input.title;
        if (input.description !== undefined) moduleUpdates.description = input.description;
        if (input.order !== undefined) moduleUpdates.order = input.order;
        
        // Regenerate slug if title is present in input and different from existing title
        if (title && title !== existingModule.title) {
            let newSlug = generateSlug(title);
            let Suffix = 1;
            let conflictingModule = await this._getModuleBySlugAndCourseId(courseMeta.courseId, newSlug);
            while (conflictingModule && conflictingModule.id !== moduleId) {
                newSlug = `${generateSlug(title)}-${Suffix}`;
                conflictingModule = await this._getModuleBySlugAndCourseId(courseMeta.courseId, newSlug);
                Suffix++;
            }
            moduleUpdates.slug = newSlug;
        }
        
        // Check if there are any actual updates to perform besides potentially slug
        const hasMeaningfulUpdates = Object.keys(moduleUpdates).some(key => {
            if (key === 'slug') return moduleUpdates.slug !== existingModule.slug; // only count if slug actually changed
            return (moduleUpdates as any)[key] !== undefined; 
        });

        if (!hasMeaningfulUpdates) {
            return existingModule; 
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