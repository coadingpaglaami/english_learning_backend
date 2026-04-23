import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';
import { SubmitAnswerDto } from './dto/attempt.dto';
import { judgeAnswer } from './judge/judge.engine';
import { resultBuilders } from './result-builder/result.engine';
import { sanitizeQuestion } from './sanitize/sanitize-question';

@Injectable()
export class AttemptService {
  constructor(private readonly prisma: PrismaService) {}


 private buildResult(attempt: any) {

    const total = attempt.task.questions.length;
    const score = attempt.score;
    const percentage = Math.round((score / total) * 100);

    const results = attempt.answers.map((answer: any) => {

      const question = attempt.task.questions.find(
        (q: any) => q.id === answer.questionId
      );

      const builder =
        resultBuilders[question.type] ??
        (() => ({
          question: question.config?.question ?? '',
          userAnswer: answer.answerData,
          correctAnswers: [],
          note: null,
        }));

      const resultData = builder(question, answer);

      return {
        questionId: answer.questionId,
        type: question.type,
        correct: answer.isCorrect,
        ...resultData,
      };
    });

    return {
      score,
      total,
      percentage,
      results,
    };
  }

  async startOrResumeAttempt(studentId: string, scheduledTaskId: string) {
    // 1. Verify schedule exists and is active
    const schedule = await this.prisma.classScheduledTask.findUnique({
      where: { id: scheduledTaskId },
      include: { classTask: true },
    });

    if (!schedule || !schedule.isActive) {
      throw new BadRequestException('This task is not currently active.');
    }

    // 2. Find existing or create new
    let attempt = await this.prisma.attempt.findUnique({
      where: { studentId_scheduledTaskId: { studentId, scheduledTaskId } },
    });

    if (!attempt) {
      attempt = await this.prisma.attempt.create({
        data: {
          studentId,
          scheduledTaskId,
          taskId: schedule.classTask.taskId,
          status: 'IN_PROGRESS',
        },
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
            questions: { orderBy: { order: 'asc' } },
          },
        },
        answers: true,
      },
    });

    if (!attempt || attempt.studentId !== studentId) {
      throw new NotFoundException();
    }

    const sanitizedQuestions = attempt.task.questions.map((q) =>
      sanitizeQuestion(q),
    );

    const baseResponse = {
      ...attempt,
      task: {
        ...attempt.task,
        questions: sanitizedQuestions,
      },
    };

    if (attempt.status === 'COMPLETED') {
      return {
        ...baseResponse,
        result: this.buildResult(attempt),
      };
    }

    return baseResponse;
  }

  async processAnswer(
    attemptId: string,
    studentId: string,
    dto: SubmitAnswerDto,
  ) {

    const attempt = await this.prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        task: { include: { questions: { orderBy: { order: 'asc' } } } },
      },
    });

    if (!attempt || attempt.studentId !== studentId)
      throw new ForbiddenException();

    if (attempt.status === 'COMPLETED')
      throw new BadRequestException('Attempt already finished');

    const currentQuestion =
      attempt.task.questions[attempt.currentQuestionIndex];

    if (currentQuestion.id !== dto.questionId) {
      throw new BadRequestException('Incorrect question sequence');
    }

    const isCorrect = judgeAnswer(
      currentQuestion.type,
      currentQuestion.config,
      dto.answerData,
    );

    const isLastQuestion =
      attempt.currentQuestionIndex === attempt.task.questions.length - 1;

    return this.prisma.$transaction(async (tx) => {

      await tx.studentAnswer.create({
        data: {
          attemptId,
          questionId: dto.questionId,
          answerData: dto.answerData,
          isCorrect,
        },
      });

      const updatedAttempt = await tx.attempt.update({
        where: { id: attemptId },
        data: {
          currentQuestionIndex: isLastQuestion
            ? attempt.currentQuestionIndex
            : { increment: 1 },
          score: isCorrect ? { increment: 1 } : undefined,
          status: isLastQuestion ? 'COMPLETED' : 'IN_PROGRESS',
          completedAt: isLastQuestion ? new Date() : null,
        },
      });

      return {
        isCorrect,
        isLastQuestion,
        nextIndex: updatedAttempt.currentQuestionIndex,
        status: updatedAttempt.status,
      };
    });
  }
}
