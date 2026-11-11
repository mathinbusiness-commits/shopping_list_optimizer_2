import { createClient } from "@supabase/supabase-js";

// Cliente de Supabase para el navegador. Usa SOLO la publishable key (pública por diseño;
// la seguridad la dan las políticas RLS). La sesión se guarda en localStorage, por eso
// se mantiene al recargar la página.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export const supabaseConfigured = Boolean(url && publishableKey);

export const supabase = supabaseConfigured ? createClient(url, publishableKey) : null;
