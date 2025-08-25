/* supabase.js
   Lightweight client factory for browser pages using the Supabase JS v2 CDN.
   - Plug your credentials below.
   - Usage (after loading the Supabase CDN script):
       const sb = getSupabase();
   - NOTE: For production deployment, credentials will be moved to server-side
*/
(function initSupabaseFactory() {
    // Supabase credentials - moved to server-side for security
    // Frontend no longer needs direct database access
    var SUPABASE_URL = null;
    var SUPABASE_ANON_KEY = null;

    function ensureCdnLoaded() {
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
            console.error('Supabase CDN not loaded. Include https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2 before supabase.js');
            return false;
        }
        return true;
    }

    window.getSupabase = function getSupabase() {
        // Frontend no longer needs direct Supabase access
        // All database operations are now handled through the backend API
        console.warn('[Supabase] Direct database access disabled for security. Use API endpoints instead.');
        return null;
    };
})();
