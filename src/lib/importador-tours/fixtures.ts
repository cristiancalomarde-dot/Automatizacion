/** Datos de prueba de M1-05 (recortes reales del Word de catálogo y de RutasenBus). */

/** Sección del Word de ARCH31, recortada a lo que lee el importador. */
export const WORD_ARCH31 = [
  "ARCH31- Patagonia Highlights (8 nights)  ",
  "El Chalten + El Calafate + Puerto Natales and Torres del Paine ",
  "Tour can be done vice versa at the same price.",
  "DAY 1: El Chalten",
  "Arrival to El Calafate airport. Transfer to El Chalten.",
  "DAY 2: El Chalten",
  "DAY 3: El Chalten:",
  "DAY 4: El Chalten - El Calafate:",
  "Check Out. Go walking to the bus station to take the 8 am bus to El Calafate.",
  "DAY 5: El Calafate",
  "DAY 6: El Calafate:",
  "DAY 7: El Calafate – Puerto Natales ",
  "Go on your own to the bus station to take the morning bus to Puerto Natales in Chile.",
  "DAY 8: Puerto Natales",
  "DAY 9: Puerto Natales – Punta Arenas",
  "What´s Included?",
  "El Calafate airport shuttle or bus to El Chalten or bus from El Calafate to El Chalten",
  "3 nights Accommodation in El Chalten at selected room with breakfast",
  "Bus El Chalten to El Calafate",
  "3 nights Accommodation in El Calafate at selected room with breakfast. ",
  "Perito Moreno Glacier Full Day Tour ",
  "Bus from El Calafate to Puerto Natales",
  "2 Nights Accommodation in Puerto Natales at selected room with breakfast",
  "Punta Arenas Airport Drop Off or Bus from Puerto Natales to El Calafate",
  "What´s Not Included?",
  "Transfers to and from bus stations.",
  "AR32- The End of the World + El Chalten (10 nights)",
  "DAY 1: El Chalten",
];

/** Arma una fila de hoja (string[]) a partir de { columna: valor }. */
export function fila(celdas: Record<string, string>): string[] {
  const indice = (col: string) => [...col].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
  const fila: string[] = [];
  for (const [col, valor] of Object.entries(celdas)) fila[indice(col)] = valor;
  return Array.from(fila, (v) => v ?? "");
}

/** Bloque de ARCH33 de la hoja "Tours 2027" (filas 316-323). */
export const RUTAS_ARCH33: string[][] = [
  fila({ A: "ARCH33", B: "Patagonia, Trekking Paradise with W Trek 11 Nights", K: "El Chalten - El Calafate" }),
  fila({ C: "OD016", D: "CH10 ", F: "(esta incluido en CH10)", H: "OD033", I: "2026-27", L: "1 Oct 2026 - 25 Apr 2027" }),
  fila({
    B: "Net Prices:", C: "FTE sin Mini", D: "2 Nts Natales", E: "W Trek Refugio", F: "PNT - PUQ", G: "FTE - PNT",
    H: "CHA 3 nts", I: "TTL", J: "Diferencia Carpa W Trek", K: "Net Prices:", L: "W-Trek Refugio", P: "Prices:",
  }),
  fila({ B: "Hostel Dorm ensuite ", C: "144", I: "2397", K: "Dorm Ensuite Hostel", L: " 2,397 ", P: "Dorm Hostel" }),
  fila({ B: "Hostel DBL ", C: "165", K: "Hostel DBL ", L: " 2,596 ", P: "Hostel DBL " }),
  fila({ B: "Hostel SGL ", C: "228", K: "Hostel SGL ", L: " 3,015 ", P: "Hostel SGL " }),
  fila({ B: "Hotel 3* DBL", C: "215", K: "Hotel 3* DBL", L: " 2,721 ", P: "Hotel 3* DBL" }),
  fila({ B: "Hotel 3* SGL ", C: "353", K: "Hotel 3* SGL ", L: " 3,277 ", P: "Hotel 3* SGL " }),
  fila({}),
];

