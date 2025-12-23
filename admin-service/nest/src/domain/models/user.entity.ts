export class User {
  constructor(
    public readonly id: string,
    public readonly email: string,
    public readonly role: 'admin' | 'editor' | 'viewer',
  ) {}
}
