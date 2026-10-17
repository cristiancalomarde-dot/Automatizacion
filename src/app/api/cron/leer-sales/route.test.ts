// @vitest-environment node
// Spec M2-07 #5 y #21: la ruta del cron rechaza sin CRON_SECRET y respeta el interruptor.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const correrLectura = vi.fn();
const registrarApagada = vi.fn();
vi.mock("@/lib/lectura-sales/produccion", () => ({ correrLectura, registrarApagada }));

const { GET } = await import("./route");

const pedido = (auth?: string) =>
  new Request("http://localhost/api/cron/leer-sales", { headers: auth === undefined ? {} : { authorization: auth } });

const SECRETO = "s".repeat(40);

describe("GET /api/cron/leer-sales", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", SECRETO);
    vi.stubEnv("LECTURA_SALES_ACTIVA", "si");
    correrLectura.mockResolvedValue({ estado: "anduvo_bien", miro: 3, de_agencias: 1, procesados: 1, reservas_nuevas: 1, reservas_actualizadas: 0 });
    registrarApagada.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("#5: sin el encabezado, 401 y no se conecta ni registra nada", async () => {
    expect((await GET(pedido())).status).toBe(401);
    expect(correrLectura).not.toHaveBeenCalled();
    expect(registrarApagada).not.toHaveBeenCalled();
  });

  it("#5: con un secreto equivocado (también de otro largo), 401", async () => {
    expect((await GET(pedido(`Bearer ${"x".repeat(40)}`))).status).toBe(401);
    expect((await GET(pedido("Bearer corto"))).status).toBe(401);
    expect((await GET(pedido(SECRETO))).status).toBe(401);
    expect(correrLectura).not.toHaveBeenCalled();
  });

  it("#5: si CRON_SECRET no está cargado en el servidor, 401 aunque manden 'Bearer '", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(pedido("Bearer "))).status).toBe(401);
    expect((await GET(pedido("Bearer undefined"))).status).toBe(401);
    expect(correrLectura).not.toHaveBeenCalled();
    expect(registrarApagada).not.toHaveBeenCalled();
  });

  it("#5: con el secreto correcto, 200 y corre (origen cron); la respuesta lleva solo números", async () => {
    const r = await GET(pedido(`Bearer ${SECRETO}`));
    expect(r.status).toBe(200);
    expect(correrLectura).toHaveBeenCalledWith("cron");
    expect(await r.json()).toEqual({ estado: "anduvo_bien", miro: 3, de_agencias: 1, procesados: 1, reservas_nuevas: 1, reservas_actualizadas: 0 });
  });

  it("#21: sin LECTURA_SALES_ACTIVA=si no se conecta y registra 'apagada'", async () => {
    vi.stubEnv("LECTURA_SALES_ACTIVA", "");
    const r = await GET(pedido(`Bearer ${SECRETO}`));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ estado: "apagada" });
    expect(correrLectura).not.toHaveBeenCalled();
    expect(registrarApagada).toHaveBeenCalledWith("cron");
  });

  it("corre en Node y con un tiempo máximo explícito", async () => {
    const mod = await import("./route");
    expect(mod.runtime).toBe("nodejs");
    expect(mod.maxDuration).toBe(300);
  });
});