/** Bloque de 5C01 (filas 620-628): anotación "menos 1 noche" y el tour CHB31 como componente. */
export const RUTAS_5C01: string[][] = [
  fila({ B: "Rio to La Paz 5 Countries", U: "Rio to La Paz 5 Countries" }),
  fila({ A: "5C01", B: "RIO +Sao Paulo + Iguazu + … + La Paz 29 nights ", U: "RIO-IGR-BUE-MDZ-SCL-VLP-SPA-UYU-LPB" }),
  fila({
    C: "OD020", E: "OD019 (menos 1 noche)", F: "OD029", I: "OD010D", J: "OD032 ", N: "CHB31", O: "COMPCH01",
    P: "COMPBR10", Q: "OD031", S: "2026-27",
  }),
  fila({
    B: "Net Prices:", C: "BUE+Colonia", D: "IGR - BUE", E: "MDZ 2n", F: "SCL 2n", G: "BUE MDZ", H: "MDZ SCL",
    I: "IGR 3 nts", J: "Rio 3 Nts", K: "SCL - VLP", L: "VLP - CAL", M: "CAL-SPA", N: "SPA+UYU end LPB",
    O: "VLP 2 n", P: "SAO 2 n", Q: "LPB 2 n", R: "RIO SAO IGR", S: "TTL", U: "Net Prices:", V: "1 Jun 2026 - 31 Dec 2027",
    X: "Prices:",
  }),
  fila({ B: "Dorm Hostel", C: "384", S: " 2,625 ", U: "Dorm Hostel", V: " 2,625 ", X: "Dorm Hostel" }),
  fila({ B: "DBL Hostel", C: "358", U: "DBL Hostel", V: " 2,693 ", X: "DBL Hostel" }),
  fila({ B: "SGL Hostel", C: "549", U: "SGL Hostel", V: " 3,709 " }),
  fila({ B: "DBL Hotel 3*", C: "414", U: "DBL Budget Hotel", V: " 3,228 " }),
  fila({ B: "SGL Hotel 3*", C: "681", U: "SGL Budget Hotel", V: " 4,704 " }),
  fila({ V: "0", Y: "0" }),
];

/** Bloque de ARCH31 (filas 343-352): la tabla de venta empieza una fila más abajo y trae un suplemento. */
export const RUTAS_ARCH31: string[][] = [
  fila({ A: "ARCH31", B: "El Chalten + El Calafate + Puerto Natales & Torres del Paine 8 Nights" }),
  fila({ C: "OD016 (mas 1 noche)", D: "OD017", F: "OD033", G: "2026-27", I: "El Chalten + El Calafate" }),
  fila({ B: "Net Prices:", C: "FTE + 1 Nt", D: "PNT 2n", E: "FTE - PNT", F: "CHA 3 nts", G: "TTL" }),
  fila({ B: "Hostel Dorm ensuite ", C: "175", I: "Net Prices:", J: "1 Jun 2026 - 31 Dec 2027", L: "Prices:" }),
  fila({ B: "Hostel DBL ", C: "209", I: "Dorm Hostel", J: " 693 " }),
  fila({ B: "Hostel SGL ", C: "303", I: "Hostel DBL ", J: " 906 " }),
  fila({ B: "Hotel 3* DBL", C: "284", I: "Hostel SGL ", J: " 1,359 " }),
  fila({ B: "Hotel 3* SGL ", C: "490", I: "Budget Hotel DBL", J: " 1,058 " }),
  fila({ I: "Budget Hotel SGL ", J: " 1,686 " }),
  fila({ I: "Supplement: Bus back to El Calafate ", J: " 36 " }),
  fila({}),
];

