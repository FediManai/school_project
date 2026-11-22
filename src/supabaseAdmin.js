const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être configurées côté serveur');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function execute(query, context) {
  const { data, error } = await query;
  if (error) {
    const failure = new Error(error.message);
    failure.name = 'SupabaseError';
    failure.code = error.code;
    failure.details = error.details;
    failure.hint = error.hint;
    failure.context = context;
    throw failure;
  }
  return data;
}

async function fetchAll(table, columns = '*', configure = (query) => query) {
  const rows = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const page = await execute(
      configure(supabaseAdmin.from(table).select(columns))
        .range(offset, offset + pageSize - 1),
      `Lecture de ${table}`
    );
    rows.push(...page);
    if (page.length < pageSize) return rows;
    offset += pageSize;
  }
}

module.exports = { supabaseAdmin, execute, fetchAll };
