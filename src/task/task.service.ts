import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { CreateTaskDto, QuestionDto, TaskType } from './dto/task.dto';
import { UploadService } from 'src/upload/upload.service';

@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  // async createTask(
  //   dto: CreateTaskDto,
  //   userId: string,
  //   status: any,
  //   role: string,
  //   files?: Express.Multer.File[],
  // ) {
  //   const { title, type, isPublic, content, entryType, words, questions } = dto;
  //   let vocabularyItemsData:
  //     | { wordName: string; definition: string; imageUrl?: string }[]
  //     | undefined = undefined;

  //   if (type === TaskType.VOCABULARY && words) {
  //     vocabularyItemsData = await Promise.all(
  //       words.map(async (word, index) => {
  //         let imageUrl = word.imageUrl;

  //         if (files && files[index]) {
  //           imageUrl = await this.uploadService.uploadSingleImage(
  //             files[index],
  //             'vocabulary_images',
  //           );
  //         }

  //         return { ...word, imageUrl };
  //       }),
  //     );
  //   }

  //   return this.prisma.task.create({
  //     data: {
  //       title,
  //       type,
  //       status,
  //       isPublic: role === 'admin' ? true : false,
  //       createdById: userId,
  //       // Polymorphic creation logic
  //       readingContent:
  //         type === TaskType.READING && content && entryType?.length
  //           ? {
  //               create: {
  //                 content,
  //                 entryType,
  //               },
  //             }
  //           : undefined,

  //       grammarContent:
  //         type === TaskType.GRAMMAR && content && entryType?.length
  //           ? {
  //               create: {
  //                 content,
  //                 entryType,
  //               },
  //             }
  //           : undefined,
  //       vocabularyItems:
  //         type === TaskType.VOCABULARY && words
  //           ? {
  //               createMany: { data: vocabularyItemsData! },
  //             }
  //           : undefined,
  //       // Nested questions creation
  //       questions: {
  //         createMany: {
  //           data: questions.map((q) => ({
  //             type: q.type as any,
  //             order: q.order,
  //             config: q.config as any,
  //           })),
  //         },
  //       },
  //     },
  //     include: {
  //       readingContent: true,
  //       grammarContent: true,
  //       vocabularyItems: true,
  //       questions: true,
  //     },
  //   });
  // }

  async createTask(
    dto: CreateTaskDto,
    userId: string,
    status: any,
    role: string,
    files?: Express.Multer.File[],
  ) {
    const { title, type, content, entryType, words, questions } = dto;

    let vocabularyItemsData:
      | { wordName: string; definition: string; imageUrl?: string }[]
      | undefined;

      console.log('Images', files)

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
                  type: q.type as any,
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

  async addQuestionsToTask(taskId: string, questions: QuestionDto[]) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Task not found');

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        questions: {
          createMany: {
            data: questions.map((q) => ({
              type: q.type as any,
              order: q.order,
              config: q.config as any,
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

  async findAll(role: string, userId: string, status?: any) {
    const where: any = {};

    if (status) where.status = status;

    // Teachers only see their own tasks or approved public tasks
    if (role === 'teacher') {
      where.OR = [
        { createdById: userId },
        { isPublic: true, status: 'APPROVED' },
      ];
    }

    return this.prisma.task.findMany({
      where,
      include: {
        createdBy: { select: { email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
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
