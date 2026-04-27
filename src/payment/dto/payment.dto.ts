
import { IsString, IsNotEmpty, IsIn } from 'class-validator';
 // Optional: for Swagger documentation

export class CreateCheckoutSessionDto {
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @IsIn(['MONTHLY', 'ANNUAL'])
  @IsNotEmpty()
  billingCycle!: 'MONTHLY' | 'ANNUAL';
}