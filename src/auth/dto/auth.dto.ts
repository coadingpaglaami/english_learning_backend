import { User, Role } from 'src/database/prisma-client/client';

export type SignUpDtoRequestDto = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: Role;

  // student only
  username?: string;

  // teacher only
  subject?: string;
  institution?: string;
  bio?: string;
};

export type LoginRequestDto = Pick<User, 'email' | 'password'>;

export type ForgetPasswordRequestDto = Pick<User, 'email'>;

export type ResetPasswordRequestDto = {
  password: string;
  confirmPassword: string;
  token: string;
};

export type UserResponseDto = Pick<
  User,
  | 'id'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'role'
  | 'createdAt'
  | 'updatedAt'
>;