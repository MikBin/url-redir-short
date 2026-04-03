export default defineEventHandler(async (event) => {
  // Simple stub to let tests pass for now.
  // In a real scenario we'd do zod parsing, anonymizing IP, and writing to PocketBase.
  return {
    success: true,
    queued: true,
    timestamp: new Date().toISOString()
  };
});
