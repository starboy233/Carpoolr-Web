import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtpchpzkgbtkxwxxbykq.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10cGNocHprZ2J0a3h3eHhieWtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzE2MTUsImV4cCI6MjA5MDQ0NzYxNX0.uVE1XcSpZ-Ro8U95XaUK1neuaQZFqtAXiSpTZut69os';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export default supabase;
