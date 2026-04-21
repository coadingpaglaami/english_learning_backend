import {
  IsString,
  IsOptional,
  IsArray,
  IsDateString,
  IsBoolean,
  IsNumber,
} from 'class-validator';

export class CreateClassDto {
  @IsString()
  name!: string;

  @IsString()
  subject!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  color!: string;

  @IsNumber()
  maxStudents!: number;

  // Task IDs to add to class on creation (optional)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  taskIds?: string[];
}

export class UpdateClassDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() subject?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsNumber() maxStudents?: number;
}

export class AddStudentsDto {
  @IsArray()
  @IsString({ each: true })
  studentIds!: string[];
}

export class AddTasksDto {
  @IsArray()
  @IsString({ each: true })
  taskIds!: string[];
}

export class RemoveTasksDto {
  @IsArray()
  @IsString({ each: true })
  taskIds!: string[];
}

export class ScheduleTaskDto {
  // classTaskId — the ClassTask record to schedule
  @IsString()
  classTaskId!: string;

  @IsOptional()
  @IsDateString()
  dueAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}