import { Module } from '@nestjs/common';
import { DeletionsController } from './deletions.controller';
import { DeletionsService } from './deletions.service';

@Module({
  controllers: [DeletionsController],
  providers: [DeletionsService],
})
export class DeletionsModule {}