/** Bloque de CHB31 (filas 813-821). */
export const RUTAS_CHB31: string[][] = [
  fila({ A: "CHB31", B: "Overland San Pedro de Atacama to Uyuni end in La Paz" }),
  fila({ C: "OD030", D: "COMPBO20", F: "2026-27", H: "San Pedro + Overland + Uyuni to La Paz" }),
  fila({ B: "Net Prices:", C: "SPA 3 Noches", D: "Overland", E: "Bus", F: "TTL" }),
  fila({ B: "Hostel Dorm", C: "158", H: "Net Prices:", I: "1 Jan 27- 31 Dec 2027", K: "Prices:" }),
  fila({ B: "Hostel DBL ", H: "Dorm Hostel", I: "489" }),
  fila({ B: "Hostel SGL ", H: "DBL Hostel", I: "536" }),
  fila({ B: "Hotel 3* DBL", H: "SGL Hostel ", I: "728" }),
  fila({ B: "Hotel 3* SGL ", H: "DBL Hotel in SPA", I: "729" }),
  fila({ H: "SGL Hotel in SPA", I: "998" }),
  fila({}),
];

/** Sección del Word de CHB31, recortada. */
export const WORD_CHB31 = [
  "CHB31 Overland San Pedro de Atacama to Uyuni, end in La Paz (6 nights)",
  "*Prices valid vice versa from La Paz to San Pedro de Atacama",
  "DAY 1: San Pedro",
  "Arrival at Calama Airport. Transfer to hostel. Free day",
  "DAY 2: San Pedro",
  "DAY 3: San Pedro:",
  "DAY 4: San Pedro – Uyuni Overland 1st day",
  "DAY 5: San Pedro - Uyuni Overland 2nd day:",
  "DAY 6: San Pedro - Uyuni 3rd day (Salt Flat) – La Paz:",
  "Uyuni town is not a really nice place to be so, at 8 pm, cama bus to La Paz!",
  "DAY 7: La Paz",
  "Included",
  "3 nights Accommodation in San Pedro de Atacama at selected room (Dorm, DBL private or SGL Private)",
  "Calama Airport Pickup.",
  "San Pedro to Uyuni Overland including:",
  "Transportation in shared Jeep 4WD for 6 customers from San Pedro de Atacama to Uyuni. ",
  "1 night accommodation in Family Hostel Dorm or private DBL room",
  "1 night accommodation in Salt Hostel in Dorm or private DBL room.",
  "PM Bus from Uyuni to La Paz",
  "Not Included",
];

