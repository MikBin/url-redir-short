import { AuthProviderPort } from '../../../domain/ports/auth.port';
import { User } from '../../../domain/models/user.entity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SupabaseAuthAdapter implements AuthProviderPort {
  async verifyToken(token: string): Promise<User | null> {
    // TODO: Verify token with Supabase Auth
    console.log('SupabaseAuthAdapter: verifyToken');
    return new User('1', 'admin@example.com', 'admin');
  }
}
