const fs = require('fs');
let file = fs.readFileSync('admin-service/supabase/tests/unit/api/links/history.test.ts', 'utf8');

file = file.replace(/const mockEqSelect2 = vi\.fn\(\(\) => \(\{ order: vi\.fn\(\(\) => \(\{ eq: vi\.fn\(\(\) => \(\{ range: mockRange \}\)\) \}\)\) \}\)\);/g, "const mockEqAction = vi.fn(() => ({ range: mockRange })); const mockOrder = vi.fn(() => ({ eq: mockEqAction, range: mockRange })); const mockEqSelect2 = vi.fn(() => ({ order: mockOrder }));");

fs.writeFileSync('admin-service/supabase/tests/unit/api/links/history.test.ts', file);
