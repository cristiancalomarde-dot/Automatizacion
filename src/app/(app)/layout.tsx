import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Header } from "@/components/header";
import { NavegacionLateral } from "@/components/navegacion-lateral";
import styles from "./layout.module.css";

/**
 * Shell de la app con sesión (spec M1-01 #8 + M1-06 §4): header con el logo,
 * el usuario y "Salir"; barra lateral con las secciones (user-flow.md §2).
 * El proxy ya garantiza que no se llega acá sin sesión, pero se revalida por
 * si el request esquivó el matcher.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
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
      <div className={styles.cuerpo}>
        <NavegacionLateral />
        <main className={styles.contenido}>{children}</main>
      </div>
    </div>
  );
}
