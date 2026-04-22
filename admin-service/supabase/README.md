# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Database Migrations

This project uses the Supabase CLI for database migrations. The original `schema.sql` file remains as a reference, but all schema changes must be applied via incremental migrations.

A helper script is provided at `scripts/migration.sh` (run from the project root) to simplify this process:

```bash
# Create a new migration file
./scripts/migration.sh new my_migration_name
```

Please refer to `docs/development/migrations.md` in the project root for detailed information on the migration workflow, rollback strategies, and deployment processes.
