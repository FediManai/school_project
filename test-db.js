require('dotenv/config');
const { supabaseAdmin, execute } = require('./src/supabaseAdmin');

async function main() {
  try {
    await execute(
      supabaseAdmin.from('School').select('id').limit(1),
      'Test de connexion Supabase'
    );
    console.log('Connexion Supabase réussie.');
  } catch (error) {
    console.error('Échec du test Supabase :', error.message);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Échec du test Supabase :', error.message);
  process.exitCode = 1;
});
