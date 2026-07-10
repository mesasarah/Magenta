import { supabase } from "@/integrations/supabase/client";

export async function getSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("media").createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? "Could not sign URL");
  return data.signedUrl;
}
