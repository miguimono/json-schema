# JSON Schema

Esta librería tiene **dos variantes** de build:

- `projects/schema-ng19`: build principal para Angular moderno (en este repo se usa Angular 19).
- `projects/schema-ng16`: build compatible con Angular 16 (export en subpath `./ng16`).

Ambas se construyen desde **la raíz** del repo. No necesitas instalar dependencias dentro de `projects/schema-ng19` ni `projects/schema-ng16`.

## Requisitos y versiones

- Node.js: **no hay `engines` definidos** en los `package.json`, por lo que debes usar una versión compatible con tu Angular objetivo.
- NPM: la versión incluida con tu Node.
- Angular CLI: viene como dependencia del workspace cuando instalas en la raíz.

Recomendación práctica usando `nvm`:

- Para construir la variante principal (Angular moderno): `nvm use 22`
- Para probar compatibilidad Angular 16 en entornos antiguos: `nvm use 16` (o una versión LTS más nueva si tu entorno lo permite)

Si cambias de versión de Node, **reinstala dependencias en la raíz** para evitar binarios incompatibles.

## Instalación (única, en la raíz)

Desde la raíz del repo:

```bash
nvm use 22
npm install
```

Esto crea un **solo** `node_modules` en la raíz.  
Las carpetas `projects/schema-ng19/node_modules` y `projects/schema-ng16/node_modules` **no deberían existir**.

## Compilación

Desde la raíz del repo:

```bash
# build Angular moderno
npm run build:schema-ng19

# build Angular 16 (subpath ./ng16)
npm run build:schema-ng16

# build de ambas
npm run build
```

Los artefactos quedan en:

- `dist/schema/` (principal)
- `dist/schema/ng16/` (compatibilidad)

## Empaquetado (npm pack)

```bash
npm run pack
```

Esto:

1. Construye ambas variantes.
2. Genera un `.tgz` en la raíz, por ejemplo `json-schema-x.y.z.tgz`.

Si quieres empaquetar manualmente desde la carpeta de salida:

```bash
cd dist/schema
npm pack
```

## Consumo en proyectos

Import normal (Angular moderno):

```ts
import { SchemaComponent } from "@miguimono/json-schema";
```

Import explícito Angular 19:

```ts
import { SchemaComponent } from "@miguimono/json-schema/ng19";
```

Import compatible Angular 16:

```ts
import { SchemaComponent } from "@miguimono/json-schema/ng16";
```

## ¿Qué hace la librería?

Convierte un JSON arbitrario en un **grafo visual interactivo** de cards y enlaces.  
Incluye normalización del JSON, layout jerárquico determinista y render con pan/zoom.

## Módulos y responsabilidades

- `SchemaComponent`: orquesta el pipeline completo (normalización → layout → render), maneja pan/zoom, overlays y toolbar.
- `SchemaCardComponent`: renderiza un nodo como card, admite `cardTemplate`, badges e imagen opcional.
- `SchemaLinksComponent`: dibuja las aristas en SVG según el estilo configurado.
- `JsonAdapterService`: normaliza el JSON en nodos/aristas con metadatos.
- `SchemaLayoutService`: calcula posiciones y puntos de aristas.
- `models.ts`: contratos y `DEFAULT_SETTINGS`.

## Flujo interno (alto nivel)

1. `JsonAdapterService` normaliza el JSON en `NormalizedGraph`.
2. `SchemaLayoutService` calcula posiciones y puntos de aristas.
3. `SchemaComponent` renderiza cards/enlaces y gestiona pan/zoom.

## Recomendaciones de performance

- Para grafos muy grandes, considera:
  - `dataView.previewMaxKeys` bajo (ej. 3–8).
  - `dataView.maxDepth` (ej. 3–6).
  - `dataView.autoResizeCards: false` si necesitas mayor velocidad.
  - `viewport.height` más alto si el grafo es muy vertical.
- Si usas imágenes, define `dataView.imageSizePx` y `imageFit` para evitar relayouts.

## Troubleshooting (errores comunes)

- `Cannot destructure property 'pos' of 'file.referencedFiles[index]' ...`  
  Suele indicar incompatibilidad de TypeScript. Para Angular 19 usa TS `~5.5.x`.
