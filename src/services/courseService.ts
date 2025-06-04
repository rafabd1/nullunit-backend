import { supabase } from '../config/supabase';
import {
    Course,
    CourseDbInput,
    CourseDbUpdate
} from '../types/courseTypes';
import { Tag } from '../types/tagTypes';
import { TagService } from './tagService';
import { generateSlug } from '../utils/slugUtils';
import { DatabaseError, NotFoundError, ForbiddenError } from '../utils/errors';

const TABLE_COURSES = 'courses';
const TABLE_COURSE_TAGS = 'course_tags';

export class CourseService {
    private static readonly COURSE_FIELDS_SELECT = `
        id,
        member_id,
        slug,
        title,
        description,
        is_paid,
        published,
        verified,
        created_at,
        updated_at
    `;

    private static async _getCourseTags(courseId: string): Promise<Tag[]> {
        try {
            const { data: tagRelations, error: relationError } = await supabase
                .from(TABLE_COURSE_TAGS)
                .select('tag_id')
                .eq('course_id', courseId);

            if (relationError) {
                console.error(`Error fetching tag relations for course ${courseId}:`, relationError);
                return [];
            }
            if (!tagRelations || tagRelations.length === 0) return [];

            const tagIds = tagRelations.map(r => r.tag_id);
            return await TagService.getTagsByIds(tagIds);

        } catch (error) {
            console.error(`Error fetching tags for course ${courseId}:`, error);
            return [];
        }
    }

