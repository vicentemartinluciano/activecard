# Cuenta privada y sincronización

## Estado

Implementación preparada el 7 de octubre de 2026. Usa el proyecto de Supabase de
REANCLA y el mismo correo/contraseña; ActiveCard tiene tablas, archivos y sesiones
propios. La migración remota se ejecutó el 7 de octubre con confirmación de Martín:
cuenta única, RLS, bucket privado y privilegios de las RPC verificados en el proyecto
real. Las políticas de Storage solo habilitan lectura e inserción para el dueño;
no hay políticas adicionales que amplíen ese acceso. La primera publicación de la
biblioteca todavía no se completó; hay fragmentos subidos por el intento Android.
El APK 1.6.0 terminó de compilar y Martín confirmó su instalación: abre y conserva
sus mazos y tarjetas. Incluye SecureStore y Crypto. El login Android accedió a la
cuenta; la primera subida y la prueba entre dispositivos siguen pendientes.

Build EAS `d985993f-0dfd-40fb-a351-2cb8843550af`, desde el commit
`7219aa1fcfa84a6a0d50c4c6b3fd03501136cc35`, con CI y publicación web exitosos.
SHA-256 del APK: `587985580d6a33816f1253ad3f769aa1c9fb4235048541e2be89e0fc8f1e7c2d`.
El primer login Android accedió a la cuenta, pero la subida se detuvo con HTTP 400
por un objeto ya existente (`idx_objects_current_version`, SQLSTATE 23505 en los
registros reales). El cliente ahora reconoce los duplicados legacy de Storage y
verifica el SHA-256 del objeto antes de reutilizarlo; no habilita sobrescritura ni
amplía permisos. Esta corrección requiere publicar una OTA compatible con 1.6.0
y repetir la prueba física antes de declarar operativa la sincronización.

La web de escritorio ya se publicó en GitHub Pages. Para el APK nuevo se eliminaron
los fallbacks de claves públicas del build: OpenAI y Notion se ingresan en Ajustes
en cada dispositivo. Las claves ya guardadas localmente se conservan; un token que
solo venía incrustado en el APK anterior debe ingresarse una vez en Ajustes.

## Datos y seguridad

SQLite continúa siendo la fuente local y funciona sin cuenta o sin conexión. Se
sincronizan carpetas, mazos, etiquetas, tarjetas, imágenes inline, programación FSRS,
repasos, conexiones/ideas y conversaciones con mensajes, borradores persistidos y
adjuntos. Una charla nueva sigue siendo efímera hasta el primer envío.

`settings`, preferencias, claves OpenAI/Notion, contraseña y tokens no entran en el
documento, los respaldos ni las copias de recuperación. Solo el refresh token se
guarda: SecureStore en Android; sessionStorage en web, o localStorage cuando el
usuario elige Recordar sesión. La contraseña se limpia del formulario al finalizar.

El cliente usa una clave **publishable pública**, nunca credenciales de administrador.
`activecard_owner` permite un único UUID. Auth y el RPC `activecard_access` deben
confirmar el acceso antes de guardar una sesión. El esquema remoto bloquea a otros
usuarios, incluso si pueden iniciar sesión en REANCLA. El bucket es privado y sus
políticas autorizan lectura e inserción solo para ese dueño.

## Identidad y transporte

La migración SQLite v8 agrega `sync_id` e índices únicos. Los datos v7 tienen una
identidad determinista basada en tabla, ID y fecha original; dos copias del mismo
respaldo se reconocen. Los inserts posteriores reciben 128 bits aleatorios desde
SQLite. Las etiquetas se identifican por su nombre exacto. Los IDs numéricos siguen
siendo locales y se conservan al instalar una nueva versión de la biblioteca.

Respaldo v4 conserva estas identidades. Se pueden restaurar v1, v2 y v3; reciben
identidades originales deterministas. Una importación aditiva crea identidades
nuevas para las filas que copia. El esquema y las migraciones previas no se alteran.

El documento solo admite columnas conocidas y valida referencias, fechas y estados.
Las referencias de mensajes y propuestas también se remapean entre dispositivos.
Las propuestas del Gimnasio siguen requiriendo la confirmación habitual de la app.

Cada fila se serializa y se divide en fragmentos de hasta 256 Ki caracteres,
respetando pares Unicode. El nombre de cada archivo es su SHA-256. Se reutilizan
fragmentos existentes y se verifica el hash al descargar. El manifiesto contiene
solo identidades y hashes; un RPC publica ese manifiesto con revisión esperada (CAS),
verifica que todos sus archivos existan y permite reintentar el mismo cambio.

