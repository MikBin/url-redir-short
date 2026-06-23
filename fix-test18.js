const fs = require('fs');
let file = fs.readFileSync('admin-service/supabase/tests/unit/api/links/history.test.ts', 'utf8');

file = file.replace(/const mockSelect2 = vi\.fn\(\(\) => \(\{ eq: mockEqSelect2 \}\)\);/g, "const mockEqSelect2 = vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => ({ range: mockRange })) })) })); const mockSelect2 = vi.fn(() => ({ eq: mockEqSelect2 }));");

fs.writeFileSync('admin-service/supabase/tests/unit/api/links/history.test.ts', file);
