# Instalar Alisuite

Descarga la última versión desde
[Releases](https://github.com/varmiguemunoz/daylios/releases/latest).

## Windows

1. Descarga `Alisuite-Setup-<versión>.exe` y ábrelo.
2. Si Windows muestra «Windows protegió tu PC», pulsa «Más información» y luego «Ejecutar de todas
   formas». Pasa solo la primera vez porque la app aún no tiene certificado de Windows.
3. Elige la carpeta y termina. Queda un acceso directo en el escritorio y en el menú Inicio.
4. Alisuite vive en la bandeja, junto al reloj. Si no la ves, abre la flecha de iconos ocultos.

## macOS

1. Descarga el DMG de tu Mac: `arm64` para Apple Silicon, M1 a M4, y `x64` para Intel. Lo ves en
   Apple, Acerca de este Mac.
2. Abre el DMG y arrastra Alisuite a Aplicaciones.
3. Alisuite vive en la barra de menús, arriba a la derecha. No aparece en el Dock.
4. La primera grabación pide micrófono y grabación de pantalla. Concede los dos y reinicia la app.

## Después de instalar

1. Ajustes, General, Aplicación: «Conectar con Claude». Cierra Claude Desktop del todo y ábrelo otra
   vez.
2. Inicia sesión y únete a la organización con el enlace de invitación.
3. Las actualizaciones llegan solas. Cuando haya una lista, Alisuite avisa y se instala al reiniciar.

## Publicar una versión

1. Sube la versión en `package.json`, por ejemplo `1.1.0`, y haz commit.
2. Crea y sube el tag: `git tag v1.1.0` y `git push origin v1.1.0`.
3. GitHub Actions construye macOS Intel, macOS Apple Silicon y Windows, y publica la versión cuando
   las tres están listas.
