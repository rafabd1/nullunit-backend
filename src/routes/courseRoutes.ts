import { Elysia, t } from 'elysia';
import { CourseService } from '../services/courseService';
import { CourseModuleService } from '../services/courseModuleService';
import { LessonService } from '../services/lessonService';
import {
    courseSchema, courseInputSchema, courseUpdateSchema,
    courseModuleSchema, courseModuleInputSchema, courseModuleUpdateSchema,
    lessonSchema, lessonInputSchema, lessonUpdateSchema,
    errorSchema
} from '../schemas/courseSchemas';
import { 
    requireAuthor, 
    optionalAuth, 
    checkPaidCourseAccess 
} from '../middlewares/auth';
import { 
    ElysiaBaseContext, 
    AuthenticatedContext, 
    OptionallyAuthenticatedContext 
} from '../types/routes';
import {
    NotFoundError, ForbiddenError, ValidationError, DatabaseError
} from '../utils/errors';

const commonErrorResponses = {
    '400': {
        description: 'Invalid input data',
        content: { 'application/json': { schema: errorSchema } }
    },
    '401': {
        description: 'Unauthorized',
        content: { 'application/json': { schema: errorSchema } }
    },
    '403': {
        description: 'Forbidden',
        content: { 'application/json': { schema: errorSchema } }
    },
    '404': {
        description: 'Not found',
        content: { 'application/json': { schema: errorSchema } }
    },
    '500': {
        description: 'Internal server error',
        content: { 'application/json': { schema: errorSchema } }
    }
};

