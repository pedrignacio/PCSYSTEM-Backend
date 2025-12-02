const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY no está definido. La gestión de usuarios no funcionará correctamente.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || 'placeholder');

module.exports = supabaseAdmin;
