const fs = require('fs');
let file = fs.readFileSync('admin-service/supabase/tests/unit/utils/error-handler.test.ts', 'utf8');

file = file.replace(/const zodError = \{/g, "const zodError = new Error('validation'); Object.assign(zodError, {");
file = file.replace(/const error = \{/g, "const error = new Error('not found'); Object.assign(error, {");

fs.writeFileSync('admin-service/supabase/tests/unit/utils/error-handler.test.ts', file);
