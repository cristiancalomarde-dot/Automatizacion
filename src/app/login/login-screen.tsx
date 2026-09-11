"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { obtenerMensajeErrorLogin } from "@/lib/auth/mensajes";
import styles from "./login.module.css";

export function LoginScreen() {
  const searchParams = useSearchParams();
  const mensajeError = obtenerMensajeErrorLogin(searchParams.get("error"));

  const [ingresando, setIngresando] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  async function handleIngresar() {
    setIngresando(true);
    setErrorLocal(null);

    const supabase = createSupabaseBrowserClient();
    const dominio = process.env.NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: dominio ? { hd: dominio, prompt: "select_account" } : { prompt: "select_account" },
      },
    });

    if (error) {
      setErrorLocal("No pudimos ingresar. Probá de nuevo.");
      setIngresando(false);
    }
    // Si no hay error, el navegador se va a Google — no hace falta más estado.
  }

  const mensaje = errorLocal ?? mensajeError;

  return (
    <div className={styles.pantalla}>
      <div className={styles.tarjeta}>
        <div className={styles.marca}>
          <span className={styles.wordmark}>HI Travel</span>
          <span className={styles.separador}>·</span>
          <span className={styles.producto}>Reservas de Catálogo</span>
        </div>

        {mensaje ? (
          <p className={styles.error} role="alert">
            {mensaje}
          </p>
        ) : null}

        <button
          type="button"
          className={styles.boton}
          onClick={handleIngresar}
          disabled={ingresando}
        >
          {ingresando ? "Ingresando…" : "Ingresar con Google"}
        </button>
      </div>
    </div>
  );
}
