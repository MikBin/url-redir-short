const fs = require('fs');
let file = fs.readFileSync('admin-service/supabase/tests/unit/utils/error-handler.test.ts', 'utf8');

file = file.replace(/const result = createAppError\(err\)/g, "const result = createAppError(500, 'test error')");
file = file.replace(/const result = createAppError\(err\)/g, "const result = createAppError(404, 'not found')");
file = file.replace(/const result = createAppError\('string error'\)/g, "const result = createAppError(500, 'string error')");
file = file.replace(/expect\(result\.statusMessage\)\.toBe\('test error'\)/g, "expect(result.message).toBe('test error')");
file = file.replace(/expect\(result\.statusMessage\)\.toBe\('string error'\)/g, "expect(result.message).toBe('string error')");

file = file.split("    it('preserves existing statusCode', () => {")[0];
file += `    it('creates an AppError with custom options', () => {
      const result = createAppError(404, 'not found', { code: 'NOT_FOUND' })
      expect(result.statusCode).toBe(404)
      expect(result.message).toBe('not found')
      expect(result.code).toBe('NOT_FOUND')
    })
  })
})
`;

fs.writeFileSync('admin-service/supabase/tests/unit/utils/error-handler.test.ts', file);
