import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './database/prisma.module';
import { MailModule } from './mail/mail.module';
import { GuardModule } from './guards/guard.module';
import { TaskModule } from './task/task.module';
import { UploadModule } from './upload/upload.module';
import { ClassModule } from './class/class.module';

@Module({
  imports: [ConfigModule.forRoot({
    isGlobal: true,
  }), AuthModule,PrismaModule, MailModule,GuardModule, TaskModule, UploadModule, ClassModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
