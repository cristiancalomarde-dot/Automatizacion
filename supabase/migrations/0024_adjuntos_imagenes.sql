-- M3-30: las imágenes del mail (las pegadas en el cuerpo y las adjuntas) se
-- guardan en el bucket privado de adjuntos, como los PDF, para verlas desde
-- el detalle de la reserva. Solo cambia qué tipos acepta el bucket; las
-- políticas (lee el equipo, escribe solo el servidor) siguen igual.
update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']
where id = 'mail-adjuntos';
