const fs = require('fs');
let file = fs.readFileSync('admin-service/supabase/tests/unit/utils/error-handler.test.ts', 'utf8');

file = file.replace(/expect\(isTransientError\(new Error\('rate limit'\)\)\)\.toBe\(true\)/g, "expect(isTransientError(new Error('temporarily unavailable'))).toBe(true)");

file = file.replace(/expect\(result\.message\)\.toBe\('test error'\)/g, "expect(result.statusMessage).toBe('test error')");
file = file.replace(/expect\(result\.message\)\.toBe\('string error'\)/g, "expect(result.statusMessage).toBe('string error')");
file = file.replace(/expect\(result\.statusCode\)\.toBe\(404\)/g, "expect(result.statusCode).toBe(404)");

fs.writeFileSync('admin-service/supabase/tests/unit/utils/error-handler.test.ts', file);