export const courseRoutes = new Elysia({ prefix: '/courses' })
    // --- Course Routes (Protegidas por requireAuthor) ---
    .post('/', 
        async (context: ElysiaBaseContext & { body: typeof courseInputSchema.static }) => {
            const { body, request, set } = context;
            return requireAuthor(async ({ user, set: authSet, member }: AuthenticatedContext) => {
                try {
                    const courseDataForService = { ...body, member_id: user.id };
                    const course = await CourseService.createCourse(courseDataForService);
                    authSet.status = 201;
                    return course;
                } catch (error: any) {
                    console.error("Error creating course:", error);
                    if (error instanceof ValidationError) {
                        authSet.status = 400;
                        return { error: 'Validation Error', message: error.message };
                    } else if (error instanceof ForbiddenError) {
                        authSet.status = 403;
                        return { error: 'Forbidden', message: error.message };
                    } else if (error instanceof DatabaseError && error.message.includes('slug')) { 
                        authSet.status = 409;
                        return { error: 'Conflict', message: 'Course slug already exists.' };
                    } else {
                        authSet.status = 500;
                        return { error: 'Internal Server Error', message: error.message || 'Failed to create course.' };
                    }
                }
            })(context as any);
        },
        {
            body: courseInputSchema,
            detail: {
                tags: ['Courses'],
                description: 'Create a new course', 
                security: [{ bearerAuth: [] }],
                responses: {
                    '201': {
                        description: 'Course created',
                        content: { 'application/json': { schema: courseSchema } }
                    },
                    ...commonErrorResponses
                }
            }
        }
    )
    .put('/:courseSlug', 
        async (context: ElysiaBaseContext & { params: { courseSlug: string }, body: typeof courseUpdateSchema.static }) => {
            const { params, body, request, set } = context;
            return requireAuthor(async ({ user, set: authSet, member }: AuthenticatedContext) => {
                try {
                    const updatedCourse = await CourseService.updateCourse(params.courseSlug, body, user.id);
                    return updatedCourse;
                } catch (error: any) {
                    console.error(`Error updating course ${params.courseSlug}:`, error);
                    if (error instanceof ValidationError) {
                        authSet.status = 400;
                        return { error: 'Validation Error', message: error.message };
                    } else if (error instanceof NotFoundError) {
                        authSet.status = 404;
                        return { error: 'Not Found', message: error.message };
                    } else if (error instanceof ForbiddenError) {
                        authSet.status = 403;
                        return { error: 'Forbidden', message: error.message };
                    } else {
                        authSet.status = 500;
                        return { error: 'Internal Server Error', message: error.message || 'Failed to update course.' };
                    }
                }
            })(context as any);
        }, 
        {
            params: t.Object({ courseSlug: t.String() }),
            body: courseUpdateSchema,
            detail: {
                tags: ['Courses'],
                description: 'Update an existing course', 
                security: [{ bearerAuth: [] }],
                responses: {
                    '200': {
                        description: 'Course updated',
                        content: { 'application/json': { schema: courseSchema } }
                    },
                    ...commonErrorResponses
                }
            }
        }
    )
    .delete('/:courseSlug', 
        async (context: ElysiaBaseContext & { params: { courseSlug: string } }) => {
            const { params, request, set } = context;
            return requireAuthor(async ({ user, set: authSet, member }: AuthenticatedContext) => {
                try {
                    await CourseService.deleteCourse(params.courseSlug, user.id);
                    authSet.status = 204;
                    return null;
                } catch (error: any) {
                    console.error(`Error deleting course ${params.courseSlug}:`, error);
                    if (error instanceof NotFoundError) {
                        authSet.status = 404;
                        return { error: 'Not Found', message: error.message };
                    } else if (error instanceof ForbiddenError) {
                        authSet.status = 403;
                        return { error: 'Forbidden', message: error.message };
                    } else {
                        authSet.status = 500;
                        return { error: 'Internal Server Error', message: error.message || 'Failed to delete course.' };
                    }
                }
            })(context as any);
        },
        {
            params: t.Object({ courseSlug: t.String() }),
            detail: {
                tags: ['Courses'],
                description: 'Delete a course', 
                security: [{ bearerAuth: [] }],
                responses: {
                    '204': { description: 'Course deleted' },
                    ...commonErrorResponses
                }
            }
        }
    )

    // --- Course Module Routes (Protegidas por requireAuthor) ---
    .post('/:courseSlug/modules', 
        async (context: ElysiaBaseContext & { params: { courseSlug: string }, body: typeof courseModuleInputSchema.static }) => {
            const { params, body, request, set } = context;
            return requireAuthor(async ({ user, set: authSet, member }: AuthenticatedContext) => {
                try {
                    const courseInfo = await CourseService.getCourseOwnerAndIdBySlug(params.courseSlug);
                    if (!courseInfo) throw new NotFoundError(`Course with slug '${params.courseSlug}' not found.`);
                    if (courseInfo.ownerId !== user.id) throw new ForbiddenError('You do not have permission to add modules to this course.');
                    
                    const moduleDataForService = { ...body, course_id: courseInfo.courseId };
                    const courseModule = await CourseModuleService.createModule(params.courseSlug, moduleDataForService, user.id);
                    authSet.status = 201;
                    return courseModule;
                } catch (error: any) {
                    console.error(`Error creating module for course ${params.courseSlug}:`, error);
                    if (error instanceof ValidationError) { authSet.status = 400; return { error: 'Validation Error', message: error.message }; }
                    if (error instanceof NotFoundError) { authSet.status = 404; return { error: 'Not Found', message: error.message }; }
                    if (error instanceof ForbiddenError) { authSet.status = 403; return { error: 'Forbidden', message: error.message }; }
                    authSet.status = 500; return { error: 'Internal Server Error', message: error.message || 'Failed to create module.' };
                }
            })(context as any);
        },
        {
            params: t.Object({ courseSlug: t.String() }),
            body: courseModuleInputSchema,
            detail: {
                tags: ['Course Modules'],
                description: 'Create a new module for a course', 
                security: [{ bearerAuth: [] }],
                responses: {
                    '201': {
                        description: 'Module created',
                        content: { 'application/json': { schema: courseModuleSchema } }
                    },
                    ...commonErrorResponses
                }
            }
        }
    )
    .put('/:courseSlug/modules/:moduleId', 
        async (context: ElysiaBaseContext & { params: { courseSlug: string, moduleId: string }, body: typeof courseModuleUpdateSchema.static }) => {
            const { params, body, request, set } = context;
            return requireAuthor(async ({ user, set: authSet, member }: AuthenticatedContext) => {
                try {
                    const updatedModule = await CourseModuleService.updateModule(params.moduleId, params.courseSlug, body, user.id);
                    return updatedModule;
                } catch (error: any) {
                    console.error(`Error updating module ${params.moduleId} in course ${params.courseSlug}:`, error);
                    if (error instanceof ValidationError) { authSet.status = 400; return { error: 'Validation Error', message: error.message }; }
                    if (error instanceof NotFoundError) { authSet.status = 404; return { error: 'Not Found', message: error.message }; }
                    if (error instanceof ForbiddenError) { authSet.status = 403; return { error: 'Forbidden', message: error.message }; }
                    authSet.status = 500; return { error: 'Internal Server Error', message: error.message || 'Failed to update module.' };
                }
            })(context as any);
        },
        {
            params: t.Object({ courseSlug: t.String(), moduleId: t.String({ format: 'uuid' }) }),
            body: courseModuleUpdateSchema,
            detail: {
                tags: ['Course Modules'],
                description: 'Update a course module', 
                security: [{ bearerAuth: [] }],
                responses: {
                    '200': {
                        description: 'Module updated',
                        content: { 'application/json': { schema: courseModuleSchema } }
                    },
                    ...commonErrorResponses
                }
            }
        }
    )
    .delete('/:courseSlug/modules/:moduleId', 
        async (context: ElysiaBaseContext & { params: { courseSlug: string, moduleId: string } }) => {
            const { params, request, set } = context;
            return requireAuthor(async ({ user, set: authSet, member }: AuthenticatedContext) => {
                try {
                    await CourseModuleService.deleteModule(params.moduleId, params.courseSlug, user.id);
                    authSet.status = 204;
                    return null;
                } catch (error: any) {
                    console.error(`Error deleting module ${params.moduleId} in course ${params.courseSlug}:`, error);
                    if (error instanceof NotFoundError) { authSet.status = 404; return { error: 'Not Found', message: error.message }; }
                    if (error instanceof ForbiddenError) { authSet.status = 403; return { error: 'Forbidden', message: error.message }; }
                    authSet.status = 500; return { error: 'Internal Server Error', message: error.message || 'Failed to delete module.' };
                }
            })(context as any);
        },
        {
            params: t.Object({ courseSlug: t.String(), moduleId: t.String({ format: 'uuid' }) }),
            detail: {
                tags: ['Course Modules'],
                description: 'Delete a course module', 
                security: [{ bearerAuth: [] }],
                responses: {
                    '204': { description: 'Module deleted' },
                    ...commonErrorResponses
                }
            }
        }
    )

    // --- Lesson Routes (Protegidas por requireAuthor) ---
    .post('/:courseSlug/modules/:moduleId/lessons', 
        async (context: ElysiaBaseContext & { params: { courseSlug: string, moduleId: string }, body: typeof lessonInputSchema.static }) => {
            const { params, body, request, set } = context;
            return requireAuthor(async ({ user, set: authSet, member }: AuthenticatedContext) => {
                try {
                    const lessonDataForService = { ...body, course_module_id: params.moduleId };
                    const lesson = await LessonService.createLesson(lessonDataForService, params.moduleId, params.courseSlug, user.id);
                    authSet.status = 201;
                    return lesson;
                } catch (error: any) {
                    console.error(`Error creating lesson in module ${params.moduleId}:`, error);
                    if (error instanceof ValidationError) { authSet.status = 400; return { error: 'Validation Error', message: error.message }; }
                    if (error instanceof NotFoundError) { authSet.status = 404; return { error: 'Not Found', message: error.message }; }
                    if (error instanceof ForbiddenError) { authSet.status = 403; return { error: 'Forbidden', message: error.message }; }
                    authSet.status = 500; return { error: 'Internal Server Error', message: error.message || 'Failed to create lesson.' };
                }
            })(context as any);
        },
        {
            params: t.Object({ courseSlug: t.String(), moduleId: t.String({ format: 'uuid' }) }),
            body: lessonInputSchema,
            detail: {
                tags: ['Lessons'],
                description: 'Create a new lesson in a module', 
                security: [{ bearerAuth: [] }],
                responses: {
                    '201': {
                        description: 'Lesson created',
                        content: { 'application/json': { schema: lessonSchema } }
                    },
                    ...commonErrorResponses
                }
            }
        }
    )
    .put('/:courseSlug/modules/:moduleId/lessons/:lessonId', 
        async (context: ElysiaBaseContext & { params: { courseSlug: string, moduleId: string, lessonId: string }, body: typeof lessonUpdateSchema.static }) => {
            const { params, body, request, set } = context;
            return requireAuthor(async ({ user, set: authSet, member }: AuthenticatedContext) => {
                try {
                    const updatedLesson = await LessonService.updateLesson(params.lessonId, body, params.moduleId, params.courseSlug, user.id);
                    return updatedLesson;
                } catch (error: any) {
                    console.error(`Error updating lesson ${params.lessonId}:`, error);
                    if (error instanceof ValidationError) { authSet.status = 400; return { error: 'Validation Error', message: error.message }; }
                    if (error instanceof NotFoundError) { authSet.status = 404; return { error: 'Not Found', message: error.message }; }
                    if (error instanceof ForbiddenError) { authSet.status = 403; return { error: 'Forbidden', message: error.message }; }
                    authSet.status = 500; return { error: 'Internal Server Error', message: error.message || 'Failed to update lesson.' };
                }
            })(context as any);
        },
        {
            params: t.Object({ courseSlug: t.String(), moduleId: t.String({ format: 'uuid' }), lessonId: t.String({ format: 'uuid' }) }),
            body: lessonUpdateSchema,
            detail: {
                tags: ['Lessons'],
                description: 'Update a lesson', 
                security: [{ bearerAuth: [] }],
                responses: {
                    '200': {
                        description: 'Lesson updated',
                        content: { 'application/json': { schema: lessonSchema } }
                    },
                    ...commonErrorResponses
                }
            }
        }
    )
    .delete('/:courseSlug/modules/:moduleId/lessons/:lessonId', 
        async (context: ElysiaBaseContext & { params: { courseSlug: string, moduleId: string, lessonId: string } }) => {
            const { params, request, set } = context;
            return requireAuthor(async ({ user, set: authSet, member }: AuthenticatedContext) => {
                try {
                    await LessonService.deleteLesson(params.lessonId, params.moduleId, params.courseSlug, user.id);
                    authSet.status = 204;
                    return null;
                } catch (error: any) {
                    console.error(`Error deleting lesson ${params.lessonId}:`, error);
                    if (error instanceof NotFoundError) { authSet.status = 404; return { error: 'Not Found', message: error.message }; }
                    if (error instanceof ForbiddenError) { authSet.status = 403; return { error: 'Forbidden', message: error.message }; }
                    authSet.status = 500; return { error: 'Internal Server Error', message: error.message || 'Failed to delete lesson.' };
                }
            })(context as any);
        },
        {
            params: t.Object({ courseSlug: t.String(), moduleId: t.String({ format: 'uuid' }), lessonId: t.String({ format: 'uuid' }) }),
            detail: {
                tags: ['Lessons'],
                description: 'Delete a lesson', 
                security: [{ bearerAuth: [] }],
                responses: {
                    '204': { description: 'Lesson deleted' },
                    ...commonErrorResponses
                }
            }
        }
    )

    // --- Rotas GET Públicas / Opcionalmente Autenticadas ---
    .get('/', 
        async (context: OptionallyAuthenticatedContext) => {
            const { set, member } = context;
            try {
                const courses = await CourseService.getAllCourses(member);
                return courses;
            } catch (error: any) {
                console.error("Error fetching all courses:", error);
                set.status = 500;
                return { 
                    error: 'Internal Server Error', 
                    message: error.message || 'Failed to fetch courses.' 
                };
            }
        },
        {
            beforeHandle: [optionalAuth() as any], // Cast to any if type inference struggles with complex HOFs
            detail: {
                tags: ['Courses'],
                description: 'Get all published courses (and unpublished if owner)',
                responses: {
                    '200': {
                        description: 'List of courses',
                        content: { 'application/json': { schema: t.Array(courseSchema) } }
                    },
                    ...commonErrorResponses
                }
            }
        }
    )
    .get('/:courseSlug', 
        async (context: OptionallyAuthenticatedContext & { params: { courseSlug: string } }) => {
            const { params, set, member } = context;
            try {
                const course = await CourseService.getCourseBySlug(params.courseSlug, member);
                if (!course) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Course not found or not accessible.' };
                }
                return course;
            } catch (error: any) {
                console.error(`Error fetching course ${params.courseSlug}:`, error);
                set.status = 500;
                return { error: 'Internal Server Error', message: error.message || 'Failed to fetch course.' };
            }
        },
        {
            beforeHandle: [optionalAuth() as any],
            params: t.Object({ courseSlug: t.String() }),
            detail: {
                tags: ['Courses'],
                description: 'Get a specific course by slug (published, or unpublished if owner)',
                responses: {
                    '200': {
                        description: 'Course details',
                        content: { 'application/json': { schema: courseSchema } }
                    },
                    ...commonErrorResponses
                }
            }
        }
    )
    .get('/:courseSlug/modules',
        async (context: OptionallyAuthenticatedContext & { params: { courseSlug: string } }) => {
            const { params, set, member } = context;
            try {
                const modules = await CourseModuleService.getAllModulesForCourse(params.courseSlug);
                if (!modules) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Modules not found for this course or course does not exist.' };
                }
                return modules;
            } catch (error: any) {
                console.error(`Error fetching modules for course ${params.courseSlug}:`, error);
                if (error instanceof NotFoundError) {
                    set.status = 404; return { error: 'Not Found', message: error.message };
                }
                set.status = 500;
                return { error: 'Internal Server Error', message: error.message || 'Failed to fetch modules.' };
            }
        },
        {
            beforeHandle: [optionalAuth() as any, checkPaidCourseAccess() as any], 
            params: t.Object({ courseSlug: t.String() }),
            detail: {
                tags: ['Course Modules'],
                description: 'Get all modules for a specific course. Access controlled for paid courses.',
                responses: {
                    '200': {
                        description: 'List of course modules',
                        content: { 'application/json': { schema: t.Array(courseModuleSchema) } }
                    },
                    ...commonErrorResponses
                }
            }
        }
    )
    .get('/:courseSlug/modules/:moduleSlug',
        async (context: OptionallyAuthenticatedContext & { params: { courseSlug: string, moduleSlug: string } }) => {
            const { params, set, member } = context;
            try {
                const courseModule = await CourseModuleService.getModuleBySlugs(params.courseSlug, params.moduleSlug, member);
                if (!courseModule) {
                    set.status = 404;
                    return { error: 'Not Found', message: 'Course module not found or course does not exist.' };
                }
                return courseModule;
            } catch (error: any) {
                console.error(`Error fetching module ${params.moduleSlug} for course ${params.courseSlug}:`, error);
                 if (error instanceof NotFoundError) {
                    set.status = 404; return { error: 'Not Found', message: error.message };
                }
                set.status = 500;
                return { error: 'Internal Server Error', message: error.message || 'Failed to fetch course module.' };
            }
        },
        {
            beforeHandle: [optionalAuth() as any, checkPaidCourseAccess() as any], 
            params: t.Object({ courseSlug: t.String(), moduleSlug: t.String() }),
            detail: {
                tags: ['Course Modules'],
                description: 'Get a specific module by its slug and course slug. Access controlled for paid courses.',
                responses: {
                    '200': {
                        description: 'Course module details',
                        content: { 'application/json': { schema: courseModuleSchema } }
                    },
                    ...commonErrorResponses
                }
            }
        }
    )
    .get('/:courseSlug/modules/:moduleId/lessons', 
        async (context: OptionallyAuthenticatedContext & { params: { courseSlug: string, moduleId: string } }) => {
            const { params, set, member } = context;
            try {
                const course = await CourseService.getCourseBySlug(params.courseSlug, member);
                if (!course) { throw new NotFoundError(`Course with slug '${params.courseSlug}' not found or not accessible for lesson listing.`); } 
                
                const module = await CourseModuleService.getModuleById(params.moduleId);
                if (!module || module.course_id !== course.id) { 
                    throw new NotFoundError(`Module with ID '${params.moduleId}' not found in course '${params.courseSlug}'.`); 
                }
                
                const lessons = await LessonService.getAllLessonsForModule(params.moduleId, params.courseSlug);
                return lessons;
            } catch (error: any) {
                console.error(`Error fetching lessons for module ${params.moduleId}:`, error);
                if (error instanceof NotFoundError) { set.status = 404; return { error: 'Not Found', message: error.message }; }
                if (error instanceof ForbiddenError) { set.status = 403; return { error: 'Forbidden', message: error.message }; }
                set.status = 500; return { error: 'Internal Server Error', message: error.message || 'Failed to fetch lessons.' };
            }
        },
        {
            beforeHandle: [optionalAuth() as any, checkPaidCourseAccess() as any],
            params: t.Object({ courseSlug: t.String(), moduleId: t.String({ format: 'uuid' }) }),
            detail: {
                tags: ['Lessons'],
                description: 'Get all lessons for a module (access controlled for paid courses)',
                responses: {
                    '200': { description: 'List of lessons', content: { 'application/json': { schema: t.Array(lessonSchema) } } },
                    ...commonErrorResponses
                }
            }
        }
    )
    .get('/:courseSlug/modules/:moduleId/lessons/:lessonId', 
        async (context: OptionallyAuthenticatedContext & { params: { courseSlug: string, moduleId: string, lessonId: string } }) => {
            const { params, set, member } = context;
            try {
                const course = await CourseService.getCourseBySlug(params.courseSlug, member);
                if (!course) { 
                    throw new NotFoundError(`Course with slug '${params.courseSlug}' not found or not accessible for lesson view.`); 
                }
                const module = await CourseModuleService.getModuleById(params.moduleId);
                if (!module || module.course_id !== course.id) { 
                    throw new NotFoundError(`Module with ID '${params.moduleId}' not found in course '${params.courseSlug}'.`); 
                }
                const lesson = await LessonService.getLessonById(params.lessonId);
                if (!lesson || lesson.course_module_id !== module.id) { 
                    throw new NotFoundError(`Lesson with ID '${params.lessonId}' not found in module '${params.moduleId}'.`); 
                }
                return lesson;
            } catch (error: any) {
                console.error(`Error fetching lesson ${params.lessonId}:`, error);
                if (error instanceof NotFoundError) { set.status = 404; return { error: 'Not Found', message: error.message }; }
                if (error instanceof ForbiddenError) { set.status = 403; return { error: 'Forbidden', message: error.message }; }
                set.status = 500; return { error: 'Internal Server Error', message: error.message || 'Failed to fetch lesson.' };
            }
        },
        {
            beforeHandle: [optionalAuth() as any, checkPaidCourseAccess() as any],
            params: t.Object({ courseSlug: t.String(), moduleId: t.String({ format: 'uuid' }), lessonId: t.String({ format: 'uuid' }) }),
            detail: {
                tags: ['Lessons'],
                description: 'Get a specific lesson by ID (access controlled for paid courses)',
                responses: {
                    '200': { description: 'Lesson details', content: { 'application/json': { schema: lessonSchema } } },
                    ...commonErrorResponses
                }
            }
        }
    ); 