import { Module } from '@nestjs/common';
import { AttemptService } from './attempt.service';
import { AttemptController } from './attempt.controller';
import { GuardModule } from 'src/guards/guard.module';
import { PrismaModule } from 'src/database/prisma.module';

@Module({
  imports: [GuardModule, PrismaModule],
  controllers: [AttemptController],
  providers: [AttemptService],
})
export class AttemptModule {}
