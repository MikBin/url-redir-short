export class LazyLanguageContext {
  private header: string | null;
  private languages?: string[];

  constructor(header: string | null) {
    this.header = header;
  }

  get(): string[] {
    if (!this.languages) {
      if (!this.header) {
        this.languages = [];
      } else {
        this.languages = this.header.toLowerCase().split(',').map((l) => l.split(';')[0].trim());
      }
    }
    return this.languages;
  }
}
