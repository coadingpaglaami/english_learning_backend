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
} from '@nestjs/common';
import { TaskService } from './task.service';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/decorator/role.decorator';
import { CreateTaskDto } from './dto/task.dto';
import { RolesGuard } from 'src/guards/role.guard';
@Controller('tasks')
@UseGuards(AuthGuard('jwt'),RolesGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @Roles(['admin', 'teacher'])
  async create(@Body() createTaskDto: CreateTaskDto, @Req() req: any) {
    const userId = req.user.sub;
    console.log('Creating task with data:', createTaskDto, 'for user:', userId, 'with role:', req.user.role,req.user.email); // Debugging line
    // If teacher creates, status is PENDING_APPROVAL. If admin, it can be APPROVED.
    const status = req.user.role === 'admin' ? 'APPROVED' : 'PENDING_APPROVAL';
    return this.taskService.createTask(createTaskDto, userId, status,req.user.role);
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
