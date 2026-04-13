import { IsEnum, IsString, IsOptional, IsArray, ValidateNested, IsBoolean, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export enum TaskType {
  READING = 'READING',
  GRAMMAR = 'GRAMMAR',
  VOCABULARY = 'VOCABULARY',
}

class QuestionDto {
  @IsEnum(['MCQ', 'GAP_FILL', 'WORD_BOX_MATCH'])
  type!: string;

  @IsInt()
  order!: number;

  @IsString()
  config!: string; // JSON string from frontend or an object
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
  organizationId!: string;

  // Type specific content
  @IsOptional() @IsString() content?: string; // For Reading/Grammar
  @IsOptional() @IsString() entryType?: string; // For Reading/Grammar
  
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WordItemDto)
  words?: WordItemDto[]; // For Vocabulary

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionDto)
  questions!: QuestionDto[];
}