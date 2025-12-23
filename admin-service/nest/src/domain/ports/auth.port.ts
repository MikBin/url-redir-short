import { User } from '../models/user.entity';

export interface AuthProviderPort {
  verifyToken(token: string): Promise<User | null>;
}
