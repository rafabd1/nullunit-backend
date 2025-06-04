import { Tag } from './tagTypes';
import { MemberWithPermissionAndSubscription } from './memberTypes';

export interface Course {
    id: string;
    created_at: string;
    updated_at: string | null;
    slug: string;
    title: string;
    description: string | null;
    member_id: string; // Instructor
    is_paid: boolean; // For feature access, not direct sale
    published: boolean;
    verified: boolean;
    tags?: Tag[];
    member?: Partial<MemberWithPermissionAndSubscription>;
    modules?: CourseModulePreview[] | CourseModuleWithLessons[];
}

export interface CourseModule {
    id: string;
    course_id: string;
    created_at: string;
    updated_at: string | null;
    title: string;
    slug: string;
    description: string | null;
    order: number;
}

export interface Lesson {
    id: string;
    course_module_id: string;
    created_at: string;
    updated_at: string | null;
    order: number;
    question_prompt: string;
    exercise_type: string;
    expected_answer: string;
    options_data?: any | null;
    answer_placeholder?: string | null;
    answer_format_hint?: string | null;
}

export interface CourseModulePreview extends Pick<CourseModule, 'id' | 'title' | 'slug' | 'order'> {}

export interface CourseModuleWithLessons extends CourseModule {
    lessons: Lesson[];
}

export interface CourseDbInput {
    title: string;
    description?: string | null;
    member_id: string;
    is_paid?: boolean;
    tagNames?: string[] | null;
}

export interface CourseModuleDbInput {
    title: string;
    description?: string | null;
    course_id: string;
    order: number;
}

export interface LessonDbInput {
    course_module_id: string;
    order: number;
    question_prompt: string;
    exercise_type: string;
    expected_answer: string;
    options_data?: any | null;
    answer_placeholder?: string | null;
    answer_format_hint?: string | null;
}

export interface CourseDbUpdate {
    title?: string;
    description?: string | null;
    is_paid?: boolean;
    tagNames?: string[] | null;
}

export interface CourseModuleDbUpdate {
    title?: string;
    description?: string | null;
    order?: number;
}

export interface LessonDbUpdate {
    order?: number;
    question_prompt?: string;
    exercise_type?: string;
    expected_answer?: string;
    options_data?: any | null;
    answer_placeholder?: string | null;
    answer_format_hint?: string | null;
} 