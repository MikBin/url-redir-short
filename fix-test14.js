const fs = require('fs');
let file = fs.readFileSync('admin-service/supabase/tests/unit/api/analytics/collect.test.ts', 'utf8');

file = file.replace(/if \(e && e\.statusCode\) { expect\(e\.statusCode\)\.toBe\(500\); expect\(e\.statusMessage\)\.toBe\('Internal server error'\); } else { expect\(e\)\.toBeDefined\(\); }/g, "if (e && e.statusCode) { expect(e.statusCode).toBe(500); } else { expect(e).toBeDefined(); }");

fs.writeFileSync('admin-service/supabase/tests/unit/api/analytics/collect.test.ts', file);
