# System Verification E2E Tests

This suite verifies the full end-to-end flow of the Redirector System, including:
1.  **Admin Service**: UI, API, and Database interactions.
2.  **Redirector Engine**: Routing, filtering, and redirection.
3.  **Sync Protocol**: Real-time updates from Admin to Engine.
4.  **Analytics**: Data flow from Engine back to Admin.

## Prerequisites

To run these tests successfully, you need:

1.  **Local Supabase Instance**:
    The Admin Service requires a connection to a Supabase database.
    You must have Supabase running locally or accessible via network.

    ```bash
    npx supabase start
    ```

2.  **Environment Configuration**:
    Configure the environment variables in `system-e2e/.env` (or pass them via shell):

    ```bash
    export SUPABASE_URL="http://127.0.0.1:54321"
    export SUPABASE_KEY="your-anon-key"
    export SUPABASE_SERVICE_KEY="your-service-key"
    ```

## Running the Tests

1.  Install dependencies:
    ```bash
    cd system-e2e
    npm install
    ```

2.  Run the tests:
    ```bash
    npm test
    ```

    This command will:
    - Start the Admin Service (port 3001)
    - Start the Redirector Engine (port 3002)
    - Run the Playwright suite

## Troubleshooting

- **Admin Service Fails to Start**: Check `SUPABASE_URL` connection.
- **Engine Fails to Sync**: Ensure `SYNC_API_KEY` matches between services (handled automatically by `scripts/start-services.ts`).
- **Tests Fail on Login**: The tests currently skip full lifecycle if login is required but credentials are not provided. You may need to seed a test user.
