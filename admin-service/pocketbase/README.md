# URL Redirect Admin Service (PocketBase)

Admin interface for managing URL redirects, built with Nuxt 4 + Vue 3 + PocketBase.

## Setup

Make sure to install dependencies:

```bash
npm install
```

## PocketBase Setup

1. Download PocketBase from [pocketbase.io](https://pocketbase.io/docs/)
2. Place the executable in this directory or update the path in package.json
3. Start PocketBase:

```bash
npm run pb:start
```

4. Initialize the schema (first time only):

```bash
npm run pb:init
```

5. Seed test data (optional, for development):

```bash
PB_ADMIN_EMAIL=admin@example.com PB_ADMIN_PASSWORD=yourpassword npm run pb:seed
```

This creates:
- Test user: `test@example.com` / `testpassword123`
- Test domain: `localhost`
- Various test links covering all redirect features

## Development Server

Start the development server on `http://localhost:3000`:

```bash
npm run dev
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
