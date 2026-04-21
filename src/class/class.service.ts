import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import {
  CreateClassDto,
  ScheduleTaskDto,
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
    },
    scheduled: ct.scheduledTask
      ? {
          scheduledAt: ct.scheduledTask.scheduledAt,
          dueAt: ct.scheduledTask.dueAt,
          isActive: ct.scheduledTask.isActive,
        }
      : null,
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
        }
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
    return this.prisma.class.update({ where: { id }, data: dto });
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

  async getScheduledTasks(classId: string, role: string) {
    const classTasks = await this.prisma.classTask.findMany({
      where: {
        classId,
        // Students only see active scheduled tasks
        ...(role === 'student' ? { scheduledTask: { isActive: true } } : {}),
      },
      include: {
        task: { select: { id: true, title: true, type: true, status: true } },
        scheduledTask: true,
      },
    });

    return classTasks
      .filter((ct) => ct.scheduledTask !== null)
      .map(this.formatClassTask);
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
}
