import { Link } from '../models/link.entity';
import { RepositoryPort } from '../ports/repository.port';
import { SyncEmitterPort } from '../ports/sync.port';

export class LinkManagementService {
  constructor(
    private readonly linkRepository: RepositoryPort<Link>,
    private readonly syncEmitter: SyncEmitterPort,
  ) {}

  async createLink(shortCode: string, destination: string, status: number = 301): Promise<Link> {
    const newLink = new Link(
      Date.now().toString(), // Simple ID generation
      shortCode,
      destination,
      status
    );

    const savedLink = await this.linkRepository.create(newLink);

    this.syncEmitter.broadcast({
      type: 'LINK_UPDATE',
      payload: savedLink
    });

    return savedLink;
  }

  async getAllLinks(): Promise<Link[]> {
    return this.linkRepository.findAll();
  }
}
