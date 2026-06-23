const fs = require('fs');
let file = fs.readFileSync('admin-service/supabase/tests/unit/api/analytics/collect.test.ts', 'utf8');

// The test starts with: it('DELETED', async () => { ... })
// Let's remove the DELETED test
file = file.replace(/it\('DELETED', async \(\) => {[\s\S]*?}\)\nEOF/g, ""); // wait, I will just trim it
fs.writeFileSync('admin-service/supabase/tests/unit/api/analytics/collect.test.ts', file);
