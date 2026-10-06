"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { TEXTOS } from "@/lib/textos";
import { Logo } from "./logo";
import styles from "./header.module.css";

export function Header({ nombreVisible }: { nombreVisible: string }) {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  async function handleSalir() {
    setSaliendo(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className={styles.header}>
      <div className={styles.marca}>
        <Logo alto={30} />
        <span className={styles.separador} aria-hidden="true" />
        <span className={styles.producto}>{TEXTOS.app.producto}</span>
      </div>

      <div className={styles.usuario}>
        <span className={styles.nombre}>{nombreVisible}</span>
        <button type="button" className={styles.salir} onClick={handleSalir} disabled={saliendo}>
          {saliendo ? "Saliendo…" : "Salir"}
        </button>
      </div>
    </header>
  );
}
