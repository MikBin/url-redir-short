import { Controller, Get, Post, Body, Sse } from '@nestjs/common';
import { LinkManagementService } from '../../../domain/services/link-management.service';
import { CreateLinkDto } from './link.dto';
import { SseSyncAdapter } from '../../outbound/sync/sse.adapter';
import { map } from 'rxjs/operators';
import { MessageEvent } from '@nestjs/common';

@Controller('links')
export class LinkController {
  constructor(
    private readonly linkService: LinkManagementService,
    private readonly sseAdapter: SseSyncAdapter
  ) {}

  @Post()
  async create(@Body() createLinkDto: CreateLinkDto) {
    return this.linkService.createLink(
      createLinkDto.shortCode,
      createLinkDto.destination,
      createLinkDto.status
    );
  }

  @Get()
  async findAll() {
    return this.linkService.getAllLinks();
  }

  @Sse('stream')
  sse() {
    return this.sseAdapter.getEventStream().pipe(
      map((data): MessageEvent => ({ data }))
    );
  }
}
