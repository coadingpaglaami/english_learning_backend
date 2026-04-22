import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { SubmitAnswerDto } from './dto/attempt.dto';

@Injectable()
export class AttemptService {
  constructor(private readonly prisma: PrismaService) {}

  async startOrResumeAttempt(studentId: string, scheduledTaskId: string) {
    // 1. Verify schedule exists and is active
    const schedule = await this.prisma.classScheduledTask.findUnique({
      where: { id: scheduledTaskId },
      include: { classTask: true }
    });

    if (!schedule || !schedule.isActive) {
      throw new BadRequestException('This task is not currently active.');
    }

    // 2. Find existing or create new
    let attempt = await this.prisma.attempt.findUnique({
      where: { studentId_scheduledTaskId: { studentId, scheduledTaskId } }
    });

    if (!attempt) {
      attempt = await this.prisma.attempt.create({
        data: {
          studentId,
          scheduledTaskId,
          taskId: schedule.classTask.taskId,
          status: 'IN_PROGRESS',
        }
      });
    }

    return attempt;
  }

  async getAttemptState(attemptId: string, studentId: string) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        task: {
          include: {
            readingContent: true,
            grammarContent: true,
            vocabularyItems: true,
            questions: { orderBy: { order: 'asc' } }
          }
        },
        answers: true
      }
    });

    if (!attempt || attempt.studentId !== studentId) throw new NotFoundException();
    return attempt;
  }

  async processAnswer(attemptId: string, studentId: string, dto: SubmitAnswerDto) {
    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: { task: { include: { questions: { orderBy: { order: 'asc' } } } } }
    });

    if (!attempt || attempt.studentId !== studentId) throw new ForbiddenException();
    if (attempt.status === 'COMPLETED') throw new BadRequestException('Attempt already finished');

    // 1. Validate sequence: Student must answer the question at currentQuestionIndex
    const currentQuestion = attempt.task.questions[attempt.currentQuestionIndex];
    if (currentQuestion.id !== dto.questionId) {
      throw new BadRequestException('Incorrect question sequence');
    }

    // 2. Judging Logic
    const isCorrect = this.judgeAnswer(currentQuestion.type, currentQuestion.config, dto.answerData);

    // 3. Save Answer and Update Progress
    const isLastQuestion = attempt.currentQuestionIndex === attempt.task.questions.length - 1;

    return this.prisma.$transaction(async (tx) => {
      await tx.studentAnswer.create({
        data: {
          attemptId,
          questionId: dto.questionId,
          answerData: dto.answerData,
          isCorrect
        }
      });

      const updatedAttempt = await tx.attempt.update({
        where: { id: attemptId },
        data: {
          currentQuestionIndex: isLastQuestion ? attempt.currentQuestionIndex : { increment: 1 },
          score: isCorrect ? { increment: 1 } : undefined,
          status: isLastQuestion ? 'COMPLETED' : 'IN_PROGRESS',
          completedAt: isLastQuestion ? new Date() : null
        }
      });

      return {
        isCorrect,
        isLastQuestion,
        nextIndex: updatedAttempt.currentQuestionIndex,
        status: updatedAttempt.status
      };
    });
  }

  private judgeAnswer(type: string, config: any, studentData: any): boolean {
    // Logic depends on how you structured your JSON config
    switch (type) {
      case 'MCQ':
        // If config: { options: [{text: 'A', isCorrect: true}, {text: 'B', isCorrect: false}] }
        // and studentData is the index or text
        if (typeof studentData === 'number') {
            return config.options[studentData]?.isCorrect === true;
        }
        return false;

      case 'GAP_FILL':
        // If config: { answers: ['apple', 'banana'] }
        // and studentData is ['apple', 'wrong']
        const correctAnswers = config.answers as string[];
        const studentAnswers = studentData as string[];
        return correctAnswers.every((val, index) => 
            val.toLowerCase().trim() === studentAnswers[index]?.toLowerCase().trim()
        );

      case 'WORD_BOX_MATCH':
        // Compare mapping objects
        return JSON.stringify(config.correctMapping) === JSON.stringify(studentData);

      default:
        return false;
    }
  }
}