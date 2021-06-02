import { User } from './../database/user.entity';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
export const CurrentUid = createParamDecorator(async (data: null, context: ExecutionContext) => {

  const req = context.switchToHttp().getRequest();
  req.userId = (req.user as User).id;
})