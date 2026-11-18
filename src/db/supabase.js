import { createClient } from "@supabase/supabase-js";
import { supabaseUrl, supabasePublishableKey } from "./supabaseConfig";

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;

export async function resultado(operacao) {
  const { data, error } = await operacao;
  if (error) throw new Error(error.message);
  return data;
}

export function rpc(nome, parametros) {
  return resultado(supabase.rpc("carrev_" + nome, parametros));
}
