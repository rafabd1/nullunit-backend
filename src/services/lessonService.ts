import { supabase } from '../config/supabase';
import {
    Lesson,
    LessonDbInput,
    LessonDbUpdate
} from '../types/courseTypes';
import { CourseService } from './courseService';
import { CourseModuleService } from './courseModuleService';
import { DatabaseError, NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';

const TABLE_LESSONS = 'lessons';

export class LessonService {
    private static readonly LESSON_FIELDS_SELECT = `
        id,
        course_module_id,
        "order",
        question_prompt,
        exercise_type,
        expected_answer,
        options_data,
        answer_placeholder,
        answer_format_hint,
        created_at,
        updated_at
    `;

    /**
     * @description Get all lessons for a specific module, ordered by 'order'.
     * Needs courseSlug to verify module context.
     */
    static async getAllLessonsForModule(moduleId: string, courseSlug: string): Promise<Lesson[]> {
        const courseMeta = await CourseService.getCourseBySlug(courseSlug);
        if (!courseMeta) {
            throw new NotFoundError(`Course with slug "${courseSlug}" not found.`);
        }

        const module = await CourseModuleService.getModuleById(moduleId);
        if (!module || module.course_id !== courseMeta.id) {
            throw new NotFoundError(`Module with ID "${moduleId}" not found in course "${courseSlug}".`);
        }
        // Add future check: if course is not published and user is not admin/owner

        const { data, error } = await supabase
            .from(TABLE_LESSONS)
            .select(this.LESSON_FIELDS_SELECT)
            .eq('course_module_id', moduleId)
            .order('order', { ascending: true });

        if (error) {
            throw new DatabaseError(`Failed to fetch lessons for module ${moduleId}: ${error.message}`);
        }
        return data || [];
    }

    /**
     * @description Get a specific lesson by its ID.
     */
    static async getLessonById(lessonId: string): Promise<Lesson | null> {
        const { data, error } = await supabase
            .from(TABLE_LESSONS)
            .select(this.LESSON_FIELDS_SELECT)
            .eq('id', lessonId)
            .maybeSingle();

        if (error) {
            throw new DatabaseError(`Failed to fetch lesson by ID ${lessonId}: ${error.message}`);
        }
        return data;
    }

    static async createLesson(input: LessonDbInput, moduleId: string, courseSlug: string, requestingMemberId: string): Promise<Lesson> {
        const courseMeta = await CourseService.getCourseOwnerAndIdBySlug(courseSlug);
        if (!courseMeta) {
            throw new NotFoundError(`Course with slug "${courseSlug}" not found.`);
        }
        if (courseMeta.ownerId !== requestingMemberId) {
            throw new ForbiddenError('You do not have permission to add lessons to this course.');
        }

        const module = await CourseModuleService.getModuleById(moduleId);
        if (!module || module.course_id !== courseMeta.courseId) {
            throw new NotFoundError(`Module with ID "${moduleId}" not found or does not belong to course "${courseSlug}".`);
        }

        const { 
            order, 
            question_prompt, 
            exercise_type, 
            expected_answer, 
            options_data, 
            answer_placeholder,
            answer_format_hint 
        } = input;

        if (order === undefined || order < 0) {
            throw new ValidationError("Lesson 'order' must be a non-negative integer.");
        }
        if (!question_prompt || !exercise_type || !expected_answer) {
            throw new ValidationError('question_prompt, exercise_type, and expected_answer are required for a lesson.');
        }

        let finalAnswerPlaceholder = answer_placeholder;
        if (!finalAnswerPlaceholder && (exercise_type === 'flag' || exercise_type === 'text_input')) {
            finalAnswerPlaceholder = expected_answer.replace(/[a-zA-Z0-9]/g, '.');
        }

        const lessonToInsert = {
            course_module_id: moduleId,
            order,
            question_prompt,
            exercise_type,
            expected_answer,
            options_data: options_data === undefined ? null : options_data,
            answer_placeholder: finalAnswerPlaceholder,
            answer_format_hint
        };

        const { data: newLesson, error } = await supabase
            .from(TABLE_LESSONS)
            .insert(lessonToInsert)
            .select(this.LESSON_FIELDS_SELECT)
            .single();

        if (error || !newLesson) {
            console.error('Error creating lesson:', error);
            throw new DatabaseError('Failed to create lesson.');
        }
        return newLesson;
    }

    static async updateLesson(lessonId: string, input: LessonDbUpdate, moduleId: string, courseSlug: string, requestingMemberId: string): Promise<Lesson> {
        const courseMeta = await CourseService.getCourseOwnerAndIdBySlug(courseSlug);
        if (!courseMeta) {
            throw new NotFoundError(`Course with slug "${courseSlug}" not found.`);
        }
        if (courseMeta.ownerId !== requestingMemberId) {
            throw new ForbiddenError('You do not have permission to update lessons in this course.');
        }

        const module = await CourseModuleService.getModuleById(moduleId);
        if (!module || module.course_id !== courseMeta.courseId) {
            throw new NotFoundError(`Module with ID "${moduleId}" not found or does not belong to course "${courseSlug}".`);
        }

        const existingLesson = await this.getLessonById(lessonId);
        if (!existingLesson) {
            throw new NotFoundError('Lesson not found.');
        }
        if (existingLesson.course_module_id !== moduleId) {
            throw new ForbiddenError('Lesson does not belong to the specified module.');
        }

        const { 
            order, 
            question_prompt, 
            exercise_type, 
            expected_answer, 
            options_data, 
            answer_placeholder, 
            answer_format_hint 
        } = input;

        if (order !== undefined && order < 0) {
            throw new ValidationError("Lesson 'order' must be a non-negative integer.");
        }
        
        const lessonUpdates: Partial<LessonDbInput & { updated_at: string }> = {};
        if (input.order !== undefined) lessonUpdates.order = input.order;
        if (input.question_prompt !== undefined) lessonUpdates.question_prompt = input.question_prompt;
        if (input.exercise_type !== undefined) lessonUpdates.exercise_type = input.exercise_type;
        if (input.expected_answer !== undefined) lessonUpdates.expected_answer = input.expected_answer;
        if (input.options_data !== undefined) lessonUpdates.options_data = input.options_data;
        if (input.answer_format_hint !== undefined) lessonUpdates.answer_format_hint = input.answer_format_hint;

        let finalAnswerPlaceholder = input.answer_placeholder;
        const currentExpectedAnswer = input.expected_answer || existingLesson.expected_answer;
        const currentExerciseType = input.exercise_type || existingLesson.exercise_type;

        if (input.answer_placeholder === undefined && input.expected_answer !== undefined && (currentExerciseType === 'flag' || currentExerciseType === 'text_input')) {
            finalAnswerPlaceholder = currentExpectedAnswer.replace(/[a-zA-Z0-9]/g, '.');
        } else if (input.answer_placeholder !== undefined) {
            finalAnswerPlaceholder = input.answer_placeholder;
        }
        if (finalAnswerPlaceholder !== undefined || input.answer_placeholder !== undefined) { 
            lessonUpdates.answer_placeholder = finalAnswerPlaceholder;
        }

        if (Object.keys(lessonUpdates).length === 0) {
            return existingLesson; 
        }
        lessonUpdates.updated_at = new Date().toISOString();

        const { data: updatedLesson, error } = await supabase
            .from(TABLE_LESSONS)
            .update(lessonUpdates)
            .eq('id', lessonId)
            .select(this.LESSON_FIELDS_SELECT)
            .single();

        if (error || !updatedLesson) {
            if (error?.code === 'PGRST116') throw new NotFoundError('Lesson not found for update.');
            console.error(`Error updating lesson ${lessonId}:`, error);
            throw new DatabaseError('Failed to update lesson.');
        }
        return updatedLesson;
    }

    static async deleteLesson(lessonId: string, moduleId: string, courseSlug: string, requestingMemberId: string): Promise<void> {
        const courseMeta = await CourseService.getCourseOwnerAndIdBySlug(courseSlug);
        if (!courseMeta) {
            throw new NotFoundError(`Course with slug "${courseSlug}" not found.`);
        }
        if (courseMeta.ownerId !== requestingMemberId) {
            throw new ForbiddenError('You do not have permission to delete lessons from this course.');
        }

        const module = await CourseModuleService.getModuleById(moduleId);
        if (!module || module.course_id !== courseMeta.courseId) {
            throw new NotFoundError(`Module with ID "${moduleId}" not found or does not belong to course "${courseSlug}".`);
        }

        const existingLesson = await this.getLessonById(lessonId);
        if (!existingLesson) {
            throw new NotFoundError('Lesson not found.');
        }
        if (existingLesson.course_module_id !== moduleId) {
            throw new ForbiddenError('Lesson does not belong to the specified module.');
        }

        const { error } = await supabase
            .from(TABLE_LESSONS)
            .delete()
            .eq('id', lessonId);

        if (error) {
            console.error(`Failed to delete lesson ${lessonId}:`, error);
            throw new DatabaseError(`Failed to delete lesson: ${error.message}`);
        }
    }
} 