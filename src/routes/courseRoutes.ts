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
import { requireAuthor } from '../middlewares/auth';
import { RouteContext, AuthenticatedContext } from '../types/routes';
import {
    NotFoundError, ForbiddenError, ValidationError, DatabaseError
} from '../utils/errors';

const commonErrorResponses = {
    '400': {
        description: 'Invalid input data',
        content: {
            'application/json': {
                schema: errorSchema
            }
        }
    },
    '401': {
        description: 'Unauthorized',
        content: {
            'application/json': {
                schema: errorSchema
            }
        }
    },
    '403': {
        description: 'Forbidden',
        content: {
            'application/json': {
                schema: errorSchema
            }
        }
    },
    '404': {
        description: 'Not found',
        content: {
            'application/json': {
                schema: errorSchema
            }
        }
    },
    '500': {
        description: 'Internal server error',
        content: {
            'application/json': {
                schema: errorSchema
            }
        }
    }
};

export const courseRoutes = new Elysia({ prefix: '/courses' })
    // --- Course Routes (Protegidas) ---
    .post('/', async ({ body, request, set }: RouteContext & { body: typeof courseInputSchema.static }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const courseDataForService = { ...body, member_id: user.id };
                const course = await CourseService.createCourse(courseDataForService);
                set.status = 201;
                return course;
            } catch (error: any) {
                console.error("Error creating course:", error);
                if (error instanceof ValidationError) {
                    set.status = 400;
                    return { error: 'Validation Error', message: error.message };
                } else if (error instanceof ForbiddenError) {
                    set.status = 403;
                    return { error: 'Forbidden', message: error.message };
                } else if (error instanceof DatabaseError && error.message.includes('slug')) { 
                    set.status = 409; // Conflict
                    return { error: 'Conflict', message: 'Course slug already exists.' };
                } else {
                    set.status = 500;
                    return { error: 'Internal Server Error', message: error.message || 'Failed to create course.' };
                }
            }
        })({ body, request, set });
    }, {
        body: courseInputSchema,
        detail: {
            tags: ['Courses'],
            description: 'Create a new course', 
            security: [{ bearerAuth: [] }],
            responses: {
                '201': {
                    description: 'Course created',
                    content: {
                        'application/json': {
                            schema: courseSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .put('/:courseSlug', async ({ params, body, request, set }: RouteContext & { params: { courseSlug: string }, body: typeof courseUpdateSchema.static }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const updatedCourse = await CourseService.updateCourse(params.courseSlug, body, user.id);
                return updatedCourse;
            } catch (error: any) {
                console.error(`Error updating course ${params.courseSlug}:`, error);
                if (error instanceof ValidationError) {
                    set.status = 400;
                    return { error: 'Validation Error', message: error.message };
                } else if (error instanceof NotFoundError) {
                    set.status = 404;
                    return { error: 'Not Found', message: error.message };
                } else if (error instanceof ForbiddenError) {
                    set.status = 403;
                    return { error: 'Forbidden', message: error.message };
                } else {
                    set.status = 500;
                    return { error: 'Internal Server Error', message: error.message || 'Failed to update course.' };
                }
            }
        })({ params, body, request, set });
    }, {
        params: t.Object({ courseSlug: t.String() }),
        body: courseUpdateSchema,
        detail: {
            tags: ['Courses'],
            description: 'Update an existing course', 
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Course updated',
                    content: {
                        'application/json': {
                            schema: courseSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .delete('/:courseSlug', async ({ params, request, set }: RouteContext & { params: { courseSlug: string } }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                await CourseService.deleteCourse(params.courseSlug, user.id);
                set.status = 204;
                return null; // No content
            } catch (error: any) {
                console.error(`Error deleting course ${params.courseSlug}:`, error);
                if (error instanceof NotFoundError) {
                    set.status = 404;
                    return { error: 'Not Found', message: error.message };
                } else if (error instanceof ForbiddenError) {
                    set.status = 403;
                    return { error: 'Forbidden', message: error.message };
                } else {
                    set.status = 500;
                    return { error: 'Internal Server Error', message: error.message || 'Failed to delete course.' };
                }
            }
        })({ params, request, set });
    }, {
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
    })

    // --- Course Module Routes (Protegidas) ---
    .post('/:courseSlug/modules', async ({ params, body, request, set }: RouteContext & { params: { courseSlug: string }, body: typeof courseModuleInputSchema.static }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const courseInfo = await CourseService.getCourseOwnerAndIdBySlug(params.courseSlug);
                if (!courseInfo) throw new NotFoundError(`Course with slug '${params.courseSlug}' not found.`);
                if (courseInfo.ownerId !== user.id) throw new ForbiddenError('You do not have permission to add modules to this course.');
                
                const moduleDataForService = { ...body, course_id: courseInfo.courseId };
                const module = await CourseModuleService.createModule(params.courseSlug, moduleDataForService, user.id);
                set.status = 201;
                return module;
            } catch (error: any) {
                console.error(`Error creating module for course ${params.courseSlug}:`, error);
                if (error instanceof ValidationError) { set.status = 400; return { error: 'Validation Error', message: error.message }; }
                if (error instanceof NotFoundError) { set.status = 404; return { error: 'Not Found', message: error.message }; }
                if (error instanceof ForbiddenError) { set.status = 403; return { error: 'Forbidden', message: error.message }; }
                set.status = 500; return { error: 'Internal Server Error', message: error.message || 'Failed to create module.' };
            }
        })({ params, body, request, set });
    }, {
        params: t.Object({ courseSlug: t.String() }),
        body: courseModuleInputSchema,
        detail: {
            tags: ['Course Modules'],
            description: 'Create a new module for a course', 
            security: [{ bearerAuth: [] }],
            responses: {
                '201': {
                    description: 'Module created',
                    content: {
                        'application/json': {
                            schema: courseModuleSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .put('/:courseSlug/modules/:moduleId', async ({ params, body, request, set }: RouteContext & { params: { courseSlug: string, moduleId: string }, body: typeof courseModuleUpdateSchema.static }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const updatedModule = await CourseModuleService.updateModule(params.moduleId, params.courseSlug, body, user.id);
                return updatedModule;
            } catch (error: any) {
                console.error(`Error updating module ${params.moduleId} in course ${params.courseSlug}:`, error);
                if (error instanceof ValidationError) { set.status = 400; return { error: 'Validation Error', message: error.message }; }
                if (error instanceof NotFoundError) { set.status = 404; return { error: 'Not Found', message: error.message }; }
                if (error instanceof ForbiddenError) { set.status = 403; return { error: 'Forbidden', message: error.message }; }
                set.status = 500; return { error: 'Internal Server Error', message: error.message || 'Failed to update module.' };
            }
        })({ params, body, request, set });
    }, {
        params: t.Object({ courseSlug: t.String(), moduleId: t.String({ format: 'uuid' }) }),
        body: courseModuleUpdateSchema,
        detail: {
            tags: ['Course Modules'],
            description: 'Update a course module', 
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Module updated',
                    content: {
                        'application/json': {
                            schema: courseModuleSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .delete('/:courseSlug/modules/:moduleId', async ({ params, request, set }: RouteContext & { params: { courseSlug: string, moduleId: string } }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                await CourseModuleService.deleteModule(params.moduleId, params.courseSlug, user.id);
                set.status = 204;
                return null;
            } catch (error: any) {
                console.error(`Error deleting module ${params.moduleId} in course ${params.courseSlug}:`, error);
                if (error instanceof NotFoundError) { set.status = 404; return { error: 'Not Found', message: error.message }; }
                if (error instanceof ForbiddenError) { set.status = 403; return { error: 'Forbidden', message: error.message }; }
                set.status = 500; return { error: 'Internal Server Error', message: error.message || 'Failed to delete module.' };
            }
        })({ params, request, set });
    }, {
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
    })

    // --- Lesson Routes (Protegidas) ---
    .post('/:courseSlug/modules/:moduleId/lessons', async ({ params, body, request, set }: RouteContext & { params: { courseSlug: string, moduleId: string }, body: typeof lessonInputSchema.static }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const lessonDataForService = { ...body, course_module_id: params.moduleId };
                const lesson = await LessonService.createLesson(lessonDataForService, params.moduleId, params.courseSlug, user.id);
                set.status = 201;
                return lesson;
            } catch (error: any) {
                console.error(`Error creating lesson in module ${params.moduleId}:`, error);
                if (error instanceof ValidationError) { set.status = 400; return { error: 'Validation Error', message: error.message }; }
                if (error instanceof NotFoundError) { set.status = 404; return { error: 'Not Found', message: error.message }; }
                if (error instanceof ForbiddenError) { set.status = 403; return { error: 'Forbidden', message: error.message }; }
                set.status = 500; return { error: 'Internal Server Error', message: error.message || 'Failed to create lesson.' };
            }
        })({ params, body, request, set });
    }, {
        params: t.Object({ courseSlug: t.String(), moduleId: t.String({ format: 'uuid' }) }),
        body: lessonInputSchema,
        detail: {
            tags: ['Lessons'],
            description: 'Create a new lesson in a module', 
            security: [{ bearerAuth: [] }],
            responses: {
                '201': {
                    description: 'Lesson created',
                    content: {
                        'application/json': {
                            schema: lessonSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .put('/:courseSlug/modules/:moduleId/lessons/:lessonId', async ({ params, body, request, set }: RouteContext & { params: { courseSlug: string, moduleId: string, lessonId: string }, body: typeof lessonUpdateSchema.static }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                const updatedLesson = await LessonService.updateLesson(params.lessonId, body, params.moduleId, params.courseSlug, user.id);
                return updatedLesson;
            } catch (error: any) {
                console.error(`Error updating lesson ${params.lessonId}:`, error);
                if (error instanceof ValidationError) { set.status = 400; return { error: 'Validation Error', message: error.message }; }
                if (error instanceof NotFoundError) { set.status = 404; return { error: 'Not Found', message: error.message }; }
                if (error instanceof ForbiddenError) { set.status = 403; return { error: 'Forbidden', message: error.message }; }
                set.status = 500; return { error: 'Internal Server Error', message: error.message || 'Failed to update lesson.' };
            }
        })({ params, body, request, set });
    }, {
        params: t.Object({ courseSlug: t.String(), moduleId: t.String({ format: 'uuid' }), lessonId: t.String({ format: 'uuid' }) }),
        body: lessonUpdateSchema,
        detail: {
            tags: ['Lessons'],
            description: 'Update a lesson', 
            security: [{ bearerAuth: [] }],
            responses: {
                '200': {
                    description: 'Lesson updated',
                    content: {
                        'application/json': {
                            schema: lessonSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .delete('/:courseSlug/modules/:moduleId/lessons/:lessonId', async ({ params, request, set }: RouteContext & { params: { courseSlug: string, moduleId: string, lessonId: string } }) => {
        return requireAuthor(async ({ user, set }: AuthenticatedContext) => {
            try {
                await LessonService.deleteLesson(params.lessonId, params.moduleId, params.courseSlug, user.id);
                set.status = 204;
                return null;
            } catch (error: any) {
                console.error(`Error deleting lesson ${params.lessonId}:`, error);
                if (error instanceof NotFoundError) { set.status = 404; return { error: 'Not Found', message: error.message }; }
                if (error instanceof ForbiddenError) { set.status = 403; return { error: 'Forbidden', message: error.message }; }
                set.status = 500; return { error: 'Internal Server Error', message: error.message || 'Failed to delete lesson.' };
            }
        })({ params, request, set });
    }, {
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
    })

    // --- Rotas GET Públicas ---
    .get('/', async ({ set }) => {
        try {
            const courses = await CourseService.getAllCourses();
            return courses;
        } catch (error: any) {
            console.error("Error fetching all courses:", error);
            set.status = 500;
            return { 
                error: 'Internal Server Error', 
                message: error.message || 'Failed to fetch courses.' 
            };
        }
    }, {
        detail: {
            tags: ['Courses'],
            description: 'Get all published courses',
            responses: {
                '200': {
                    description: 'List of courses',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'array',
                                items: courseSchema
                            }
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .get('/:courseSlug', async ({ params, set }) => {
        try {
            const course = await CourseService.getCourseBySlug(params.courseSlug);
            if (!course) {
                set.status = 404;
                return { error: 'Not Found', message: 'Course not found.' };
            }
            return course;
        } catch (error: any) {
            console.error(`Error fetching course ${params.courseSlug}:`, error);
            set.status = 500;
            return { error: 'Internal Server Error', message: error.message || 'Failed to fetch course.' };
        }
    }, {
        params: t.Object({ courseSlug: t.String() }),
        detail: {
            tags: ['Courses'],
            description: 'Get a specific course by slug',
            responses: {
                '200': {
                    description: 'Course details',
                    content: {
                        'application/json': {
                            schema: courseSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .get('/:courseSlug/modules', async ({ params, set }) => {
        try {
            const course = await CourseService.getCourseBySlug(params.courseSlug);
            if (!course) {
                set.status = 404;
                return { error: 'Not Found', message: `Course with slug '${params.courseSlug}' not found.` };
            }
            const modules = await CourseModuleService.getAllModulesForCourse(params.courseSlug);
            return modules;
        } catch (error: any) {
            console.error(`Error fetching modules for course ${params.courseSlug}:`, error);
            if (!(error instanceof NotFoundError) && !(error instanceof ForbiddenError) && !(error instanceof ValidationError)) {
                 set.status = 500;
            } else if (error instanceof NotFoundError) {
                 set.status = 404;
            }
            return { error: error.name || 'Error', message: error.message || 'Failed to fetch modules.' };
        }
    }, {
        params: t.Object({ courseSlug: t.String() }),
        detail: {
            tags: ['Course Modules'],
            description: 'Get all modules for a course',
            responses: {
                '200': {
                    description: 'List of modules',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'array',
                                items: courseModuleSchema
                            }
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .get('/:courseSlug/modules/:moduleId/lessons', async ({ params, set }) => {
        try {
            const course = await CourseService.getCourseBySlug(params.courseSlug);
            if (!course) { throw new NotFoundError(`Course with slug '${params.courseSlug}' not found.`); }
            
            const module = await CourseModuleService.getModuleById(params.moduleId);
            if (!module || module.course_id !== course.id) { throw new NotFoundError(`Module with ID '${params.moduleId}' not found in course '${params.courseSlug}'.`); }
            
            const lessons = await LessonService.getAllLessonsForModule(params.moduleId, params.courseSlug);
            return lessons;
        } catch (error: any) {
            console.error(`Error fetching lessons for module ${params.moduleId}:`, error);
            if (error instanceof NotFoundError) { set.status = 404; return { error: 'Not Found', message: error.message }; }
            set.status = 500; return { error: 'Internal Server Error', message: error.message || 'Failed to fetch lessons.' };
        }
    }, {
        params: t.Object({ courseSlug: t.String(), moduleId: t.String({ format: 'uuid' }) }),
        detail: {
            tags: ['Lessons'],
            description: 'Get all lessons for a module',
            responses: {
                '200': {
                    description: 'List of lessons',
                    content: {
                        'application/json': {
                            schema: {
                                type: 'array',
                                items: lessonSchema
                            }
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    })
    .get('/:courseSlug/modules/:moduleId/lessons/:lessonId', async ({ params, set }) => {
        try {
            const course = await CourseService.getCourseBySlug(params.courseSlug);
            if (!course) {
                set.status = 404;
                return { error: 'Not Found', message: `Course with slug '${params.courseSlug}' not found.` };
            }
            const module = await CourseModuleService.getModuleById(params.moduleId);
            if (!module || module.course_id !== course.id) {
                set.status = 404;
                return { error: 'Not Found', message: `Module with ID '${params.moduleId}' not found in course '${params.courseSlug}'.` };
            }
            const lesson = await LessonService.getLessonById(params.lessonId);
            if (!lesson || lesson.course_module_id !== module.id) {
                set.status = 404;
                return { error: 'Not Found', message: `Lesson with ID '${params.lessonId}' not found in module '${params.moduleId}'.` };
            }
            return lesson;
        } catch (error: any) {
            console.error(`Error fetching lesson ${params.lessonId}:`, error);
            if (error instanceof NotFoundError) {
                 set.status = 404;
            }
            return { error: 'Internal Server Error', message: error.message || 'Failed to fetch lesson.' };
        }
    }, {
        params: t.Object({ courseSlug: t.String(), moduleId: t.String({ format: 'uuid' }), lessonId: t.String({ format: 'uuid' }) }),
        detail: {
            tags: ['Lessons'],
            description: 'Get a specific lesson by ID',
            responses: {
                '200': {
                    description: 'Lesson details',
                    content: {
                        'application/json': {
                            schema: lessonSchema
                        }
                    }
                },
                ...commonErrorResponses
            }
        }
    }); 