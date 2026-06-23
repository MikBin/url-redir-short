const fs = require('fs');
let file = fs.readFileSync('admin-service/supabase/tests/unit/utils/error-handler.test.ts', 'utf8');

file = file.replace(/errors: \[\{ message: 'zod issue' \}\] \}\);\n      \}/g, "errors: [{ message: 'zod issue' }] });");
file = file.replace(/message: 'not found' \}\);\n      \}/g, "message: 'not found' });");

fs.writeFileSync('admin-service/supabase/tests/unit/utils/error-handler.test.ts', file);
