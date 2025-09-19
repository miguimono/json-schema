# @miguimono/schema

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Angular](https://img.shields.io/badge/Angular-19-red.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)

**Schema** es una librería para **Angular 19** que transforma cualquier objeto **JSON arbitrario** en un **grafo visual interactivo** (cards + conexiones).  
Construida con **standalone components**, **Angular Signals** e `input()`. Compatible con Angular Material 19 (opcional en tu app).

Pensada para explorar, depurar y presentar jerarquías de datos complejos en aplicaciones empresariales.

---

## Tabla de contenidos

- [@miguimono/schema](#miguimonoschema)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [✨ Características](#-características)
  - [📦 Instalación](#-instalación)
  - [🧠 Conceptos y arquitectura](#-conceptos-y-arquitectura)
  - [🧩 Componentes públicos](#-componentes-públicos)
  - [🧪 Ejemplos](#-ejemplos)
    - [Ejemplo básico (solo JSON)](#ejemplo-básico-solo-json)
    - [Ejemplo completo (todas las entradas)](#ejemplo-completo-todas-las-entradas)
  - [🔎 API](#-api)
    - [Inputs de `<schema>`](#inputs-de-schema)
    - [`SchemaSettings`](#schemasettings)
    - [Estilos de enlaces](#estilos-de-enlaces)
  - [✅ Buenas prácticas](#-buenas-prácticas)
  - [❓ FAQ](#-faq)
  - [🧭 Roadmap / Notas de versión](#-roadmap--notas-de-versión)
  - [📄 Licencia](#-licencia)

---

## ✨ Características

- Convierte **cualquier JSON** en un grafo navegable (sin premodelar).
- **Layout determinista** tipo _tidy tree_: sin solapes, orden estable tal cual el JSON.
- Dirección de flujo **RIGHT** (izq→der) o **DOWN** (arriba→abajo).
- **Alineación** del padre: con el **primer hijo** o **centrado** respecto a sus hijos.
- **Enlaces**: curva, ortogonal o línea recta (con animación suave en relayout).
- **Zoom, pan, reset** y **fit-to-view** automáticos.
- **Cards personalizables** vía `ng-template` (título + atributos + badges, o tu propio markup).
- **Auto-resize**: mide el DOM real y reacomoda el layout hasta estabilizar.
- **Collapse/Expand** por card (opcional) con preservación de “slots”.
- **Acento visual por clave booleana**: bordes/rellenos según `true/false/null`.
- Tooling moderno: **TypeScript 5**, **Angular Signals**, standalone components.

> **Nota**: La librería expone una API de alto nivel. Internamente utiliza:
>
> - `JsonAdapterService`: JSON → grafo (nodos/aristas) con metadatos.
> - `SchemaLayoutService`: posiciones deterministas + puntos de enlace.

---

## 📦 Instalación

```bash
npm i @miguimono/schema
```

**Peer deps:**

- `@angular/core` `^19.0.0`
- `@angular/common` `^19.0.0`
- `@angular/cdk` `^19.0.0` (si usas Material en tu app)
- `rxjs` `~7.8.0`
- TypeScript `5.x`

---

## 🧠 Conceptos y arquitectura

- **Nodo (SchemaNode):** card con `label`/título, preview de atributos y badges de arrays.  
  El adapter determina orden entre hermanos (prop `jsonMeta.childOrder`) para preservar **el orden del JSON**.
- **Arista (SchemaEdge):** une dos nodos (`source` → `target`) y contiene `points` (start/bends/end).
- **Grafo normalizado (NormalizedGraph):** `nodes + edges + meta`.
- **Layout:** el servicio organiza los nodos por profundidad y subárboles.
  - `layoutDirection`: `RIGHT` o `DOWN`.
  - `layoutAlign`: `'firstChild' | 'center'`.
  - `linkStyle`: `'curve' | 'orthogonal' | 'line'`.

---

## 🧩 Componentes públicos

| Componente             | Descripción rápida                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| `SchemaComponent`      | Orquestador (pan/zoom, render de cards y enlaces, medición, relayout y colapso/expansión). |
| `SchemaCardComponent`  | Card genérica por nodo. Soporta `ng-template` para personalizar contenido.                 |
| `SchemaLinksComponent` | Dibuja todas las aristas en un único `<svg>`.                                              |

> Usualmente **solo importas** `SchemaComponent`. Los demás son internos.

---

## 🧪 Ejemplos

### Ejemplo básico (solo JSON)

```ts
// app/demo-basic.component.ts
// ---------------------------------------------------------
// Ejemplo mínimo: envío únicamente un JSON.
// ---------------------------------------------------------
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchemaComponent } from '@miguimono/schema';

@Component({
  selector: 'app-demo-basic',
  standalone: true,
  imports: [CommonModule, SchemaComponent],
  template: \`
    <schema [data]="exampleJson"></schema>
  \`,
})
export class DemoBasicComponent {
  exampleJson = {
    central: {
      central_name: 'Centro | Bogotá',
      cables: [
        { cable_name: 'GA-05', in_damage: true },
        { cable_name: 'GA-06', in_damage: false },
      ],
    },
  };
}
```

### Ejemplo completo (todas las entradas)

```ts
// app/demo-full.component.ts
// ---------------------------------------------------------
// Demostración completa: settings, template, mensajes y estados.
// ---------------------------------------------------------
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchemaComponent, DEFAULT_SETTINGS, SchemaSettings } from '@miguimono/schema';

@Component({
  selector: 'app-demo-full',
  standalone: true,
  imports: [CommonModule, SchemaComponent],
  template: \`
    <schema
      [data]="data()"
      [settings]="settings"
      [cardTemplate]="cardTpl"
      [isLoading]="isLoading()"
      [isError]="isError()"
      [emptyMessage]="'No hay datos para mostrar'"
      [loadingMessage]="'Cargando…'"
      [errorMessage]="'No se pudo renderizar el esquema'"
      (nodeClick)="onNodeClick($event)"
      (linkClick)="onLinkClick($event)"
    ></schema>

    <!-- Template personalizado para cada card -->
    <ng-template #cardTpl let-node>
      <div style="padding:12px 14px; max-width:360px">
        <div style="font-weight:700; margin-bottom:6px">
          {{ node.jsonMeta?.title || node.label }}
        </div>
        <div *ngIf="node.jsonMeta?.attributes as attrs">
          <div *ngFor="let e of (attrs | keyvalue)" style="font-size:12px; margin:2px 0">
            <strong style="opacity:.7">{{ e.key }}:</strong> {{ e.value }}
          </div>
        </div>
      </div>
    </ng-template>
  \`,
})
export class DemoFullComponent {
  // Datos reactivos (puedes reemplazar por tu fachada)
  data = signal<any>({
    nivel: 'nivel 0',
    children: [
      { nivel: 'Nivel 1', info: '...', children: [] },
      { nivel: 'Nivel 2', info: '...', children: [] },
    ],
  });

  // Settings (parte de ellos, usando DEFAULT_SETTINGS como base)
  settings: SchemaSettings = {
    ...DEFAULT_SETTINGS,
    layout: {
      ...DEFAULT_SETTINGS.layout,
      layoutDirection: 'RIGHT',            // RIGHT | DOWN
      layoutAlign: 'firstChild',           // firstChild | center
      linkStyle: 'curve',                  // curve | orthogonal | line
      straightThresholdDx: 160,
      curveTension: 80,
      snapChainSegmentsY: true,            // alinear cadenas lineales
    },
    colors: {
      ...DEFAULT_SETTINGS.colors,
      linkStroke: '#019df4',
      linkStrokeWidth: 2,
      accentByKey: 'certified',            // toma true/false/null de node.data[certified]
      accentFill: true,
      showColorTrue: true,
      showColorFalse: true,
      showColorNull: true,
    },
    dataView: {
      ...DEFAULT_SETTINGS.dataView,
      titleKeyPriority: ['name', 'title', 'id', 'label'],
      previewMaxKeys: 4,
      treatScalarArraysAsAttribute: true,
      collapseArrayContainers: true,
      collapseSingleChildWrappers: true,
      enableCollapse: true,                // muestra botón por card si tiene hijos
      defaultNodeSize: { width: 220, height: 96 },
      noWrapKeys: ['service_number'],      // muestra esas claves en una sola línea
      maxCardWidth: 380,                   // restricciones a la medición
      maxCardHeight: null,
      autoResizeCards: true,
      measureExtraWidthPx: 24,
      measureExtraHeightPx: 0,
    },
    viewport: {
      ...DEFAULT_SETTINGS.viewport,
      height: 800,
      minHeight: 480,
      showToolbar: true,
    },
    messages: {
      ...DEFAULT_SETTINGS.messages,
      isLoading: false,
      isError: false,
      emptyMessage: 'No hay datos para mostrar',
      loadingMessage: 'Cargando…',
      errorMessage: 'Error al cargar el esquema',
    },
    debug: {
      ...DEFAULT_SETTINGS.debug,
      measure: false,
      layout: false,
      paintBounds: false,
      exposeOnWindow: false,
    },
  };

  // Estados (por ejemplo, mientras llega el JSON)
  isLoading = signal(false);
  isError = signal(false);

  onNodeClick(n: any) {
    console.log('nodeClick', n);
  }
  onLinkClick(e: any) {
    console.log('linkClick', e);
  }
}
```

---

## 🔎 API

### Inputs de `<schema>`

| Input            | Tipo                       | Default                        | Descripción                                                                |
| ---------------- | -------------------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `data`           | `any`                      | —                              | **Requerido.** JSON arbitrario a visualizar.                               |
| `settings`       | `SchemaSettings \| null`   | `DEFAULT_SETTINGS`             | Configuración por secciones. Los valores no provistos heredan del default. |
| `cardTemplate`   | `TemplateRef<any> \| null` | `null`                         | Plantilla personalizada para cada card (el nodo llega como `$implicit`).   |
| `isLoading`      | `boolean`                  | `false`                        | Fuerza overlay de carga (también configurable en `settings.messages`).     |
| `isError`        | `boolean`                  | `false`                        | Fuerza overlay de error (también configurable en `settings.messages`).     |
| `emptyMessage`   | `string`                   | `'No hay datos para mostrar'`  | Texto del estado vacío.                                                    |
| `loadingMessage` | `string`                   | `'Cargando…'`                  | Texto del estado de carga.                                                 |
| `errorMessage`   | `string`                   | `'Error al cargar el esquema'` | Texto del estado de error.                                                 |

**Outputs**

| Output      | Payload      | Descripción                               |
| ----------- | ------------ | ----------------------------------------- |
| `nodeClick` | `SchemaNode` | Se emite al hacer click sobre una card.   |
| `linkClick` | `SchemaEdge` | Se emite al hacer click sobre una arista. |

> El layout y la medición son internos. El contenedor solo provee `data` y, opcionalmente, `settings` y `cardTemplate`.

---

### `SchemaSettings`

Las opciones están **agrupadas por secciones**. Cualquier sección/propiedad omitida toma su valor desde `DEFAULT_SETTINGS` (puedes importarlo).

**layout**

| Propiedad             | Tipo                                | Default        | Descripción                                                                     |
| --------------------- | ----------------------------------- | -------------- | ------------------------------------------------------------------------------- |
| `layoutDirection`     | `'RIGHT' \| 'DOWN'`                 | `'RIGHT'`      | Orientación del grafo.                                                          |
| `layoutAlign`         | `'firstChild' \| 'center'`          | `'firstChild'` | Alineación vertical (RIGHT) u horizontal (DOWN) del padre respecto a sus hijos. |
| `linkStyle`           | `'curve' \| 'orthogonal' \| 'line'` | `'curve'`      | Estilo visual de aristas.                                                       |
| `curveTension`        | `number`                            | `80`           | Tensión para curvas; clamp 20–200.                                              |
| `straightThresholdDx` | `number`                            | `160`          | Si `dx < threshold`, una curva se dibuja recta para evitar curvas muy cerradas. |
| `snapChainSegmentsY`  | `boolean`                           | `false`        | Alinea cadenas lineales (out=1) al eje del hijo para “líneas rectas”.           |

**dataView**

| Propiedad                      | Tipo                              | Default                         |
| ------------------------------ | --------------------------------- | ------------------------------- |
| `titleKeyPriority`             | `string[]`                        | `['name','title','id','label']` |
| `hiddenKeysGlobal`             | `string[]`                        | `[]`                            |
| `titleMode`                    | `'auto' \| 'none'`                | `'auto'`                        |
| `previewMaxKeys`               | `number`                          | `4`                             |
| `treatScalarArraysAsAttribute` | `boolean`                         | `true`                          |
| `collapseArrayContainers`      | `boolean`                         | `true`                          |
| `collapseSingleChildWrappers`  | `boolean`                         | `true`                          |
| `maxDepth`                     | `number \| null`                  | `null`                          |
| `defaultNodeSize`              | `{ width:number; height:number }` | `{220,96}`                      |
| `noWrapKeys`                   | `string[]`                        | `[]`                            |
| `maxCardWidth`                 | `number \| null`                  | `null`                          |
| `maxCardHeight`                | `number \| null`                  | `null`                          |
| `autoResizeCards`              | `boolean`                         | `true`                          |
| `measureExtraWidthPx`          | `number`                          | `24`                            |
| `measureExtraHeightPx`         | `number`                          | `0`                             |
| `enableCollapse`               | `boolean`                         | `false`                         |

**colors**

| Propiedad                  | Tipo             | Default   | Comentario                                          |
| -------------------------- | ---------------- | --------- | --------------------------------------------------- |
| `linkStroke`               | `string`         | `#019df4` | Color de aristas.                                   |
| `linkStrokeWidth`          | `number`         | `2`       | Grosor de aristas.                                  |
| `accentByKey`              | `string \| null` | `null`    | Clave booleana en `node.data` para acento por card. |
| `accentFill`               | `boolean`        | `false`   | Relleno además del borde.                           |
| `accentInverse`            | `boolean`        | `false`   | Invierte mapping de colores.                        |
| `showColorTrue/False/Null` | `boolean`        | `false`   | Habilita color por cada caso.                       |

**viewport**

| Propiedad     | Tipo      | Default |
| ------------- | --------- | ------- |
| `height`      | `number`  | `800`   |
| `minHeight`   | `number`  | `480`   |
| `showToolbar` | `boolean` | `true`  |

**messages**

| Propiedad        | Tipo      | Default                        |
| ---------------- | --------- | ------------------------------ |
| `isLoading`      | `boolean` | `false`                        |
| `isError`        | `boolean` | `false`                        |
| `emptyMessage`   | `string`  | `'No hay datos para mostrar'`  |
| `loadingMessage` | `string`  | `'Cargando…'`                  |
| `errorMessage`   | `string`  | `'Error al cargar el esquema'` |

**debug**

| Propiedad        | Tipo      | Default |
| ---------------- | --------- | ------- |
| `measure`        | `boolean` | `false` |
| `layout`         | `boolean` | `false` |
| `paintBounds`    | `boolean` | `false` |
| `exposeOnWindow` | `boolean` | `false` |

> Para ver todos los defaults en código, revisa `DEFAULT_SETTINGS` (exportado desde `projects/schema/src/lib/models.ts`).

---

### Estilos de enlaces

- **`curve`** (default): curva cúbica con tensión configurable (`curveTension`).  
  Si la separación horizontal `dx` es pequeña (< `straightThresholdDx`), se renderiza recta.
- **`orthogonal`**: segmentos en “L” (con codo intermedio).
- **`line`**: línea recta simple.

Cámbialo desde la toolbar integrada o vía `settings.layout.linkStyle`.

---

## ✅ Buenas prácticas

- Pasa `data` ya “listo para leer”; el adapter colapsa _wrappers_ triviales y arrays escalares (opcional).
- Si usas `cardTemplate`, **no dependas** de orden de claves en objetos; accede por `node.data.tuClave`.
- Si activas `enableCollapse`, deja que el contenedor preserve el estado de colapso si recreas el componente.
- Para árboles muy altos, puedes aumentar `viewport.height` o usar el ajuste automático del stage (incluido en el componente).

---

## ❓ FAQ

**¿Cómo personalizo el botón de colapso (dirección del caret)?**  
El icono se determina en `SchemaCardComponent` (método `arrowGlyph()`), que muestra **◀/▶** para `RIGHT` y **▲/▼** para `DOWN`, según `isCollapsed`.

**¿Se respeta el orden del JSON?**  
Sí. El adapter genera `jsonMeta.childOrder` y el layout lo respeta en todas las capas.

**¿Por qué una arista curva a veces se ve recta?**  
Si `dx < straightThresholdDx`, se dibuja recta para evitar curvas muy cerradas. Ajusta ese umbral en `settings.layout`.

---

## 🧭 Roadmap / Notas de versión

- **0.4.11**

  - Layout **tidy** determinista (sin solapes, orden estable).
  - Alineación `firstChild` real (padre al centro de la **card** del primer hijo).
  - **Snap** opcional de cadenas (alineación perfecta en columnas).
  - Restauración de `curve/line` con puntos `[start,end]` (el renderer aplica la curva).
  - Mejora en stage dinámico (evita “recortes” en árboles profundos).

- **0.4.10**
  - Migración a `SchemaSettings` + `DEFAULT_SETTINGS`.
  - Cards con botón de colapso/expansión opcional.
  - Acento visual por clave booleana.

> Cambios _breaking_: si venías de una versión con `options`, migra a `settings` (misma estructura, agrupada por secciones).

---

## 📄 Licencia

[MIT](./LICENSE) © 2025 [Miguel Niño (@miguimono)](https://github.com/miguimono)
