import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { AuditModule } from '../../common/decorators/audit-module.decorator';
import { AuthenticatedUser, CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('search')
@AuditModule('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  find(@Query('q') q = '', @CurrentUser() user: AuthenticatedUser) {
    return this.search.search(q, user);
  }
}
