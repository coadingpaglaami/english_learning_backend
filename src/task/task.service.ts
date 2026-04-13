import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreateTaskDto, TaskType } from './dto/task.dto';

@Injectable()
export class TaskService {
  constructor(private readonly prisma: PrismaService) {}

  async createTask(dto: CreateTaskDto, userId: string, status: any,role:string) {
    const { title, type, isPublic, content, entryType, words, questions } = dto;

    return this.prisma.task.create({
      data: {
        title,
        type,
        status,
        isPublic: role === 'admin' ? true : false,
        createdById: userId,
        // Polymorphic creation logic
        readingContent: type === TaskType.READING && content && entryType ? {
          create: { content, entryType }
        } : undefined,
        grammarContent: type === TaskType.GRAMMAR && content && entryType ? {
          create: { content, entryType }
        } : undefined,
        vocabularyItems: type === TaskType.VOCABULARY && words ? {
          createMany: { data: words }
        } : undefined,
        // Nested questions creation
        questions: {
          createMany: {
            data: questions.map(q => ({
              type: q.type as any,
              order: q.order,
              config: q.config as any
            }))
          }
        }
      },
      include: {
        readingContent: true,
        grammarContent: true,
        vocabularyItems: true,
        questions: true
      }
    });
  }

  async findAll(role: string, userId: string, status?: any) {
    const where: any = {};

    if (status) where.status = status;

    // Teachers only see their own tasks or approved public tasks
    if (role === 'teacher') {
      where.OR = [
        { createdById: userId },
        { isPublic: true, status: 'APPROVED' }
      ];
    }

    return this.prisma.task.findMany({
      where,
      include: {
        createdBy: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        readingContent: true,
        grammarContent: true,
        vocabularyItems: true,
        questions: { orderBy: { order: 'asc' } }
      }
    });

    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async updateStatus(id: string, status: any) {
    return this.prisma.task.update({
      where: { id },
      data: { status }
    });
  }
}