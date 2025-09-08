# Schema 0.3.5 — Librería Angular para Visualización de JSON

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Angular](https://img.shields.io/badge/Angular-19-red.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)

**Schema** es una librería para **Angular 19** que transforma **cualquier JSON** en un **grafo navegable** (cards + enlaces) con **layouts automáticos** vía ELK, **pan/zoom** fluido y **templates personalizables**. Es **genérica**: no asume dominios como “central/cable/cto/user”; su modelado funciona con _todo_ JSON.

> URL del proyecto: **https://github.com/miguimono/schema**  
> (ajusta la URL si tu repositorio es distinto)

---

## ✨ Características

- **JSON-agnóstica**: grafica cualquier estructura y tamaño de JSON.
- **Layout automático (ELK)**: orientación **RIGHT** (izq→der) o **DOWN** (arriba→abajo), con ruteo ortogonal limpio.
- **Interacción moderna**: pan, zoom con foco en cursor, doble click para recentrar.
- **Cards personalizables**: usa tu propio `ng-template` por nodo.
- **Control de enlaces**: estilos `orthogonal`, `curve`, `line`; **curvas adaptativas** con `curveTension` y `straightThresholdDx`.
- **Previews útiles**: selección de atributos, ocultar claves, arrays de escalares como texto, badges de conteos para arrays de objetos.
- **Standalone & Signals**: componentes standalone, API reactiva y tipada.

---

## 📦 Instalación

```bash
npm install @miguimono/schema
```

---

## 🚀 Uso Rápido

### 1) Importa y usa el componente

```ts
import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SchemaComponent, SchemaOptions } from "@miguimono/schema";

@Component({
  selector: "app-demo",
  standalone: true,
  imports: [CommonModule, SchemaComponent],
  template: ` <schema [data]="data" [options]="options" (nodeClick)="onNode($event)" (linkClick)="onLink($event)"> </schema> `,
})
export class DemoComponent {
  data = {
    /* tu JSON arbitrario */
  };

  options: SchemaOptions = {
    // extracción/preview
    titleKeyPriority: ["name", "title", "id"],
    hiddenKeysGlobal: [],
    previewMaxKeys: 6,
    treatScalarArraysAsAttribute: true,
    collapseArrayContainers: true,
    collapseSingleChildWrappers: true,
    maxDepth: null,
    titleMode: "auto",

    // layout / enlaces
    layoutDirection: "RIGHT",
    layoutAlign: "center",
    linkStyle: "orthogonal", // "orthogonal" | "curve" | "line"
    linkStroke: "#019df4",
    linkStrokeWidth: 2,

    // curvas (si usas linkStyle="curve")
    curveTension: 80, // 20–200 recomendado
    straightThresholdDx: 160, // si dx < 160 → recta aunque sea "curve"

    // acento opcional por booleano
    accentByKey: null,
  };

  onNode(n: unknown) {
    console.log("node", n);
  }
  onLink(e: unknown) {
    console.log("edge", e);
  }
}
```

### 2) Template de card personalizado (opcional)

```html
<schema [data]="data" [options]="options" [cardTemplate]="cardTpl"> </schema>

<ng-template #cardTpl let-node>
  <div style="padding:8px; max-width: 240px">
    <div style="font-weight:600; font-size:12px; margin-bottom:4px">{{ node.jsonMeta?.title || node.label }}</div>

    <ng-container *ngIf="node.jsonMeta?.attributes as attrs">
      <div style="font-size: 11px; line-height: 1.3">
        <div *ngFor="let kv of (attrs | keyvalue)">
          <span style="opacity:.7; margin-right:6px">{{ kv.key }}:</span>
          <span>{{ kv.value }}</span>
        </div>
      </div>
    </ng-container>
  </div>
</ng-template>
```

---

## 🧩 API de Componentes

### `<schema>` (contenedor principal)

Entradas:

- `data: any` — JSON a graficar.
- `options: SchemaOptions` — configuración (ver tabla).
- `linkStroke?: string` — color de enlaces (por defecto del options).
- `linkStrokeWidth?: number` — grosor de enlaces (por defecto del options).
- `cardTemplate?: TemplateRef<any> | null` — template por nodo (si null, usa default).

Salidas:

- `(nodeClick)` — emite `SchemaNode` clicado.
- `(linkClick)` — emite `SchemaEdge` clicado.

Comportamiento:

- Calcula layout con ELK, mide cards en DOM y ajusta si cambian de tamaño.
- Pan/zoom con rueda (centrado en cursor) y drag; doble click para recentrar con padding.

### `<schema-card>`

- Renderiza una card posicionada por `left/top/width/height` del nodo.
- Usa `jsonMeta.title`, `jsonMeta.attributes` y `jsonMeta.arrayCounts` para el contenido por defecto.
- Aplica clases `accent-true` / `accent-false` si `options.accentByKey` apunta a un booleano en `node.data`.

### `<schema-links>`

- Dibuja `<path>` por arista dentro de `<svg>`.
- Estilos: `orthogonal` (default), `curve` (con `curveTension` y `straightThresholdDx`), `line`.

---

## ⚙️ `SchemaOptions`

| Propiedad                      | Tipo                                | Default                         | Descripción                                                              |
| ------------------------------ | ----------------------------------- | ------------------------------- | ------------------------------------------------------------------------ |
| `titleKeyPriority`             | `string[]`                          | `["name","title","id","label"]` | Prioridad para elegir el título de la card.                              |
| `hiddenKeysGlobal`             | `string[]`                          | `[]`                            | Claves a excluir del preview.                                            |
| `collapseArrayContainers`      | `boolean`                           | `true`                          | No crea card para contenedor array; conecta padre→elementos.             |
| `collapseSingleChildWrappers`  | `boolean`                           | `true`                          | Colapsa envoltorios sin escalares con un único hijo objeto.              |
| `edgeLabelFromContainerKey`    | `boolean`                           | `false`                         | (Reservado) Etiquetar aristas con clave contenedora.                     |
| `maxDepth`                     | `number \| null`                    | `null`                          | Límite de profundidad (null = sin límite).                               |
| `nodeIdStrategy`               | `"jsonpath"`                        | `"jsonpath"`                    | Estrategia de id de nodo.                                                |
| `previewMaxKeys`               | `number`                            | `4`                             | Máx. de claves en preview de la card.                                    |
| `treatScalarArraysAsAttribute` | `boolean`                           | `true`                          | Arrays de escalares como texto (join) en el padre.                       |
| `defaultNodeSize`              | `{width:number;height:number}`      | `{220,96}`                      | Tamaño base; puede ajustarse tras medir DOM.                             |
| `linkStroke`                   | `string`                            | `"#019df4"`                     | Color de enlaces.                                                        |
| `linkStrokeWidth`              | `number`                            | `2`                             | Grosor de enlaces.                                                       |
| `layoutAlign`                  | `"firstChild" \| "center"`          | `"center"`                      | Alineación vertical por capas.                                           |
| `linkStyle`                    | `"orthogonal" \| "curve" \| "line"` | `"orthogonal"`                  | Estilo de aristas.                                                       |
| `curveTension`                 | `number`                            | `80`                            | **Curvas**: “tirón” lateral (recomendado **20–200**).                    |
| `straightThresholdDx`          | `number`                            | `160`                           | **Curvas**: si `dx < umbral` → trazo **recto** (recomendado **60–240**). |
| `accentByKey`                  | `string \| null`                    | `null`                          | Clave booleana en `node.data` para acentos visuales.                     |
| `titleMode`                    | `"auto" \| "none"`                  | `"auto"`                        | Mostrar/ocultar título en card por defecto.                              |
| `layoutDirection`              | `"RIGHT" \| "DOWN"`                 | `"RIGHT"`                       | Dirección principal del layout.                                          |

---

## 🏗 Arquitectura

```
projects/schema/src/lib/
├─ models.ts                # Tipos públicos y DEFAULT_OPTIONS
├─ services/
│  ├─ json-adapter.service.ts   # JSON → grafo (nodes/edges)
│  └─ schema-layout.service.ts  # ELK: posiciones y puntos (con flip Y y anclaje)
├─ schema.component.ts      # Orquestador (pan/zoom, render, medición DOM)
├─ schema-card.component.ts # Card genérica por nodo
└─ schema-links.component.ts# Enlaces SVG (orthogonal/curve/line)
```

**Notas clave de layout**

- Se usa **ELK (layered)** con ruteo **ORTHOGONAL**.
- Tras ELK se **normalizan Y** (flip global coherente).
- Enlaces se **anclan**: source → borde **derecho** (centro Y), target → borde **izquierdo** (centro Y).
- Para `orthogonal`, la polilínea se **reconstruye** a 4 puntos limpios: H→V→H (sin “puntas raras”).

---

## 🧪 Ejemplo de integración (FrontGDM)

```html
<app-sh-schema [title]="'Esquema de daño: '" [id]="damageId!" [schemeData]="$schemeDamageIdData()?.data"> </app-sh-schema>
```

El wrapper **ShSchemaComponent** compone `SchemaOptions` (e.g. `linkStyle: "curve"`, `curveTension: 30`, `straightThresholdDx: 60`) y define un `cardTemplate` opcional.

---

## 🗂 Changelog (resumen)

### 0.3.5

- **Curvas adaptativas**: nuevo `straightThresholdDx` para forzar **recta** cuando la distancia horizontal es corta, evitando “S” artificiales.
- **Orthogonal limpio**: reconstrucción H→V→H centrada, sin puntas ni diagonales.
- **Flip Y consistente**: normalización global para nodos y aristas.
- **Documentación interna**: comentarios JSDoc y aclaraciones de API.
- **Minor**: eliminación del badge redundante “N hijos”; las pills `k: N items` permanecen.

---

## 🧠 Recomendaciones de ajuste

- **Curvas**:
  - `curveTension`: 40–120 para curvas suaves.
  - `straightThresholdDx`: 60–120 para que cercanos se dibujen **rectos**.
- **Orthogonal**:
  - Úsalo cuando quieras claridad Manhattan (diagramas técnicos/árboles densos).
- **Preview**:
  - Ajusta `previewMaxKeys` y `hiddenKeysGlobal` para mantener cards compactas.

---

## 📄 Licencia

MIT © miguimono

---

## 🙋 Soporte

Hecho con ❤️ por **miguimono**  
GitHub: **https://github.com/miguimono** • LinkedIn: **https://www.linkedin.com/in/miguimono/** • Email: **miguimono@gmail.com**
