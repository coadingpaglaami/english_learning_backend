import {
  Controller,
  UseGuards,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Query,
  Req,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { TaskService } from './task.service';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/decorator/role.decorator';
import { CreateTaskDto, QuestionDto } from './dto/task.dto';
import { RolesGuard } from 'src/guards/role.guard';
import {  FilesInterceptor } from '@nestjs/platform-express';
@Controller('tasks')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

@Post()
@Roles(['admin', 'teacher'])
@UseInterceptors(FilesInterceptor('images'))
async create(
  @Body() createTaskDto: CreateTaskDto,
  @Req() req: any,
  @UploadedFiles() images?: Express.Multer.File[],
) {
  const userId = req.user.sub;

  const status =
    req.user.role === 'admin' ? 'APPROVED' : 'PENDING_APPROVAL';

  console.log("Uploaded images:", images);

  return this.taskService.createTask(
    createTaskDto,
    userId,
    status,
    req.user.role,
    images,
  );
}

  @Post(':taskId/questions')
  @Roles(['admin', 'teacher'])
  async addQuestions(
    @Param('taskId') taskId: string,
    @Body() questions: QuestionDto[],
  ) {
    return this.taskService.addQuestionsToTask(taskId, questions);
  }

  @Get(':taskId/words')
  @Roles(['admin', 'teacher'])
  async getWords(@Param('taskId') taskId: string, @Query('search') search?: string) {
    return this.taskService.getTasksWords(taskId,search);
  }



  @Get()
  @Roles(['admin', 'teacher'])
  async findAll(@Query('status') status: any, @Req() req) {
    // Admins see everything, teachers see their own or public ones
    return this.taskService.findAll(req.user.role, req.user.sub, status);
  }

  @Patch(':id/approve')
  @Roles(['admin'])
  async approveTask(@Param('id') id: string, @Req() req) {
    console.log('User attempting to approve task:', req.user.role); // Debugging line to check user info
    console.log('Approving task with ID:', id); // Debugging line
    return this.taskService.updateStatus(id, 'APPROVED');
  }

  @Patch(':id/reject')
  @Roles(['admin'])
  async rejectTask(@Param('id') id: string) {
    return this.taskService.updateStatus(id, 'REJECTED');
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.taskService.findOne(id);
  }
}
