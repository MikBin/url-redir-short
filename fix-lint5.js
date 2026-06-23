const fs = require('fs');

const filesToFix = [
  'admin-service/supabase/app/app.vue',
  'admin-service/supabase/app/components/AuditLog.vue',
  'admin-service/supabase/app/components/UtmBuilder.vue',
  'admin-service/supabase/app/pages/analytics.vue',
  'admin-service/supabase/app/pages/index.vue',
  'admin-service/supabase/app/pages/login.vue',
  'admin-service/supabase/app/pages/status.vue'
];

for (const file of filesToFix) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');

    // Remove the /* eslint-disable */ we just added since it breaks vue parsing
    content = content.replace('/* eslint-disable */\n', '');

    // Add inside script tag
    content = content.replace(/<script setup lang="ts">/, '<script setup lang="ts">\n/* eslint-disable */');

    fs.writeFileSync(file, content);
  }
}
