/**
 * Supabase Service Definition
 * Phase 21: Service Integration Framework
 * 
 * Supabase provides:
 * - PostgreSQL Database
 * - Authentication (Email, OAuth, Magic Links)
 * - Storage (File uploads)
 * - Realtime subscriptions
 * - Edge Functions
 */

import { ServiceDefinition, ServiceCategory } from '../types.js';

export const supabaseService: ServiceDefinition = {
    id: 'supabase',
    name: 'Supabase',
    category: ServiceCategory.DATABASE,
    description: 'Open source Firebase alternative with PostgreSQL, Auth, Storage, and Realtime',
    documentation: 'https://supabase.com/docs',
    website: 'https://supabase.com',
    logo: 'supabase',
    hasFreeTier: true,
    pricingUrl: 'https://supabase.com/pricing',

    credentials: [
        {
            key: 'url',
            label: 'Project URL',
            type: 'connection_string',
            required: true,
            sensitive: false,
            placeholder: 'https://xxxx.supabase.co',
            description: 'Found in Project Settings → API → Project URL',
            validation: '^https:\\/\\/[a-z0-9]+\\.supabase\\.co$'
        },
        {
            key: 'anonKey',
            label: 'Anon/Public Key',
            type: 'api_key',
            required: true,
            sensitive: true,
            placeholder: 'eyJhbGciOiJIUzI1...',
            description: 'Found in Project Settings → API → anon/public key'
        },
        {
            key: 'serviceRoleKey',
            label: 'Service Role Key (Optional)',
            type: 'api_key',
            required: false,
            sensitive: true,
            placeholder: 'eyJhbGciOiJIUzI1...',
            description: 'For server-side operations that bypass RLS. Keep this secret!'
        }
    ],

    capabilities: [
        'PostgreSQL database',
        'Row Level Security (RLS)',
        'User authentication',
        'OAuth providers (Google, GitHub, etc.)',
        'Magic link authentication',
        'File storage',
        'Realtime subscriptions',
        'Edge functions',
        'Database migrations',
        'Auto-generated APIs'
    ],

    tags: ['database', 'postgres', 'auth', 'storage', 'realtime', 'backend-as-a-service', 'baas'],

    agentInstructions: `
When using Supabase:

1. **Client Setup**:
   \`\`\`typescript
   import { createClient } from '@supabase/supabase-js';
   
   const supabase = createClient(
     process.env.SUPABASE_URL!,
     process.env.SUPABASE_ANON_KEY!
   );
   \`\`\`

2. **Database Operations**:
   - Use \`.from('table').select()\` for queries
   - Use \`.from('table').insert()\` for inserts
   - Use \`.from('table').update()\` for updates
   - Use \`.from('table').delete()\` for deletes
   - Always chain \`.select()\` after insert/update to get the result

3. **Error Handling**:
   - Always destructure { data, error } from responses
   - Check error before using data
   - Throw or handle errors appropriately

4. **Authentication**:
   - \`supabase.auth.signUp()\` for registration
   - \`supabase.auth.signInWithPassword()\` for login
   - \`supabase.auth.signOut()\` for logout
   - \`supabase.auth.getUser()\` for current user

5. **Storage**:
   - \`supabase.storage.from('bucket').upload()\` for uploads
   - \`supabase.storage.from('bucket').getPublicUrl()\` for URLs

6. **Security**:
   - Enable Row Level Security (RLS) on all tables
   - Use service role key only on server-side, never expose to client
   - Validate all user input before database operations
  `.trim(),

    codeTemplates: {
        'client-setup': {
            name: 'Client Setup',
            description: 'Initialize Supabase client',
            language: 'typescript',
            requiredPackages: ['@supabase/supabase-js'],
            envVars: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
            code: `import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export { supabase };`
        },

        'select': {
            name: 'Select Query',
            description: 'Query data from a table',
            language: 'typescript',
            requiredPackages: ['@supabase/supabase-js'],
            code: `const { data, error } = await supabase
  .from('{{tableName}}')
  .select('{{columns}}')
  {{#if filter}}.eq('{{filter.column}}', {{filter.value}}){{/if}}
  {{#if limit}}.limit({{limit}}){{/if}};

if (error) throw new Error(error.message);
return data;`
        },

        'insert': {
            name: 'Insert Record',
            description: 'Insert a new record into a table',
            language: 'typescript',
            requiredPackages: ['@supabase/supabase-js'],
            code: `const { data, error } = await supabase
  .from('{{tableName}}')
  .insert({{record}})
  .select();

if (error) throw new Error(error.message);
return data;`
        },

        'update': {
            name: 'Update Record',
            description: 'Update existing records',
            language: 'typescript',
            requiredPackages: ['@supabase/supabase-js'],
            code: `const { data, error } = await supabase
  .from('{{tableName}}')
  .update({{updates}})
  .eq('{{filterColumn}}', {{filterValue}})
  .select();

if (error) throw new Error(error.message);
return data;`
        },

        'delete': {
            name: 'Delete Record',
            description: 'Delete records from a table',
            language: 'typescript',
            requiredPackages: ['@supabase/supabase-js'],
            code: `const { error } = await supabase
  .from('{{tableName}}')
  .delete()
  .eq('{{filterColumn}}', {{filterValue}});

if (error) throw new Error(error.message);`
        },

        'auth-signup': {
            name: 'User Signup',
            description: 'Register a new user',
            language: 'typescript',
            requiredPackages: ['@supabase/supabase-js'],
            code: `const { data, error } = await supabase.auth.signUp({
  email: '{{email}}',
  password: '{{password}}',
  options: {
    data: {
      // Custom user metadata
      name: '{{name}}'
    }
  }
});

if (error) throw new Error(error.message);
return data.user;`
        },

        'auth-signin': {
            name: 'User Sign In',
            description: 'Sign in an existing user',
            language: 'typescript',
            requiredPackages: ['@supabase/supabase-js'],
            code: `const { data, error } = await supabase.auth.signInWithPassword({
  email: '{{email}}',
  password: '{{password}}'
});

if (error) throw new Error(error.message);
return { user: data.user, session: data.session };`
        },

        'storage-upload': {
            name: 'Upload File',
            description: 'Upload a file to Supabase Storage',
            language: 'typescript',
            requiredPackages: ['@supabase/supabase-js'],
            code: `const { data, error } = await supabase.storage
  .from('{{bucket}}')
  .upload('{{path}}', file, {
    cacheControl: '3600',
    upsert: false
  });

if (error) throw new Error(error.message);

// Get public URL
const { data: { publicUrl } } = supabase.storage
  .from('{{bucket}}')
  .getPublicUrl(data.path);

return { path: data.path, publicUrl };`
        },

        'realtime-subscribe': {
            name: 'Realtime Subscription',
            description: 'Subscribe to realtime changes',
            language: 'typescript',
            requiredPackages: ['@supabase/supabase-js'],
            code: `const channel = supabase
  .channel('{{channelName}}')
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: '{{tableName}}' },
    (payload) => {
      console.log('Change received:', payload);
      // Handle the change
    }
  )
  .subscribe();

// To unsubscribe later:
// supabase.removeChannel(channel);`
        }
    }
};
