import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import styles from "./page.module.css";

/**
 * Shell post-login (spec M1-01 #8): header con wordmark, nombre del usuario y
 * botón "Salir"; el área de contenido queda vacía a la espera del catálogo
 * (M1-02 en adelante). El middleware ya garantiza que no se llega acá sin
 * sesión, pero se revalida por si el request esquivó el matcher.
 */
export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=sesion_vencida");
  }

  const nombreVisible =
    (typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null) ??
    user.email ??
    "";

  return (
    <div className={styles.shell}>
      <Header nombreVisible={nombreVisible} />
      <main className={styles.contenido} />
    </div>
  );
}
