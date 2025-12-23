import { RepositoryPort } from '../../../../domain/ports/repository.port';
import { Link } from '../../../../domain/models/link.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PocketBaseAdapter implements RepositoryPort<Link> {
  // TODO: Inject PocketBase Client

  async create(entity: Link): Promise<Link> {
    // TODO: Implement PocketBase insert
    console.log('PocketBaseAdapter: create', entity);
    return entity;
  }

  async findById(id: string): Promise<Link | null> {
    // TODO: Implement PocketBase select
    console.log('PocketBaseAdapter: findById', id);
    return null;
  }

  async findAll(): Promise<Link[]> {
    // TODO: Implement PocketBase select *
    console.log('PocketBaseAdapter: findAll');
    return [];
  }

  async update(id: string, entity: Partial<Link>): Promise<Link> {
    // TODO: Implement PocketBase update
    console.log('PocketBaseAdapter: update', id, entity);
    return new Link(id, 'mock', 'http://mock', 301);
  }

  async delete(id: string): Promise<boolean> {
    // TODO: Implement PocketBase delete
    console.log('PocketBaseAdapter: delete', id);
    return true;
  }
}
