import { Module } from '@nestjs/common';
import { LinkController } from './adapters/inbound/rest/link.controller';
import { LinkManagementService } from './domain/services/link-management.service';
import { SupabaseAdapter } from './adapters/outbound/persistence/supabase/supabase.adapter';
import { SseSyncAdapter } from './adapters/outbound/sync/sse.adapter';
import { SupabaseAuthAdapter } from './adapters/outbound/auth/supabase-auth.adapter';

@Module({
  imports: [],
  controllers: [LinkController],
  providers: [
    LinkManagementService,
    SseSyncAdapter,
    SupabaseAuthAdapter,
    SupabaseAdapter,
    // Dependency Injection Wiring: Bind Abstract Ports to Concrete Adapters
    {
      provide: 'RepositoryPort', // In a real app, use a Symbol or Class reference if possible, or string token
      useClass: SupabaseAdapter, // Defaulting to Supabase for now
    },
    {
      provide: LinkManagementService,
      useFactory: (repo, sync) => new LinkManagementService(repo, sync),
      inject: ['RepositoryPort', SseSyncAdapter]
    }
  ],
})
export class AppModule {}
