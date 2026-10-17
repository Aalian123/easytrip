import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import {
  CreateUserInput,
  Role,
  UpdateUserInput,
  createUserSchema,
  updateUserSchema,
} from '@easytrip/shared';

const setPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
import { UsersService } from './users.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditModule } from '../../common/decorators/audit-module.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@ApiTags('users')
@AuditModule('Users')
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.users.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput) {
    return this.users.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput) {
    return this.users.update(id, body);
  }

  @Post(':id/password')
  setPassword(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(setPasswordSchema)) body: { password: string },
  ) {
    return this.users.setPassword(id, body.password);
  }
}
