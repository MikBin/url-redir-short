export class Link {
  constructor(
    public readonly id: string,
    public readonly shortCode: string,
    public readonly destination: string,
    public readonly status: number = 301,
    public readonly tags: string[] = [],
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date(),
  ) {}
}