- `Could not find the '@angular-devkit/build-angular:ng-packagr' builder`  
  Verifica que `@angular-devkit/build-angular` y `ng-packagr` estén en `devDependencies`.
- `Unknown argument: verbose`  
  Usa `npx ng ...` para forzar el CLI local del proyecto.
- Si el esquema no se re-renderiza tras mutar el JSON, reasigna `data` con un
  nuevo objeto (cache referencial).

## Estructura recomendada (mantenimiento)

- `projects/schema-ng19`: build principal (Angular 19).
- `projects/schema-ng16`: build compatibilidad (Angular 16).
- `projects/schema-shared`: fuente única de modelos y servicios.
- `scripts/sync-shared.js`: copia `schema-shared` dentro de cada build antes de compilar.
- `projects/schema-shared/src/lib/styles`: tokens, mixins y base de estilos.

Notas de mantenimiento:

- **No edites** manualmente las copias dentro de `schema-ng16/src/lib/shared` ni `schema-ng19/src/lib/shared`.
- Haz cambios en `projects/schema-shared/src/lib` y compila (el script las sincroniza).
- Mantén la versión **única** en el `package.json` raíz (se sincroniza a los subproyectos).
- Puedes verificar sincronización con `npm run check:shared`.
- Para builds limpios: `npm run clean:dist` (funciona en Windows, macOS y Linux).

## Uso rápido (Angular 19 / 16)

### Angular 19 (default)

```ts
import { SchemaComponent } from "@miguimono/json-schema";
```

### Angular 16

```ts
import { SchemaComponent } from "@miguimono/json-schema/ng16";
```

### Ejemplo mínimo

```ts
import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SchemaComponent } from "@miguimono/json-schema";

@Component({
  selector: "app-demo",
  standalone: true,
  imports: [CommonModule, SchemaComponent],
  template: `<schema [data]="data"></schema>`,
})
export class DemoComponent {
  data = {
    root: {
      name: "Root",
      children: [{ name: "Child A" }, { name: "Child B" }],
    },
  };
}
```

### Ejemplo con settings básicos

```ts
import { SchemaSettings, DEFAULT_SETTINGS } from "@miguimono/json-schema";

const settings: SchemaSettings = {
  ...DEFAULT_SETTINGS,
  layout: {
    ...DEFAULT_SETTINGS.layout,
    layoutDirection: "RIGHT",
    linkStyle: "curve",
  },
  dataView: {
    ...DEFAULT_SETTINGS.dataView,
    titleKeyPriority: ["name", "title", "id"],
    previewMaxKeys: 5,
  },
};
```

```html
<schema [data]="data" [settings]="settings"></schema>
```

## Instalación directa desde `.tgz` local (sin publicar)

Si copiaste el paquete a `lib/json-schema-x.y.z.tgz` dentro del proyecto consumidor:

```bash
npm install ./lib/json-schema-x.y.z.tgz
```

Luego:

- Angular 19+:
  ```ts
  import { SchemaComponent } from "@miguimono/json-schema";
  ```
- Angular 19 explícito:
  ```ts
  import { SchemaComponent } from "@miguimono/json-schema/ng19";
  ```
- Angular 16:
  ```ts
  import { SchemaComponent } from "@miguimono/json-schema/ng16";
  ```

Nota: el `.tgz` puede estar en cualquier ruta local; usa la ruta relativa o absoluta.

## Notas importantes

- Hay **3 `package.json`**:
  - `package.json` raíz: scripts y exports.
  - `projects/schema-ng19/package.json`: metadata del build principal.
  - `projects/schema-ng16/package.json`: metadata del build `ng16`.
- **Solo se instala en la raíz**.  
  Si instalas dentro de `projects/schema-ng19` o `projects/schema-ng16`, tendrás tres `node_modules` y eso genera inconsistencias.

## Limpieza si ya instalaste en subproyectos

Si ya creaste `node_modules` dentro de los subproyectos, bórralos y vuelve a instalar en la raíz:

```bash
rm -rf projects/schema-ng19/node_modules projects/schema-ng16/node_modules
npm install
```

## Licencia

MIT — Copyright (c) 2026 Miguimono
