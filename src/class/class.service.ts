import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import {
  CreateClassDto,
  ScheduleTaskDto,
  StudentQuery,
  UpdateClassDto,
} from './dto/create.dto';
import { PaginationQueryDto } from 'common/dto/pagination.dto';

@Injectable()
export class ClassService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Formatters ───────────────────────────────────────────────

  formatClass = (cls: any) => ({
    id: cls.id,
    name: cls.name,
    subject: cls.subject,
    description: cls.description,
    color: cls.color,
    maxStudents: cls.maxStudents,
    teacherName: cls.teacher
      ? `${cls.teacher.firstName} ${cls.teacher.lastName}`
      : '',
    studentCount: cls._count?.students ?? 0,
    taskCount: cls._count?.classTasks ?? 0,
    classTasks: cls.classTasks?.map(this.formatClassTask) ?? [],
    createdAt: cls.createdAt,
  });

  formatClassTask = (ct: any) => ({
    classTaskId: ct.id,
    addedAt: ct.addedAt,
    task: {
      id: ct.task.id,
      title: ct.task.title,
      type: ct.task.type,
      status: ct.task.status,
      questionCount: ct.task._count?.questions ?? 0,
    },
    scheduled: ct.scheduledTask
      ? {
          id: ct.scheduledTask.id,
          scheduledAt: ct.scheduledTask.scheduledAt,
          dueAt: ct.scheduledTask.dueAt,
          isActive: ct.scheduledTask.isActive,
        }
      : null,
    class: ct.class ? { id: ct.class.id, name: ct.class.name } : null,
  });

  // ─── Class CRUD ───────────────────────────────────────────────

  async create(dto: CreateClassDto, teacherId: string) {
    const cls = await this.prisma.class.create({
      data: {
        name: dto.name,
        subject: dto.subject,
        description: dto.description,
        color: dto.color,
        maxStudents: dto.maxStudents,
        teacherId,
      },
    });

    // Bulk add tasks if provided during creation
    if (dto.taskIds && dto.taskIds.length > 0) {
      await this.prisma.classTask.createMany({
        data: dto.taskIds.map((taskId) => ({
          classId: cls.id,
          taskId,
        })),
        skipDuplicates: true,
      });
    }

    return cls;
  }

  async findAll(userId: string, role: string, query: PaginationQueryDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const include = {
      teacher: { select: { firstName: true, lastName: true, email: true } },
      _count: { select: { students: true, classTasks: true } },
      classTasks: {
        include: {
          task: { select: { id: true, title: true, type: true, status: true } },
        },
      },
    };

    let where: any = {};

    if (role === 'teacher') where = { teacherId: userId };
    if (role === 'student') where = { students: { some: { id: userId } } };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.class.findMany({ where, skip, take: limit, include }),
      this.prisma.class.count({ where }),
    ]);

    return {
      data: data.map(this.formatClass),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      include: {
        teacher: { select: { firstName: true, lastName: true, email: true } },
        students: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: { select: { students: true, classTasks: true } },
        classTasks: {
          include: {
            task: {
              select: { id: true, title: true, type: true, status: true },
            },
            scheduledTask: true,
          },
        },
      },
    });

    if (!cls) throw new NotFoundException('Class not found');

    return {
      ...this.formatClass(cls),
      students: cls.students,
      tasks: cls.classTasks.map(this.formatClassTask),
    };
  }

  async update(id: string, dto: UpdateClassDto) {
    const { taskIds, ...rest } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (taskIds) {
        const existing = await tx.classTask.findMany({
          where: { classId: id },
          select: { id: true, taskId: true },
        });

        const existingTaskIds = existing.map((t) => t.taskId);

        const toAdd = taskIds.filter((t) => !existingTaskIds.includes(t));
        const toRemove = existing
          .filter((t) => !taskIds.includes(t.taskId))
          .map((t) => t.id);

        await tx.class.update({
          where: { id },
          data: rest,
        });

        if (toAdd.length) {
          await tx.classTask.createMany({
            data: toAdd.map((taskId) => ({
              classId: id,
              taskId,
            })),
          });
        }

        if (toRemove.length) {
          const scheduled = await tx.classScheduledTask.findFirst({
            where: { classTaskId: { in: toRemove } },
          });
          if (scheduled) {
            throw new BadRequestException(
              'Cannot remove a task that has already been scheduled.',
            );
          }
          await tx.classTask.deleteMany({
            where: {
              id: { in: toRemove },
            },
          });
        }
      }

      return tx.class.findUnique({
        where: { id },
        include: {
          classTasks: {
            include: {
              task: { select: { id: true } },
            },
          },
        },
      });
    });
  }

  async remove(id: string) {
    return this.prisma.class.delete({ where: { id } });
  }

  // ─── Student Enrollment ───────────────────────────────────────

  async addStudents(classId: string, studentIds: string[]) {
    return this.prisma.class.update({
      where: { id: classId },
      data: {
        students: { connect: studentIds.map((id) => ({ id })) },
      },
    });
  }

  async getStudents(classId: string, query: StudentQuery) {
    const { page = 1, limit = 10, search } = query;

    const skip = (page - 1) * limit;

    const where: any = {
      role: 'student',
      enrolledClasses: {
        some: { id: classId },
      },

      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },

          {
            student: {
              username: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        ],
      }),
    };

    const [students, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          createdAt: true,
          student: {
            select: {
              username: true,
            },
          },
        },
      }),

      this.prisma.user.count({ where }),
    ]);

    return {
      data: students,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async removeStudents(classId: string, studentIds: string[]) {
    return this.prisma.class.update({
      where: { id: classId },
      data: {
        students: { disconnect: studentIds.map((id) => ({ id })) },
      },
    });
  }

  // ─── Class Tasks ──────────────────────────────────────────────

  async addTasks(classId: string, taskIds: string[]) {
    // Verify class exists
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) throw new NotFoundException('Class not found');

    await this.prisma.classTask.createMany({
      data: taskIds.map((taskId) => ({ classId, taskId })),
      skipDuplicates: true,
    });

    return this.getClassTasks(classId);
  }

  async getClassTasks(classId: string) {
    const classTasks = await this.prisma.classTask.findMany({
      where: { classId },
      include: {
        task: { select: { id: true, title: true, type: true, status: true } },
        scheduledTask: true,
      },
      orderBy: { addedAt: 'desc' },
    });

    return classTasks.map(this.formatClassTask);
  }

  async removeTasks(classId: string, taskIds: string[]) {
    await this.prisma.classTask.deleteMany({
      where: {
        classId,
        taskId: { in: taskIds },
      },
    });

    return { message: 'Tasks removed from class' };
  }

  // ─── Scheduling ───────────────────────────────────────────────

  async scheduleTask(classId: string, dto: ScheduleTaskDto) {
    // Verify ClassTask belongs to this class
    const classTask = await this.prisma.classTask.findFirst({
      where: { id: dto.classTaskId, classId },
      include: { task: true },
    });

    if (!classTask) {
      throw new NotFoundException('Task not found in this class');
    }

    if (classTask.task.status !== 'APPROVED') {
      throw new BadRequestException(
        'Only APPROVED tasks can be scheduled for students.',
      );
    }

    // Upsert scheduled task
    return this.prisma.classScheduledTask.upsert({
      where: { classTaskId: dto.classTaskId },
      update: {
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        isActive: dto.isActive ?? true,
      },
      create: {
        classTaskId: dto.classTaskId, // only this needed
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async getScheduledTasks(classId: string, req: any) {
    const role = req.role;
    const studentId = req.sub;

    const classTasks = await this.prisma.classTask.findMany({
      where: {
        classId,
        ...(role === 'student' ? { scheduledTask: { isActive: true } } : {}),
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            _count: { select: { questions: true } },
          },
        },

        scheduledTask: {
          include: {
            attempts: {
              where:
                role === 'student' ? { studentId } : { status: 'COMPLETED' },
              select: {
                id: true,
                status: true,
                _count: {
                  select: { answers: true },
                },
              },
            },
          },
        },

        class: {
          select: {
            id: true,
            name: true,
            _count: { select: { students: true } },
          },
        },
      },
    });

    return classTasks
      .filter((ct) => ct.scheduledTask !== null)
      .map((ct) => {
        const base = this.formatClassTask(ct);

        const totalQuestions = ct.task._count.questions;

        // ----------------------
        // TEACHER VIEW
        // ----------------------
        if (role !== 'student') {
          const totalStudents = ct.class._count.students;
          const completedStudents = ct.scheduledTask!.attempts.length;

          const completionRate =
            totalStudents === 0
              ? 0
              : Math.round((completedStudents / totalStudents) * 100);

          return {
            ...base,
            totalStudents,
            completedStudents,
            completionRate,
          };
        }

        // ----------------------
        // STUDENT VIEW
        // ----------------------
        const attempt = ct.scheduledTask!.attempts[0];

        let answeredQuestions = 0;
        let status = 'NOT_STARTED';

        if (attempt) {
          answeredQuestions = attempt._count.answers;

          if (attempt.status === 'COMPLETED') {
            status = 'COMPLETED';
          } else {
            status = 'IN_PROGRESS';
          }
        }

        const progressPercentage =
          totalQuestions === 0
            ? 0
            : Math.round((answeredQuestions / totalQuestions) * 100);

        return {
          ...base,
          totalQuestions,
          answeredQuestions,
          progressPercentage,
          status,
        };
      });
  }
  async unscheduleTask(classId: string, classTaskId: string) {
    // Verify it belongs to this class
    const classTask = await this.prisma.classTask.findFirst({
      where: { id: classTaskId, classId },
    });

    if (!classTask) throw new NotFoundException('Task not found in this class');

    await this.prisma.classScheduledTask.delete({
      where: { classTaskId },
    });

    return { message: 'Task unscheduled successfully' };
  }

  async getScheduledTaskAnalytics(classId: string, scheduledTaskId: string) {
    const classData = await this.prisma.class.findUnique({
      where: { id: classId },
      select: {
        _count: { select: { students: true } },
      },
    });

    const totalStudents = classData?._count.students ?? 0;

    const completedStudents = await this.prisma.attempt.count({
      where: {
        scheduledTaskId,
        status: 'COMPLETED',
      },
    });

    const completionRate =
      totalStudents === 0
        ? 0
        : Math.round((completedStudents / totalStudents) * 100);

    // total answers per question
    const totalAnswers = await this.prisma.studentAnswer.groupBy({
      by: ['questionId'],
      where: {
        attempt: {
          scheduledTaskId,
          status: 'COMPLETED',
        },
      },
      _count: {
        questionId: true,
      },
    });

    // correct answers per question
    const correctAnswers = await this.prisma.studentAnswer.groupBy({
      by: ['questionId'],
      where: {
        isCorrect: true,
        attempt: {
          scheduledTaskId,
          status: 'COMPLETED',
        },
      },
      _count: {
        questionId: true,
      },
    });

    // convert correct answers to map
    const correctMap = new Map(
      correctAnswers.map((q) => [q.questionId, q._count.questionId]),
    );

    const questions = totalAnswers.map((q) => {
      const correct = correctMap.get(q.questionId) ?? 0;
      const total = q._count.questionId;

      return {
        questionId: q.questionId,
        totalAnswers: total,
        correctAnswers: correct,
        correctPercentage:
          total === 0 ? 0 : Math.round((correct / total) * 100),
      };
    });

    return {
      totalStudents,
      completedStudents,
      completionRate,
      questions,
    };
  }
}
