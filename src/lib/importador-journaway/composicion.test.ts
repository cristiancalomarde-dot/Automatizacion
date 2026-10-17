import { describe, expect, it } from "vitest";
import { parsearComposicion, parsearInternos } from "./composicion";

// Spec M2-08 §3 #5-#7: los paquetes de San Pedro armados en orden, con su día
// y el lado del traslado, y el Overland privado (producto interno).

const ENCABEZADO = "paquete,orden,dia,componente,lado,nota\n";

describe("parsearComposicion (data/journaway-composicion.csv)", () => {
  it("lee paquete, orden, día, componente y lado (vacío = sin ajuste)", () => {
    const filas = parsearComposicion(
      `${ENCABEZADO}SPAP03,1,4,SPAE07,,Tarifario Trip C\nSPAP03,4,7,SPAT01,solo_salida,Solo el shuttle de salida\n`,
    );
    expect(filas).toEqual([
      { fila: 2, paquete: "SPAP03", orden: 1, dia: 4, componente: "SPAE07", lado: null },
      { fila: 3, paquete: "SPAP03", orden: 4, dia: 7, componente: "SPAT01", lado: "solo_salida" },
    ]);
  });

  it("lado desconocido, orden repetido o día inválido → error con la fila", () => {
    expect(() => parsearComposicion(`${ENCABEZADO}SPAP03,1,4,SPAT01,de_ida,\n`)).toThrow(/fila 2.*lado/);
    expect(() => parsearComposicion(`${ENCABEZADO}SPAP03,1,4,SPAE07,,\nSPAP03,1,5,SPAE06,,\n`)).toThrow(/fila 3.*SPAP03.*orden 1/);
    expect(() => parsearComposicion(`${ENCABEZADO}SPAP03,1,0,SPAE07,,\n`)).toThrow(/fila 2.*d[ií]a/);
  });
});

const ENCABEZADO_INTERNOS = "codigo,nombre,destino,orden,tipo,que_es,descripcion,noche_desde,noches,lugar,nota\n";

describe("parsearInternos (data/journaway-internos.csv)", () => {
  it("agrupa los servicios de cada producto interno, con sus noches", () => {
    const productos = parsearInternos(
      `${ENCABEZADO_INTERNOS}UYUO01,Overland privado,UYU,1,excursion,Overland privado,Jeep 4x4,,,,\n` +
        `UYUO01,Overland privado,UYU,2,alojamiento,Tayka del Desierto,Noche 1,1,1,Tayka del Desierto,\n`,
    );
    expect(productos).toEqual([
      {
        codigo: "UYUO01",
        nombre: "Overland privado",
        destino: "UYU",
        servicios: [
          { orden: 1, tipo: "excursion", queEs: "Overland privado", descripcion: "Jeep 4x4", noches: null },
          { orden: 2, tipo: "alojamiento", queEs: "Tayka del Desierto", descripcion: "Noche 1", noches: { nocheDesde: 1, noches: 1, lugar: "Tayka del Desierto" } },
        ],
      },
    ]);
  });

  it("un salto de línea dentro de la descripción queda igual con LF o con CRLF", () => {
    const [p] = parsearInternos(`${ENCABEZADO_INTERNOS}UYUO01,O,UYU,1,excursion,X,"Línea 1\r\nLínea 2",,,,\r\n`);
    expect(p.servicios[0].descripcion).toBe("Línea 1\nLínea 2");
  });

  it("tipo desconocido, orden repetido o noches a medias → error con la fila", () => {
    expect(() => parsearInternos(`${ENCABEZADO_INTERNOS}UYUO01,O,UYU,1,trineo,X,Y,,,,\n`)).toThrow(/fila 2.*tipo/);
    expect(() =>
      parsearInternos(`${ENCABEZADO_INTERNOS}UYUO01,O,UYU,1,excursion,X,Y,,,,\nUYUO01,O,UYU,1,bus,X,Y,,,,\n`),
    ).toThrow(/fila 3.*orden 1/);
    expect(() => parsearInternos(`${ENCABEZADO_INTERNOS}UYUO01,O,UYU,1,alojamiento,X,Y,1,,,\n`)).toThrow(/fila 2.*noches/);
  });
});