    private static async _manageTags(tagNames: string[] | undefined | null, courseId: string): Promise<string[]> {
        const idFieldName = 'course_id';

        const { error: deleteError } = await supabase
            .from(TABLE_COURSE_TAGS)
            .delete()
            .eq(idFieldName, courseId);

        if (deleteError) {
            console.error(`Error clearing old tags for ${idFieldName} ${courseId} in ${TABLE_COURSE_TAGS}:`, deleteError);
            throw new DatabaseError(`Failed to clear old tags for course: ${deleteError.message}`);
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
            [idFieldName]: courseId,
            tag_id: tagId
        }));

        const { error: insertError } = await supabase
            .from(TABLE_COURSE_TAGS)
            .insert(associations);

        if (insertError) {
            console.error(`Error inserting new tags for ${idFieldName} ${courseId} in ${TABLE_COURSE_TAGS}:`, insertError);
            throw new DatabaseError(`Failed to insert new tags for course: ${insertError.message}`);
        }
        return tagIds;
    }
    
    private static async getCourseBySlugInternal(slug: string): Promise<Pick<Course, 'id' | 'slug' | 'member_id' | 'published'> | null> {
        const { data, error } = await supabase
            .from(TABLE_COURSES)
            .select('id, slug, member_id, published')
            .eq('slug', slug)
            .maybeSingle();
        if (error) {
            console.error(`Internal error fetching course by slug ${slug}:`, error);
            return null;
        }
        return data;
    }

    /**
     * @description Utility to get course owner ID and course ID by slug. Useful for permission checks in related services.
     */
    static async getCourseOwnerAndIdBySlug(slug: string): Promise<{ ownerId: string, courseId: string } | null> {
        const { data, error } = await supabase
            .from(TABLE_COURSES)
            .select('id, member_id')
            .eq('slug', slug)
            .maybeSingle();
        
        if (error) {
            console.error(`Error fetching course owner/id by slug ${slug}:`, error);
            return null;
        }
        if (!data) return null;
        return { ownerId: data.member_id, courseId: data.id };
    }

    static async getAllCourses(requestingMemberId?: string): Promise<Course[]> {
        const query = supabase
            .from(TABLE_COURSES)
            .select(this.COURSE_FIELDS_SELECT)
            .order('created_at', { ascending: false });

        // If no specific member is requesting, or if they are not an admin/owner (future check),
        // only show published courses.
        // For now, simple published check. This logic will be expanded by middleware for subscribers.
        if (!requestingMemberId) { // Simplified: only show published if no user context
            query.eq('published', true);
        } else {
            // If a user is requesting, allow them to see their own unpublished courses
            // query.or(`published.eq.true,and(published.eq.false,member_id.eq.${requestingMemberId})`);
            // This logic is complex for a simple service call and will be handled by route-level logic or middleware
            // For now, to allow owners to see their drafts via direct API calls if needed for an admin panel for example:
            query.or(`published.eq.true,member_id.eq.${requestingMemberId}`);
        }

        const { data, error } = await query;

        if (error) throw new DatabaseError(`Failed to fetch courses: ${error.message}`);
        if (!data) return [];

        const coursesWithTags = await Promise.all(data.map(async (course) => ({
            ...course,
            tags: await this._getCourseTags(course.id)
        })));
        
        // Further filter for non-owners if they somehow got unpublished courses
        // This is a safeguard, primary filtering should be in the query or middleware
        return coursesWithTags.filter(course => course.published || course.member_id === requestingMemberId);
    }
    
    static async getCourseBySlug(slug: string, requestingMemberId?: string): Promise<Course | null> {
        const { data, error } = await supabase
            .from(TABLE_COURSES)
            .select(this.COURSE_FIELDS_SELECT)
            .eq('slug', slug)
            .maybeSingle();

        if (error) throw new DatabaseError(`Failed to fetch course by slug: ${error.message}`);
        if (!data) return null;

        // Check if the course is published or if the requester is the owner
        if (!data.published && data.member_id !== requestingMemberId) {
            return null; // Not published and not the owner, so treat as not found/accessible
        }

        return {
            ...data,
            tags: await this._getCourseTags(data.id)
        };
    }

    static async createCourse(input: CourseDbInput): Promise<Course> {
        const { title, description, is_paid = false, tagNames, member_id } = input;
        
        if (!member_id) {
            throw new Error('member_id is required to create a course.');
        }

        let slug = generateSlug(title);
        let existingCourse = await this.getCourseBySlugInternal(slug);
        let suffix = 1;
        while (existingCourse) {
            slug = `${generateSlug(title)}-${suffix}`;
            existingCourse = await this.getCourseBySlugInternal(slug);
            suffix++;
        }

        const courseToInsert = {
            member_id,
            title,
            description,
            slug,
            is_paid,
            published: false,
            verified: false,
        };

        const { data: newCourse, error } = await supabase
            .from(TABLE_COURSES)
            .insert(courseToInsert)
            .select(this.COURSE_FIELDS_SELECT)
            .single();

        if (error || !newCourse) {
            console.error('Error creating course:', error);
            if (error?.code === '23505') {
                throw new DatabaseError('A course with a similar title (resulting in a duplicate slug) already exists.');
            }
            throw new DatabaseError('Failed to create course.');
        }

        const newTagIds = await this._manageTags(tagNames, newCourse.id);
        const tags = newTagIds.length > 0 ? await TagService.getTagsByIds(newTagIds) : [];

        return { ...newCourse, tags } as Course;
    }

    static async updateCourse(courseSlug: string, input: CourseDbUpdate, requestingMemberId: string): Promise<Course> {
        const { tagNames, ...courseUpdates } = input;

        const existingCourse = await this.getCourseBySlugInternal(courseSlug);
        if (!existingCourse) {
            throw new NotFoundError('Course not found.');
        }
        if (existingCourse.member_id !== requestingMemberId) {
            throw new ForbiddenError('You do not have permission to update this course.');
        }
        
        // Campos como published, verified, slug não são atualizáveis por esta rota.
        // member_id também não deve ser alterado.
        delete (courseUpdates as any).published;
        delete (courseUpdates as any).verified;

        const hasMeaningfulUpdate = Object.keys(courseUpdates).length > 0;

        if (!hasMeaningfulUpdate && (tagNames === undefined || tagNames === null)) {
             // Pass requestingMemberId to ensure we can fetch the course even if it's a draft
             const currentCourseData = await this.getCourseBySlug(courseSlug, requestingMemberId);
             if (!currentCourseData) throw new NotFoundError('Course not found after no-op update check.');
             return currentCourseData;
        }
        
        let updatedCourseData: Omit<Course, 'tags'> | null = null;

        if (hasMeaningfulUpdate) {
            const { data, error } = await supabase
                .from(TABLE_COURSES)
                .update({ ...courseUpdates, updated_at: new Date().toISOString() })
                .eq('id', existingCourse.id)
                .select(this.COURSE_FIELDS_SELECT)
                .single();

            if (error) {
                 if (error.code === 'PGRST116') throw new NotFoundError('Course not found for update.'); // No rows returned
                 throw new DatabaseError(`Failed to update course data: ${error.message}`);
            }
            updatedCourseData = data;
        } else {
            // Se apenas tags foram alteradas, busca os dados atuais do curso
            const currentData = await supabase
                .from(TABLE_COURSES)
                .select(this.COURSE_FIELDS_SELECT)
                .eq('id', existingCourse.id)
                .single();
            if (currentData.error || !currentData.data) {
                throw new DatabaseError('Failed to fetch course data for tag-only update.');
            }
            updatedCourseData = currentData.data;
        }

        const updatedTagIds = await this._manageTags(tagNames, existingCourse.id);
        const tags = updatedTagIds.length > 0 ? await TagService.getTagsByIds(updatedTagIds) : [];
        
        return { ...updatedCourseData!, tags } as Course;
    }

    static async deleteCourse(courseSlug: string, requestingMemberId: string): Promise<void> {
        const course = await this.getCourseBySlugInternal(courseSlug);
        if (!course) {
            throw new NotFoundError('Course not found.');
        }
        if (course.member_id !== requestingMemberId) {
            throw new ForbiddenError('You do not have permission to delete this course.');
        }

        // As tabelas course_modules e lessons devem ter ON DELETE CASCADE
        // configurado para que ao deletar um curso, seus módulos e lições associados
        // sejam automaticamente removidos. A tabela course_tags também precisa ser limpa,
        // o que _manageTags faria se chamado com null/[], mas a deleção direta é mais limpa aqui.

        // 1. Remover associações de tags
        const { error: tagsError } = await supabase
            .from(TABLE_COURSE_TAGS)
            .delete()
            .eq('course_id', course.id);
        
        if (tagsError) {
            console.error(`Failed to delete tags for course ${course.id}:`, tagsError);
            throw new DatabaseError(`Failed to delete course tags: ${tagsError.message}`);
        }

        // 2. Deletar o curso
        const { error: courseError } = await supabase
            .from(TABLE_COURSES)
            .delete()
            .eq('id', course.id);

        if (courseError) {
            console.error(`Failed to delete course ${course.id}:`, courseError);
            throw new DatabaseError(`Failed to delete course: ${courseError.message}`);
        }
    }
} 