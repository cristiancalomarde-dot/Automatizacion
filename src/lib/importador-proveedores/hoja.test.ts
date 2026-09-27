import { describe, expect, it } from "vitest";
import { agruparProveedores, leerHojaContactos } from "./hoja";

// Copia reducida (literal) de la estructura real de la hoja "Contactos hi":
// fila-bloque de destino, encabezado (con y sin "DESTINO" en la col A),
// sub-bloques de categoría (EXCURSIONES / TRANSFER), filas de continuación
// sin nombre y un bloque con un rótulo sin letras ("<<").
const FILAS: string[][] = [
  ["Buenos Aires", "", "", "", "", ""],
  ["", "CATEGORIAS", "PROVEEDOR", "Mail/web", "Aclaraciones", "Nro para el voucher"],
  ["Hostel", "2*", "Milhouse Avenue Hostel", "melina@milhousehostel.com", "", "54 11 4383-9383"],
  ["", "", "Loi flats buenos aires ", "reservas@loisuites.com.ar", "", ""],
  [],
  ["EXCURSIONES", "", "", "", "", ""],
  ["", "", "PROVEEDOR", "Mail/web", "Aclaraciones", "Nro para el voucher"],
  ["", "", "La Bicicleta Naranja", "info@labicicletanaranja.com.ar", "bike tour", ""],
  ["TRANSFER", "", "", "", "", ""],
  ["", "", "Loi Flats Buenos Aires ", "reservasbue@loiflats.com.ar", "", ""],
  ["<<", "", "", "", "", ""],
  ["", "CATEGORIAS", "PROVEEDOR", "Mail/web", "Aclaraciones", "Nro para el voucher"],
  ["Apart Hotel", "3 *", " Sol de Piedra Apart Hotel", " ventas@soldepiedra.com.ar ", "", ""],
  ["IGUAZU", "", "", "", "", ""],
  ["", "CATEGORIAS", "PROVEEDOR", "Mail/web", "Aclaraciones", "Nro para el voucher"],
  ["Hostel", "", "Cuenca del Plata", "reservas3@cuencadelplata.com", "", ""],
  ["Hotel", "", "CUENCA DEL PLATA ", "#ERROR!", "", ""],
  ["EXCURSIONES", "", "", "", "", ""],
  ["", "", "Lago Grey", "navegacion@lagogrey.com", "", ""],
  ["", "0", "", "fiordos@lagogrey.com", "isla magdalena ", ""],
  ["PUERTO VARAS ", "", "", "", "", ""],
  ["DESTINO", "CATEGORIAS", "PROVEEDOR", "Mail/web", "Aclaraciones", "Nro para el voucher"],
  ["PUERTO VARAS ", "3*", "Casa kalfu ", "reservas@casakalfu.cl", "", ""],
  ["RENT A CAR", "", "", "", "", ""],
  ["DESTINO", "", "PROVEEDOR", "Mail/web", "Aclaraciones", "Nro para el voucher"],
  ["CAR RENTAL ", "", "Hertz ", "reservas@hertz.com.ar", "", ""],
];

describe("leerHojaContactos — recorre bloques de destino y categorías (spec M1-03 #1, #2)", () => {
  const filas = leerHojaContactos(FILAS);
  const por = (nombre: string) => filas.filter((f) => f.nombre.trim() === nombre);

  it("lee todas las filas de proveedor, sin saltear bloques ni tomar encabezados/bloques como proveedores", () => {
    expect(filas.map((f) => f.nombre.trim())).toEqual([
      "Milhouse Avenue Hostel",
      "Loi flats buenos aires",
      "La Bicicleta Naranja",
      "Loi Flats Buenos Aires",
      "Sol de Piedra Apart Hotel",
      "Cuenca del Plata",
      "CUENCA DEL PLATA",
      "Lago Grey",
      "Casa kalfu",
      "Hertz",
    ]);
  });

  it("guarda el destino del bloque (en mayúsculas, recortado) y la categoría de la columna A", () => {
    expect(por("Milhouse Avenue Hostel")[0]).toMatchObject({
      destino: "BUENOS AIRES",
      categoria: "Hostel",
      estrellas: "2*",
      filaExcel: 3,
    });
    expect(por("Cuenca del Plata")[0]).toMatchObject({ destino: "IGUAZU", categoria: "Hostel" });
  });

  it("dentro de un sub-bloque EXCURSIONES/TRANSFER, esa es la categoría y el destino no cambia", () => {
    expect(por("La Bicicleta Naranja")[0]).toMatchObject({
      destino: "BUENOS AIRES",
      categoria: "EXCURSIONES",
    });
    expect(por("Loi Flats Buenos Aires")[0]).toMatchObject({
      destino: "BUENOS AIRES",
      categoria: "TRANSFER",
    });
  });

  it("sin categoría en la columna A ni sub-bloque → categoría vacía (no se hereda de la fila de arriba)", () => {
    expect(por("Loi flats buenos aires")[0].categoria).toBeNull();
  });

  it("un rótulo de bloque sin letras ('<<') no se toma como destino: queda sin destino (no se inventa)", () => {
    expect(por("Sol de Piedra Apart Hotel")[0]).toMatchObject({
      destino: null,
      categoria: "Apart Hotel",
    });
  });

  it("encabezado con DESTINO en la col A: la col A no es categoría si repite el destino; si no, sí", () => {
    expect(por("Casa kalfu")[0]).toMatchObject({ destino: "PUERTO VARAS", categoria: null });
    expect(por("Hertz")[0]).toMatchObject({ destino: "RENT A CAR", categoria: "CAR RENTAL" });
  });

  it("una fila sin nombre pero con mail es continuación del proveedor de arriba (no se descarta ni se crea uno sin nombre)", () => {
    const lagoGrey = por("Lago Grey")[0];
    expect(lagoGrey.celdasMailWeb).toEqual(["navegacion@lagogrey.com", "fiordos@lagogrey.com"]);
    expect(lagoGrey.aclaraciones).toEqual(["isla magdalena"]);
    expect(lagoGrey.estrellas).toBeNull();
  });
});

describe("agruparProveedores — un registro por nombre normalizado + destino (spec M1-03 #3)", () => {
  const grupos = agruparProveedores(leerHojaContactos(FILAS));

  it("'Cuenca del Plata' y 'CUENCA DEL PLATA ' en el mismo destino → un solo proveedor", () => {
    const cuenca = grupos.filter((g) => g.nombreNormalizado === "cuenca del plata");
    expect(cuenca).toHaveLength(1);
    expect(cuenca[0]).toMatchObject({
      destino: "IGUAZU",
      nombre: "Cuenca del Plata",
      categorias: ["Hostel", "Hotel"],
      celdasMailWeb: ["reservas3@cuencadelplata.com", "#ERROR!"],
    });
  });

  it("el mismo nombre en bloques de categoría distintos del mismo destino también se unifica", () => {
    const loi = grupos.filter((g) => g.nombreNormalizado === "loi flats buenos aires");
    expect(loi).toHaveLength(1);
    expect(loi[0].categorias).toEqual(["TRANSFER"]);
    expect(loi[0].celdasMailWeb).toEqual(["reservas@loisuites.com.ar", "reservasbue@loiflats.com.ar"]);
  });

  it("cantidad total de proveedores únicos", () => {
    expect(grupos).toHaveLength(8);
  });
});
