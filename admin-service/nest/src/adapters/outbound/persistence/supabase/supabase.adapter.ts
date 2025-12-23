import { RepositoryPort } from '../../../../domain/ports/repository.port';
import { Link } from '../../../../domain/models/link.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SupabaseAdapter implements RepositoryPort<Link> {
  // TODO: Inject Supabase Client

  async create(entity: Link): Promise<Link> {
    // TODO: Implement Supabase insert
    console.log('SupabaseAdapter: create', entity);
    return entity;
  }

  async findById(id: string): Promise<Link | null> {
    // TODO: Implement Supabase select
    console.log('SupabaseAdapter: findById', id);
    return null;
  }

  async findAll(): Promise<Link[]> {
     // TODO: Implement Supabase select *
     console.log('SupabaseAdapter: findAll');
     return [];
  }

  async update(id: string, entity: Partial<Link>): Promise<Link> {
    // TODO: Implement Supabase update
    console.log('SupabaseAdapter: update', id, entity);
    return new Link(id, 'mock', 'http://mock', 301);
  }

  async delete(id: string): Promise<boolean> {
    // TODO: Implement Supabase delete
    console.log('SupabaseAdapter: delete', id);
    return true;
  }
}
