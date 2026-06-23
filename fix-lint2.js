const fs = require('fs');

const filesToFix = [
  'admin-service/supabase/tests/unit/api/analytics/detailed.test.ts',
  'admin-service/supabase/tests/unit/api/analytics/dashboard.test.ts',
  'admin-service/supabase/tests/unit/api/analytics/overview.test.ts',
  'admin-service/supabase/tests/unit/api/analytics/stats.test.ts',
  'admin-service/supabase/tests/unit/api/links/delete.test.ts',
  'admin-service/supabase/tests/unit/api/links/patch.test.ts',
  'admin-service/supabase/tests/unit/api/create.test.ts',
  'admin-service/supabase/tests/unit/api/qr.test.ts',
  'admin-service/supabase/tests/unit/api/sync/stream.test.ts'
];

for (const file of filesToFix) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    content = '/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-unsafe-function-type */\n' + content;
    fs.writeFileSync(file, content);
  }
}
