const fs = require('fs');
let file = fs.readFileSync('admin-service/supabase/tests/unit/api/links/history.test.ts', 'utf8');

file = file.replace(/const mockEqAction = vi\.fn\(\(\) => \(\{ range: mockRange \}\)\); const mockOrder = vi\.fn\(\(\) => \(\{ eq: mockEqAction, range: mockRange \}\)\); const mockEqSelect2 = vi\.fn\(\(\) => \(\{ order: mockOrder \}\)\);/g, "");

// Remove the whole extra block we just appended by accident, we'll write it clean
const marker = "  it('filters by action query parameter correctly', async () => {";
if (file.split(marker).length > 2) {
    file = file.substring(0, file.lastIndexOf(marker));
}

fs.writeFileSync('admin-service/supabase/tests/unit/api/links/history.test.ts', file);
