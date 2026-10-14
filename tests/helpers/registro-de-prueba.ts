import type { SupabaseClient } from "@supabase/supabase-js";
import { borrarDatosDePruebaDe } from "@/lib/reservas/guardar";

/**
 * Lo que creó un archivo de test en la base, para borrar SOLO eso al final.
 *
 * Los tests no usan `borrarDatosDePrueba()` (borra todo lo "de prueba", también
 * las reservas del modo prueba que revisa el owner, M2-06). Anotan los mails
 * que crean (toda reserva cuelga de un mail) y las llamadas a la IA sueltas, y
 * `limpiar` borra eso y lo que cuelga de ahí (migración 0013).
 */
export interface RegistroDePrueba {
  /** Anota un mail creado por el test (y con él, sus reservas y llamadas). */
  mail(id: string | null | undefined): void;
  /** Anota una llamada a la IA que no cuelga de ningún mail del test. */
  llamada(id: string | null | undefined): void;
  /**
   * Envuelve guardarMailRecibido para anotar el mail. Solo si lo creó esta
   * llamada (`nuevo`): un mail que ya estaba (el mismo de otro test o del modo
   * prueba) no es de este test y no se anota.
   */
  conMail<A extends unknown[], R extends { mail: { id: string }; nuevo?: boolean }>(
    f: (...a: A) => Promise<R>,
  ): (...a: A) => Promise<R>;
  /** Igual, para procesarMail/procesarMails: un mail "ya_procesado" no se anota. */
  conMailRecibido<
    A extends unknown[],
    R extends { mailRecibidoId: string; estado?: string } | Array<{ mailRecibidoId: string; estado?: string }>,
  >(
    f: (...a: A) => Promise<R>,
  ): (...a: A) => Promise<R>;
  readonly mails: readonly string[];
  /** Borra lo anotado (solo lo marcado de prueba) y vacía el registro. */
  limpiar(admin: SupabaseClient): Promise<{ archivosBorrados: number }>;
}

export function crearRegistroDePrueba(): RegistroDePrueba {
  const mails = new Set<string>();
  const llamadas = new Set<string>();
  const registro: RegistroDePrueba = {
    mail(id) {
      if (id) mails.add(id);
    },
    llamada(id) {
      if (id) llamadas.add(id);
    },
    conMail(f) {
      return async (...a) => {
        const r = await f(...a);
        if (r.nuevo !== false) registro.mail(r.mail.id);
        return r;
      };
    },
    conMailRecibido(f) {
      return async (...a) => {
        const r = await f(...a);
        for (const x of Array.isArray(r) ? r : [r]) if (x.estado !== "ya_procesado") registro.mail(x.mailRecibidoId);
        return r;
      };
    },
    get mails() {
      return [...mails];
    },
    async limpiar(admin) {
      const resultado = await borrarDatosDePruebaDe({ mails: [...mails], llamadas: [...llamadas] }, admin);
      mails.clear();
      llamadas.clear();
      return resultado;
    },
  };
  return registro;
}
