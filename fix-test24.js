const fs = require('fs');
let file = fs.readFileSync('admin-service/supabase/tests/unit/utils/error-handler.test.ts', 'utf8');

file = file.replace(/logger: \{ info: vi\.fn\(\), error: vi\.fn\(\), warn: vi\.fn\(\), debug: vi\.fn\(\) \}, generateCorrelationId: vi\.fn\(\)\.mockReturnValue\('123'\)/g, "logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }, generateCorrelationId: vi.fn().mockReturnValue('123'), createLogger: vi.fn().mockReturnValue({})");

fs.writeFileSync('admin-service/supabase/tests/unit/utils/error-handler.test.ts', file);
