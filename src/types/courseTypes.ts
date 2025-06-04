import { Tag } from './tagTypes';

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
}

export interface CourseModule {
    id: string;
    course_id: string;
    created_at: string;
    updated_at: string | null;
    title: string;
    description: string | null;
    order: number;
}

export interface Lesson {
    id: string;
    course_module_id: string;
    created_at: string;
    updated_at: string | null;
    title: string;
    content: string; // e.g., Markdown, video embed
    order: number;
}

// Tipos para entrada de dados no banco (sem campos gerados automaticamente como id, created_at, updated_at)
// Mas INCLUINDO IDs de relacionamento que serão adicionados pela lógica da rota antes de chamar o serviço.
export interface CourseDbInput {
    title: string;
    description?: string | null;
    member_id: string; // Adicionado de volta, obrigatório
    is_paid?: boolean;
    tagNames?: string[] | null;
}

export interface CourseModuleDbInput {
    title: string;
    description?: string | null;
    course_id: string; // Adicionado de volta, obrigatório
    order: number;
}

export interface LessonDbInput {
    title: string;
    content: string;
    course_module_id: string; // Adicionado de volta, obrigatório
    order: number;
}

// Tipos para atualização de dados no banco (todos os campos de input são opcionais)
export interface CourseDbUpdate {
    title?: string;
    description?: string | null;
    is_paid?: boolean;
    // published e verified não serão atualizáveis diretamente por aqui
    tagNames?: string[] | null;
}

export interface CourseModuleDbUpdate {
    title?: string;
    description?: string | null;
    order?: number;
}

export interface LessonDbUpdate {
    title?: string;
    content?: string;
    order?: number;
} 