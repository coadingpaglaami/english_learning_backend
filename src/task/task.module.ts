import { Module } from '@nestjs/common';
import { TaskService } from './task.service';
import { TaskController } from './task.controller';
import { PrismaModule } from 'src/database/prisma.module';
import { AuthModule } from 'src/auth/auth.module';
import { GuardModule } from 'src/guards/guard.module';

@Module({
  imports: [PrismaModule, AuthModule, GuardModule],
  controllers: [TaskController],
  providers: [TaskService],
})
export class TaskModule {}