/** Sección del Word de 5C01, recortada (sin el DAY 13, como el Word real). */
export const WORD_5C01 = [
  "5C01- 5 Countries: Rio de Janeiro to la Paz (29 nights)",
  "DAY 1: Rio de Janeiro",
  "DAY 2: Rio de Janeiro",
  "DAY 3: Rio de Janeiro.",
  "DAY 4: Rio de Janeiro – Sao Paulo",
  "Check out, go to the bus station to take the bus to Sao Paulo.",
  "DAY 5: Sao Paulo",
  "DAY 6: Sao Paulo – Puerto Iguazu",
  "Find your own way to the Bus Station to take the overnight bus to Foz do Iguazu. (17 hours ride)",
  "DAY 7: Puerto Iguazu",
  "DAY 8: Puerto Iguazu",
  "DAY 9: Puerto Iguazu",
  "DAY 10: Puerto Iguazu – Buenos Aires",
  "Breakfast. 11 am: Check out. Transfer to Puerto Iguazu Bus Station to take the overnight bus to Buenos Aires.",
  "DAY 11: Buenos Aires",
  "DAY 12: Buenos Aires",
  "Breakfast. Free day to enjoy the city.",
  "DAY 14: Buenos Aires-Mendoza",
  "In the evening, make your own way to Retiro bus station to take the night bus to Mendoza.",
  "DAY 15: Mendoza",
  "DAY 16: Mendoza",
  "DAY 17: Mendoza-Santiago de Chile",
  "It is a day bus so do not fall asleep.",
  "DAY 18: Santiago de Chile",
  "DAY 19: Santiago de Chile - Valparaiso",
  "DAY 20: Valparaiso",
  "DAY 21: Valparaiso – Calama",
  "Check out and make your own way to the bus station to catch the night bus to Calama (about 20 hours ride)",
  "DAY 22: Calama - San Pedro de Atacama",
  "Arrival at Calama bus Station and take the new bus to San Pedro de  Atacama.",
  "DAY 23: San Pedro de Atacama",
  "DAY 24: San Pedro de Atacama",
  "DAY 25: San Pedro – Uyuni Overland 1st day 6.30 am - 7 am pick up for the beginning of the San Pedro to Uyuni Overland.",
  "DAY 26: San Pedro - Uyuni Overland 2nd day:",
  "DAY 27: San Pedro - Uyuni 3rd day (Salt Flat) – La Paz:",
  "DAY 28: La Paz",
  "DAY 29: La Paz",
  "DAY 30: La Paz",
  "Included",
  "-Rio de Janeiro International Airport pick up.",
  "-3 nights accommodation in Rio de Janeiro.",
  "-Bus from Rio de Janeiro to Sao Paulo",
  "-2 Nights accommodation in Sao Paulo with breakfast",
  "-Night Bus from Sao Paulo to Foz do Iguazu",
  "-3 nights Accommodation in Puerto Iguazu at selected room with breakfast.",
  "-Foz do Iguazu Bus Station pickup and Puerto Iguazu Bus Station drop off",
  "-Bus from Puerto Iguazu to Buenos Aires ",
  "-3 nights Accommodation in Buenos Aires at selected room with breakfast.",
  "-Night Bus from Buenos Aires to Mendoza",
  "-2 nights Accommodation in Mendoza at selected room with breakfast.",
  "-Bus from Mendoza to Santiago de Chile",
  "-2 nights accommodation in Santiago de Chile with breakfast",
  "-Bus from Santiago to Valparaiso",
  "-2 nights accommodation with breakfast at selected room in Valparaiso",
  "-Night Bus from Valparaiso to Calama",
  "-Bus from Calama to San Pedro de Atacama",
  "-3 nights Accommodation in San Pedro de Atacama ",
  "-San Pedro to Uyuni  Overland including:",
  "1 night accommodation in Family Hostel Dorm or private DBL room",
  "1 night accommodation in Salt Hostel in Dorm or private DBL room.",
  "-Night Bus from Uyuni to La Paz",
  "-La Paz Bus station pick up",
  "-2 nights accommodation in La Paz, Bolivia, at hostel or hotel, with breakfast",
  "Not Included",
];

/** Paquetes cargados (M1-04/M1-04d) con su destino y sus noches base en el Excel de paquetes. */
export const PAQUETES = [
  { codigo: "OD010D", destino: "IGR", nochesBase: 3 },
  { codigo: "OD016", destino: "FTE", nochesBase: 2 },
  { codigo: "OD017", destino: "PNT", nochesBase: 2 },
  { codigo: "OD019", destino: "MDZ", nochesBase: 3 },
  { codigo: "OD020", destino: "BUE", nochesBase: 3 },
  { codigo: "OD029", destino: "SCL", nochesBase: 2 },
  { codigo: "OD030", destino: "SPA", nochesBase: 3 },
  { codigo: "OD031", destino: "LPB", nochesBase: 2 },
  { codigo: "OD032", destino: "RIO", nochesBase: 3 },
  { codigo: "OD033", destino: "CHA", nochesBase: 3 },
  { codigo: "COMPBO20", destino: "UYU", nochesBase: 2 },
  { codigo: "COMPBR10", destino: "SAO", nochesBase: 2 },
  { codigo: "COMPCH01", destino: "VLP", nochesBase: 2 },
];
