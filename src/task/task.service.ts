import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import {
  AddQuestionsDto,
  CreateTaskDto,
  QuestionDto,
  TaskQueryDto,
  TaskType,
} from './dto/task.dto';
import { UploadService } from 'src/upload/upload.service';
import { QuestionType } from 'src/database/prisma-client/enums';

@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  async createTask(
    dto: CreateTaskDto,
    userId: string,
    status: any,
    role: string,
    files?: Express.Multer.File[],
    passageImage?: Express.Multer.File,
  ) {
    const { title, type, content, entryType, words, questions } = dto;

    let vocabularyItemsData:
      | { wordName: string; definition: string; imageUrl?: string }[]
      | undefined;

    console.log('Images', files);

    /**
     * Handle Vocabulary Words
     */
    if (type === TaskType.VOCABULARY && words?.length) {
      vocabularyItemsData = [];

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        let imageUrl = word.imageUrl;

        // Upload image if provided
        if (files?.[i]) {
          imageUrl = await this.uploadService.uploadSingleImage(
            files[i],
            'vocabulary_images',
          );
        }

        vocabularyItemsData.push({
          wordName: word.wordName,
          definition: word.definition,
          imageUrl,
        });
      }
    }
    let passageImageUrl: string | undefined;
    if (type === TaskType.READING && passageImage) {
      passageImageUrl =
        await this.uploadService.uploadSingleImage(passageImage);
    }

    /**
     * Create Task
     */
    return this.prisma.task.create({
      data: {
        title,
        type,
        status,
        isPublic: role === 'admin',
        createdById: userId,

        /**
         * Reading Content
         */
        readingContent:
          type === TaskType.READING && content && entryType?.length
            ? {
                create: {
                  content,
                  entryType,
                  imageUrl: passageImageUrl,
                },
              }
            : undefined,

        /**
         * Grammar Content
         */
        grammarContent:
          type === TaskType.GRAMMAR && content && entryType?.length
            ? {
                create: {
                  content,
                  entryType,
                },
              }
            : undefined,

        /**
         * Vocabulary Words
         */
        vocabularyItems:
          type === TaskType.VOCABULARY && vocabularyItemsData?.length
            ? {
                createMany: {
                  data: vocabularyItemsData,
                },
              }
            : undefined,

        /**
         * Questions
         */
        questions: questions?.length
          ? {
              createMany: {
                data: questions.map((q) => ({
                  type: q.type as QuestionType,
                  order: q.order,
                  config: q.config as any,
                })),
              },
            }
          : undefined,
      },

      include: {
        readingContent: true,
        grammarContent: true,
        vocabularyItems: true,
        questions: true,
      },
    });
  }

  async addQuestionsToTask(taskId: string, questions: AddQuestionsDto) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { questions: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (task.questions.length > 0) {
      throw new ConflictException('Questions already added to this task');
    }
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        questions: {
          createMany: {
            data: questions.questions.map((q) => ({
              type: q.type as QuestionType,
              order: q.order,
              config:
                typeof q.config === 'string' ? JSON.parse(q.config) : q.config,
            })),
          },
        },
      },
      include: {
        questions: true,
        vocabularyItems: true, // Useful to see the words associated
      },
    });
  }

  async getTasksWords(taskId: string, search?: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        vocabularyItems: true,
      },
    });
    if (!task) throw new NotFoundException('Task not found');
    if (search) {
      task.vocabularyItems = task.vocabularyItems.filter((item) =>
        item.wordName.toLowerCase().includes(search.toLowerCase()),
      );
    }
    return task.vocabularyItems;
  }

  async findAll(role: string, userId: string, query: TaskQueryDto) {
    const { page = 1, limit = 10, status } = query;

    const where: any = {};

    if (status) where.status = status;

    if (role === 'teacher') {
      where.OR = [
        { createdById: userId },
        { isPublic: true, status: 'APPROVED' },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: {
          createdBy: { select: { email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),

      this.prisma.task.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        readingContent: true,
        grammarContent: true,
        vocabularyItems: true,
        questions: { orderBy: { order: 'asc' } },
      },
    });

    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async updateStatus(id: string, status: any) {
    return this.prisma.task.update({
      where: { id },
      data: { status },
    });
  }
}
