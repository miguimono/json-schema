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
  datosJson = {
    usuarios: [
      { id: 1, nombre: "Juan Pérez", email: "juan@ejemplo.com" },
      { id: 2, nombre: "Ana García", email: "ana@ejemplo.com" },
    ],
    configuracion: { tema: "oscuro", version: "1.0" },
  };
}
```

### Configuración Avanzada

```html
<schema [data]="datosComplejos" [options]="opcionesSchema" [cardTemplate]="cardTpl" (nodeClick)="alSeleccionarNodo($event)" (linkClick)="alClickearConexion($event)"></schema>

<ng-template #cardTpl let-node>
  <div style="padding: 6px">
    <strong>{{ node.jsonMeta?.title }}</strong>
    <div *ngFor="let attr of node.jsonMeta?.attributes | keyvalue">{{ attr.key }}: {{ attr.value }}</div>
  </div>
</ng-template>
```

```ts
opcionesSchema = {
  layout: "tree" as const,
  align: "center" as const,
  gapX: 350,
  gapY: 200,
  linkStyle: "orthogonal" as const,
  jsonArrayPolicy: "fanout" as const,
  initialZoom: "fit" as const,
};
```

---

## 🏗 Arquitectura General

```
projects/schema/src/lib/
├── models.ts                # Definiciones de tipos principales
├── services/
│   ├── json-adapter.service.ts   # Conversión JSON → Grafo
│   └── schema-layout.service.ts  # Cálculos de layout
├── components/
│   ├── schema/              # Componente orquestador principal
│   ├── schema-card/         # Renderizador de nodos individuales
│   └── schema-links/        # Renderizador de conexiones
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

## 🗺 Hoja de Ruta

### Versión 0.1.0 (Actual – Schema V3)

- ✅ Render de nodos y aristas.
- ✅ Layouts `tree` y `level`.
- ✅ Pan & Zoom + Fit automático.
- ✅ Configuración vía `SchemaOptions`.
- ✅ Templates personalizados con `ng-template`.
- ✅ Poda de nodos vacíos y raíz innecesaria.

### Versión 0.2.0 (Próxima – Schema V4)

- 🔄 Auto-alto dinámico (ResizeObserver).
- 🔄 Colapsado/expansión progresiva.
- 🔄 Toolbar de acciones (zoom, reset, expand/collapse all).
- 🔄 Color rules dinámicas.
- 🔄 Theming básico con variables CSS.

### Futuro (1.x)

- 📅 Virtualización de nodos.
- 📅 Web Worker para JSON masivos.
- 📅 Exportación (PNG, SVG, JSON).
- 📅 Layouts avanzados (force, circular).

---

## 🙋‍♂️ Soporte

Hecho con ❤️ por [miguimono](https://github.com/miguimono), [linkedin](https://www.linkedin.com/in/miguimono/), [correo](miguimono@gmail.com)
