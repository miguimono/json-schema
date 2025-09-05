# Schema - Librería Angular para Visualización de JSON

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Angular](https://img.shields.io/badge/Angular-19-red.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)

**Schema** es una librería para Angular 19 que transforma cualquier dato JSON en esquemas visuales interactivos y navegables. Construida con componentes standalone y patrones modernos de Angular, permite convertir cualquier JSON en un grafo con nodos y conexiones, con layouts personalizables, navegación fluida y soporte básico para datasets grandes.

---

## ✨ Características Principales

- **Soporte JSON Universal**: Funciona con cualquier estructura JSON.
- **Múltiples Estrategias de Layout**: Layouts tipo árbol y por niveles (otros planificados).
- **Navegación Interactiva**: Pan, zoom y doble clic para “fit to content”.
- **Render de Cards Personalizables**: Con `ng-template` se puede redefinir cómo mostrar nodos.
- **Opciones para Arrays y Strings**: Previews recortados, políticas para arrays grandes.
- **Optimizado para JSON masivos**: Con poda de nodos vacíos y truncado de strings.
- **TypeScript First**: Tipado completo con IntelliSense.

---

## Contexto del proyecto

- Proyecto: **Schema**
- Tipo: Librería **Angular 19** (standalone components)
- Lenguaje: **TypeScript**
- Dependencias clave: **elkjs** (layouts), **d3-zoom** (interacciones), **rxjs**
- Objetivo: Visualizar cualquier JSON como un **grafo navegable** con nodos (cards) y aristas (links), con pan/zoom, layouts configurables y soporte para datos grandes.

---

## 📦 Instalación

```bash
npm install @miguimono/schema
```

---

## 🚀 Inicio Rápido

### Uso Básico

```typescript
import { SchemaComponent } from "@miguimono/schema";

@Component({
  selector: "app-demo",
  standalone: true,
  imports: [SchemaComponent],
  template: `<schema [data]="datosJson"></schema>`,
})
export class DemoComponent {
  jsonTitleKeys = ["title", "name", "id"]; // Elementos que seran titulos
  labelData = {
    title: "Titulo",
    name: "Nombre",
    id: "Identificador",
  }; // Datos a traducir

  options: SchemaOptions = {
    layout: "tree", // "tree" (jerárquico) | "level" (por profundidad) | "force"(futuro) | "circular"(futuro)
    align: "firstChild", // cómo colocar el padre respecto a los hijos: "firstChild" | "center" | "left"
    gapX: 380, // separación horizontal entre columnas (px)
    gapY: 180, // separación vertical entre nodos (px)
    padding: 24, // margen interno del lienzo (px)
    linkStyle: "orthogonal", // estilo de aristas: "line" | "curve" | "orthogonal" | "step"

    // ===== Procesamiento del JSON =====
    jsonMaxDepth: 10, // profundidad máxima a recorrer (corta/“trunca” más allá de este nivel)
    jsonMaxChildren: 50, // máximo de hijos que se procesan por nodo
    jsonStringMaxLen: 120, // longitud máxima para previews de strings (evita cards gigantes)
    jsonAttrMax: 10, // límite de atributos primitivos a mostrar por card (renderer por defecto)
    jsonArrayPolicy: "fanout", // "count" | "fanout" | "paged"(futuro) | "sample"
    jsonArraySampleSize: 2, // cuántos elementos “abre” o samplea inicialmente
    jsonTitleKeys: ["name", "title", "label", "id"], // claves que se priorizan como título de cada card
    jsonIgnoreKeys: ["_meta", "_internal"], // claves a ignorar completamente

    // ===== Visibilidad / poda =====
    hideRootArrayCard: true, // oculta la card de un array raíz []
    hideRootObjectCard: false, // (por lo general se deja false; sólo oculta si realmente es “vacío”)
    hideEmptyNodes: true, // poda nodos sin contenido (defensa contra ruido)

    // ===== Interacciones (Pan & Zoom) =====
    panZoomEnabled: true, // habilita arrastrar y hacer zoom con la rueda
    zoomMin: 0.25, // zoom mínimo
    zoomMax: 3, // zoom máximo
    zoomStep: 0.12, // paso incremental de zoom (rueda del mouse)
    initialZoom: "fit", // número (ej. 1) o "fit" para ajustar al contenido
    fitPadding: 24, // margen alrededor del contenido al hacer “fit”

    // ===== Theming (opcional) =====
    theme: "auto", // "light" | "dark" | "auto"
    colorScheme: "default", // "default" | "rainbow" | "monochrome" | "custom"
    customColors: {
      // aplica si colorScheme === "custom"
      object: "#6b7280",
      array: "#2563eb",
      primitive: "#16a34a",
      root: "#111827",
    },

    // ===== Rendimiento (futuro/optativo) =====
    virtualization: false, // si true, renderiza sólo lo visible en viewport
    lazyLoading: false, // carga perezosa de subárboles
    collapseThreshold: 9999, // auto-colapsa nodos con más de N hijos (si aplicas colapsado)
  };
}
```

### Configuración Avanzada

```html
<schema [data]="schemeData" [options]="options" [linkStroke]="stroke!" [linkStrokeWidth]="strokeWidth!" (nodeClick)="onNode($event)" (linkClick)="onLink($event)" [cardTemplate]="jsonTitleKeys()?.length ? cardTplCustomEs : null"></schema>
<section>
  <ng-template #cardTplCustomEs let-node>
    <div style="padding: 8px; max-width: 220px">
      <div style="font-weight: 600; font-size: 13px; margin-bottom: 4px">
        <span>{{ node.jsonMeta?.title || node.data?.name }}</span>
      </div>

      <ng-container *ngIf="node.jsonMeta?.attributes as attrs">
        <div style="font-size: 11px; line-height: 1.3">
          <ng-container *ngFor="let kv of attrs | keyvalue | slice: 0 : 10">
            <div>
              <span style="opacity: 0.7; margin-right: 4px">{{ labelEs(kv.key) }}:</span>
              <span>{{ kv.value }}</span>
            </div>
          </ng-container>
          <div *ngIf="(attrs | keyvalue).length > 10" style="font-size: 10px; opacity: 0.6; margin-top: 4px">+{{ (attrs | keyvalue).length - 10 }} más</div>
        </div>
      </ng-container>

      <div *ngIf="node.jsonMeta?.preview" style="font-size: 11px; opacity: 0.75; margin-top: 6px">{{ node.jsonMeta?.preview }}</div>
    </div>
  </ng-template>
</section>
```

```ts

```

---

## 🏗 Arquitectura General

```
projects/schema/src/lib/
├── models.ts → modelos base (`SchemaNode`, `SchemaEdge`, `SchemaGraph`,
├── services/
│   ├── json-adapter.service.ts → convierte JSON → grafo.
│   └── schema-layout.service.ts → calcula posiciones de nodos (tree, level).
├── components/
│   ├── schema/  → contenedor principal, maneja pan/zoom, renderiza nodos y aristas.
│   ├── schema-card/ → render genérico de cada nodo como card.
│   └── schema-links/ → render de aristas SVG.
└── public-api.ts
```

### Componentes

- **SchemaComponent**: Orquestador principal (pan/zoom, render de nodos + links, fit to content).
- **SchemaCardComponent**: Render genérico de cada nodo (atributos, badges de arrays, templates).
- **SchemaLinksComponent**: Render de aristas SVG (line, curve, orthogonal, step).

### Servicios

- **JsonAdapterService**: Convierte JSON en grafo (`SchemaGraph`).
- **SchemaLayoutService**: Calcula posiciones según layout (`tree`, `level`).

---

## 📋 Opciones de Configuración

| Propiedad             | Tipo                                          | Default                 | Descripción                     |
| --------------------- | --------------------------------------------- | ----------------------- | ------------------------------- |
| `layout`              | `'tree' \| 'level'`                           | `'tree'`                | Estrategia de layout.           |
| `align`               | `'firstChild' \| 'center' \| 'left'`          | `'firstChild'`          | Alineación padre ↔ hijos.       |
| `gapX`                | `number`                                      | `280`                   | Separación horizontal (px).     |
| `gapY`                | `number`                                      | `140`                   | Separación vertical (px).       |
| `padding`             | `number`                                      | `24`                    | Padding interno del lienzo.     |
| `linkStyle`           | `'line' \| 'curve' \| 'orthogonal' \| 'step'` | `'orthogonal'`          | Estilo de aristas.              |
| `jsonMaxDepth`        | `number`                                      | `10`                    | Profundidad máxima procesada.   |
| `jsonMaxChildren`     | `number`                                      | `50`                    | Máx. hijos por nodo.            |
| `jsonArrayPolicy`     | `'count' \| 'fanout' \| 'sample'`             | `'count'`               | Estrategia para arrays grandes. |
| `jsonArraySampleSize` | `number`                                      | `3`                     | Elementos a mostrar en arrays.  |
| `jsonStringMaxLen`    | `number`                                      | `100`                   | Recorte de strings largos.      |
| `jsonTitleKeys`       | `string[]`                                    | `["name","title","id"]` | Claves preferidas para títulos. |
| `jsonIgnoreKeys`      | `string[]`                                    | `[]`                    | Claves a excluir.               |
| `panZoomEnabled`      | `boolean`                                     | `true`                  | Habilitar pan y zoom.           |
| `zoomMin`             | `number`                                      | `0.25`                  | Zoom mínimo.                    |
| `zoomMax`             | `number`                                      | `2`                     | Zoom máximo.                    |
| `zoomStep`            | `number`                                      | `0.1`                   | Paso de zoom (rueda).           |
| `initialZoom`         | `number \| 'fit'`                             | `'fit'`                 | Zoom inicial.                   |
| `fitPadding`          | `number`                                      | `24`                    | Margen extra al hacer “fit”.    |

---

## 📊 Performance y JSON grandes

- Truncado de strings (`jsonStringMaxLen`).
- Poda de nodos vacíos (`hideEmptyNodes`).
- Límites de profundidad (`jsonMaxDepth`) e hijos (`jsonMaxChildren`).
- Políticas de arrays (`jsonArrayPolicy`).

---

## 🗺 Backlog

### Versión 0.1.0

- ✅ Render de nodos y aristas.
- ✅ Layouts `tree` y `level`.
- ✅ Pan & Zoom + Fit automático.
- ✅ Configuración vía `SchemaOptions`.
- ✅ Templates personalizados con `ng-template`.
- ✅ Poda de nodos vacíos y raíz innecesaria.

### Versión 0.2.0 (Actual)

- 🔄 Auto-alto dinámico (ResizeObserver).
- 🔄 Colapsado/expansión progresiva.
- 🔄 Toolbar de acciones (zoom, reset, expand/collapse all).
- 🔄 Color rules dinámicas.
- 🔄 Theming básico con variables CSS.

### Futuro (0.3.x)

- 📅 Virtualización de nodos.
- 📅 Web Worker para JSON masivos.
- 📅 Exportación (PNG, SVG, JSON).
- 📅 Layouts avanzados (force, circular).

### Temas a optimizar

- Los arrays generan una card extra (ej. `Array[5]`) que muchas veces es innecesaria → necesitamos resolverlo en 0.2.0 con una estrategia más simple y parametrizable.
- Falta colapsado/expansión progresiva de nodos.
- No existe toolbar unificada para acciones básicas.
- No existe coloración por reglas de datos.
- No hay soporte real para theming CSS variables.

---

## 🙋‍♂️ Soporte

Hecho con ❤️ por [miguimono](https://github.com/miguimono), [linkedin](https://www.linkedin.com/in/miguimono/), [correo](miguimono@gmail.com)
