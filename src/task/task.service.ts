import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import {
  AddQuestionsDto,
  CreateTaskDto,
  TaskQueryDto,
  TaskType,
} from './dto/task.dto';
import { UploadService } from 'src/upload/upload.service';
import { QuestionType } from 'src/database/prisma-client/enums';
import { UpdateTaskDto } from './dto/update-task.dto';

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
    const {
      title,
      type,
      content,
      entryType,
      words,
      questions,
      awardingBody,
      passMark,
    } = dto;

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
                  awardingBody,
                  passMark,
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
                  criterionId: q.criterionId,
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

  async updateTask(
    taskId: string,
    dto: UpdateTaskDto,
    userId: string,
    role: string,
    files: Express.Multer.File[] = [],
  ) {
    const existingTask = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        readingContent: true,
        grammarContent: true,
        vocabularyItems: true,
        questions: true,
      },
    });

    if (!existingTask) {
      throw new NotFoundException('Task not found');
    }

    // optional ownership/permission logic
    if (role !== 'admin' && existingTask.createdById !== userId) {
      throw new ForbiddenException('You are not allowed to update this task');
    }

    const fileMap = new Map<string, Express.Multer.File>();
    for (const file of files) {
      fileMap.set(file.fieldname, file);
    }

    let newPassageImageUrl: string | undefined;
    const passageImage = fileMap.get('passageImage');
    if (passageImage) {
      newPassageImageUrl =
        await this.uploadService.uploadSingleImage(passageImage);
    }

    return this.prisma.$transaction(async (tx) => {
      /**
       * delete questions
       */
      if (dto.deleteQuestionIds?.length) {
        await tx.question.deleteMany({
          where: {
            id: { in: dto.deleteQuestionIds },
            taskId,
          },
        });
      }

      /**
       * update questions
       */
      if (dto.updateQuestions?.length) {
        for (const q of dto.updateQuestions) {
          const updateData: any = {};

          if (q.type !== undefined) updateData.type = q.type;
          if (q.order !== undefined) updateData.order = q.order;
          if (q.config !== undefined) updateData.config = q.config;

          await tx.question.update({
            where: { id: q.id },
            data: updateData,
          });
        }
      }

      /**
       * append questions
       */
      if (dto.newQuestions?.length) {
        await tx.question.createMany({
          data: dto.newQuestions.map((q) => ({
            taskId,
            type: q.type as QuestionType,
            order: q.order,
            config: q.config,
          })),
        });
      }

      /**
       * delete words
       */
      if (dto.deleteWordIds?.length) {
        await tx.wordItem.deleteMany({
          where: {
            id: { in: dto.deleteWordIds },
            taskId,
          },
        });
      }

      /**
       * update words
       */
      if (dto.updateWords?.length) {
        for (const word of dto.updateWords) {
          const updateData: any = {};

          if (word.wordName !== undefined) updateData.wordName = word.wordName;
          if (word.definition !== undefined)
            updateData.definition = word.definition;

          if (word.removeImage) {
            updateData.imageUrl = null;
          }

          if (word.imageKey) {
            const imageFile = fileMap.get(`wordImage_${word.imageKey}`);
            if (imageFile) {
              updateData.imageUrl = await this.uploadService.uploadSingleImage(
                imageFile,
                'vocabulary_images',
              );
            }
          }

          await tx.wordItem.update({
            where: { id: word.id },
            data: updateData,
          });
        }
      }

      /**
       * append words
       */
      if (dto.newWords?.length) {
        for (const word of dto.newWords) {
          let imageUrl = word.imageUrl;

          if (word.imageKey) {
            const imageFile = fileMap.get(`wordImage_${word.imageKey}`);
            if (imageFile) {
              imageUrl = await this.uploadService.uploadSingleImage(
                imageFile,
                'vocabulary_images',
              );
            }
          }

          await tx.wordItem.create({
            data: {
              taskId,
              wordName: word.wordName,
              definition: word.definition,
              imageUrl,
            },
          });
        }
      }

      /**
       * update reading/grammar content
       */
      if (existingTask.type === 'READING') {
        const shouldUpdateReading =
          dto.content !== undefined ||
          dto.entryType !== undefined ||
          dto.removePassageImage ||
          newPassageImageUrl !== undefined;

        if (shouldUpdateReading) {
          if (existingTask.readingContent) {
            await tx.readingTask.update({
              where: { taskId },
              data: {
                content: dto.content ?? existingTask.readingContent.content,
                entryType:
                  dto.entryType ?? existingTask.readingContent.entryType,
                imageUrl:
                  newPassageImageUrl !== undefined
                    ? newPassageImageUrl
                    : dto.removePassageImage
                      ? null
                      : existingTask.readingContent.imageUrl,
              },
            });
          } else {
            await tx.readingTask.create({
              data: {
                taskId,
                content: dto.content ?? '',
                entryType: dto.entryType ?? [],
                imageUrl: newPassageImageUrl,
              },
            });
          }
        }
      }

      if (existingTask.type === 'GRAMMAR') {
        const shouldUpdateGrammar =
          dto.content !== undefined || dto.entryType !== undefined;

        if (shouldUpdateGrammar) {
          if (existingTask.grammarContent) {
            await tx.grammarTask.update({
              where: { taskId },
              data: {
                content: dto.content ?? existingTask.grammarContent.content,
                entryType:
                  dto.entryType ?? existingTask.grammarContent.entryType,
              },
            });
          } else {
            await tx.grammarTask.create({
              data: {
                taskId,
                content: dto.content ?? '',
                entryType: dto.entryType ?? [],
              },
            });
          }
        }
      }

      /**
       * update base task
       */
      await tx.task.update({
        where: { id: taskId },
        data: {
          title: dto.title ?? existingTask.title,
          isPublic:
            role === 'admin'
              ? (dto.isPublic ?? existingTask.isPublic)
              : existingTask.isPublic,
          status:
            role === 'admin'
              ? (dto.status ?? existingTask.status)
              : existingTask.status,
        },
      });

      return tx.task.findUnique({
        where: { id: taskId },
        include: {
          readingContent: true,
          grammarContent: true,
          vocabularyItems: true,
          questions: {
            orderBy: { order: 'asc' },
          },
        },
      });
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
