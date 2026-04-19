import {
  IsEnum,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsInt,
  ValidateIf,
} from 'class-validator';
import { Type, Transform, plainToInstance } from 'class-transformer';
import { EntryType, TaskStatus } from 'src/database/prisma-client/enums';
import { PaginationQueryDto } from 'common/dto/pagination.dto';

export enum TaskType {
  READING = 'READING',
  GRAMMAR = 'GRAMMAR',
  VOCABULARY = 'VOCABULARY',
}

export class QuestionDto {
  @IsEnum(['MCQ', 'GAP_FILL', 'WORD_BOX_MATCH', 'MATCHING', 'QUESTION_ANSWER'])
  type!: string;

  @IsInt()
  @Transform(({ value }) => parseInt(value, 10))
  order!: number;

  @IsString()
  config!: string;
}

class WordItemDto {
  @IsString()
  wordName!: string;

  @IsString()
  definition!: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class CreateTaskDto {
  @IsString()
  title!: string;

  @IsEnum(TaskType)
  type!: TaskType;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return value; }
    }
    return value;
  })
  @IsArray()
  @IsEnum(EntryType, { each: true })
  entryType?: EntryType[];

  @IsOptional()
  @Transform(({ value }) => {
    let parsed = value;
    if (typeof value === 'string') {
      try { parsed = JSON.parse(value); } catch { return value; }
    }
    if (Array.isArray(parsed)) {
      return plainToInstance(WordItemDto, parsed);
    }
    return parsed;
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WordItemDto)
  words?: WordItemDto[];

  @ValidateIf((o) => o.type !== TaskType.VOCABULARY)
  @Transform(({ value }) => {
    let parsed = value;
    if (typeof value === 'string') {
      try { parsed = JSON.parse(value); } catch { return value; }
    }
    if (Array.isArray(parsed)) {
      return plainToInstance(QuestionDto, parsed);
    }
    return parsed;
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions!: QuestionDto[];
}

export class AddQuestionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions!: QuestionDto[];
}

export class TaskQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}