Hay un límite de 256 Mi caracteres por documento y 1,8 millones por manifiesto. Un
exceso o falta de espacio se informa conservando los datos locales. No se descartan
imágenes ni fuentes para hacer entrar una sincronización. Los fragmentos antiguos
se conservan inmutables: no hay purga automática. Si se alcanza la cuota, la limpieza
administrativa debe preservar los hashes del manifiesto vigente. No se habilita un
plan pago automáticamente. Las cuotas compartidas del proyecto se consultan en
[Supabase Billing](https://supabase.com/docs/guides/platform/billing-on-supabase).

## Conflictos y aplicación local

El checkpoint conserva el último estado común. Las ediciones de entidades distintas
se combinan; las eliminaciones se comparan contra ese estado. Dos cambios incompatibles
en una entidad eligen la alternativa de la nube **después** de archivar la biblioteca
local y el documento remoto. Es el criterio conservador de REANCLA cuando no hay
relojes de edición por campo. Recuperación en Ajustes permite restaurar una copia,
guardando antes el estado actual; la restauración luego se sincroniza.

Una tarjeta, su programación, sus repasos y sus conexiones forman una unidad. Una
conversación y sus mensajes también. Dos repasos offline de la misma tarjeta se
conservan como alternativas recuperables; no se unen historiales con un estado FSRS
incompatible ni se inventa un recálculo distinto del criterio acordado.

Todas las operaciones SQLite se serializan. Repaso/deshacer, importaciones y aplicación
de la nube son transacciones; un fallo revierte la operación. La instalación compara
otra vez el estado local dentro de la transacción, para detectar ediciones aparecidas
durante la descarga. La programación diaria consulta el último repaso por fecha,
porque los IDs locales de registros remotos no indican su orden cronológico.

Hay comprobación cada 30 segundos mientras la app está activa, al recuperar foco del
dispositivo y al navegar. Los cambios guardados pueden subirse desde cualquier pantalla.
Si el arranque ocurre sin conexión, estos intentos también reconectan la sesión guardada.
La incorporación de cambios remotos espera a Ajustes y a que termine un envío del
Gimnasio. La web indica los cambios pendientes junto al botón Ajustes. La condición
de seguridad se comprueba otra vez dentro de la transacción, después de la espera.
Las pantallas conservadas en el Stack releen datos al volver a foco. El
editor protege su texto contra una versión cambiada antes de guardar. Los checkpoints
y el contenido sin cambios se cachean para no releer imágenes o volver a descargarlas.

## Activación

1. Exportar un respaldo v3 desde la APK instalada, incluyendo los adjuntos necesarios.
2. Revisar y ejecutar `supabase/migrations/202610070001_activecard_private_sync.sql`
   como administrador del proyecto de REANCLA. La transacción exige un único usuario
   confirmado; si hay varios, elegir el UUID de Martín explícitamente antes de ejecutar.
   No modifica las tablas de REANCLA ni sus usuarios.
3. Publicar la web con CI verde. Construir APK 1.6.0 desde `main` limpia y sincronizada.
4. Instalar sobre la anterior, sin desinstalar. Iniciar sesión primero en Ajustes de
   Android y esperar que termine de subir la biblioteca; luego conectar la web con
   el mismo acceso de REANCLA.
5. Probar Android → web → Android, una edición offline, un conflicto de texto, dos
   repasos offline, borrado frente a edición y una conversación con adjunto. Comprobar
   Recuperación y el próximo repaso después del conflicto.

La exportación Android y las pruebas de servidor simulado no acreditan estos pasos.

## Verificación reproducible

```powershell
npx eslint . --max-warnings 0
npx jest --ci
node scripts/verify-sync-sqlite.mjs
node scripts/verify-sync-sql.mjs
$env:EXPO_OFFLINE='1'
$env:EXPO_NO_DOTENV='1'
npx expo-doctor
npx expo export --platform android --clear
```

SQLite real verifica migración v7→v8, IDs, relaciones, adjuntos, claves excluidas,
comparación antes de aplicar, recuperación y respaldo v4. Postgres embebido verifica
cuenta única, RLS de tablas/archivos, escrituras inmutables, archivos existentes,
CAS, replay idempotente y bloqueo de otra cuenta. Jest cubre merges, archivo antes
de checkpoint, reintentos, sesiones, hashes alterados y transferencias entre clientes.
SQLite también comprueba que un fallo al registrar un repaso revierte su estado FSRS
y que el último mensaje del historial se elige por fecha, aunque su ID sea menor.

La revisión de dependencias corrigió `shell-quote`, TipTap y `prosemirror-view`, y
regeneró el editor Android. `npm audit` todavía informa 72 entradas (57 altas y 15
moderadas, ninguna crítica); no se declara una auditoría limpia. Las recomendaciones
que cambian el SDK o la versión de React Native requieren otra evaluación, no un
`npm audit fix --force` que rompa la compatibilidad de Expo.
