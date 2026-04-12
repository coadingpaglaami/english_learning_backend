// guard.module.ts
import { Module } from "@nestjs/common";
import { GoogleRoleGuard } from "./google-role.guard";

@Module({
  providers: [GoogleRoleGuard],
  exports: [GoogleRoleGuard], // Export it so AuthModule can see it
})
export class GuardModule {}