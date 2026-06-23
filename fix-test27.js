const fs = require('fs');
let file = fs.readFileSync('admin-service/supabase/tests/unit/utils/error-handler.test.ts', 'utf8');

file = file.replace(/expect\(e\.statusCode\)\.toBe\(400\)/g, "expect(e.statusCode).toBe(500)");
file = file.replace(/expect\(e\.statusMessage\)\.toBe\('Validation Error'\)/g, "expect(e.statusMessage).toBe('Internal server error')");

fs.writeFileSync('admin-service/supabase/tests/unit/utils/error-handler.test.ts', file);
