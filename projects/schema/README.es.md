# Schema - Librería Angular para Visualización de JSON

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Angular](https://img.shields.io/badge/Angular-19-red.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)

**Schema** es una potente librería para Angular 19 que transforma cualquier dato JSON en esquemas visuales interactivos y navegables. Construida con componentes standalone y patrones modernos de Angular, proporciona visualización de grafos flexible con layouts personalizables, theming y funciones avanzadas para manejar datasets grandes.

## ✨ Características Principales

- **Soporte JSON Universal**: Funciona con cualquier estructura JSON sin configuración
- **Múltiples Estrategias de Layout**: Layouts tipo árbol, por niveles, dirigido por fuerzas y circular
- **Navegación Interactiva**: Interacciones de pan, zoom y click con animaciones suaves
- **Dimensionado Inteligente de Cards**: Dimensiones dinámicas de nodos basadas en la complejidad del contenido
- **Theming Personalizable**: Temas incorporados con soporte para variables CSS
- **Optimizado para Performance**: Maneja archivos JSON grandes con expansión progresiva
- **Framework Agnóstico**: Diseñado para fácil integración en proyectos Angular existentes
- **TypeScript First**: Tipado completo y soporte para IntelliSense

## 📦 Instalación

```bash
npm install @miguimono/schema
```

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

```typescript
@Component({
  template: `
    <schema [data]="datosComplejos" [options]="opcionesSchema" [cardTemplate]="cardPersonalizada" (nodeClick)="alSeleccionarNodo($event)" (linkClick)="alClickearConexion($event)"> </schema>

    <ng-template #cardPersonalizada let-node>
      <div class="nodo-personalizado">
        <h3>{{ node.jsonMeta?.title }}</h3>
        <div *ngFor="let attr of node.jsonMeta?.attributes | keyvalue">
          <strong>{{ attr.key }}:</strong> {{ attr.value }}
        </div>
      </div>
    </ng-template>
  `,
})
export class ComponenteAvanzado {
  opcionesSchema = {
    layout: "tree" as const,
    align: "center" as const,
    gapX: 350,
    gapY: 200,
    linkStyle: "orthogonal" as const,
    jsonArrayPolicy: "fanout" as const,
    theme: "dark" as const,
    dynamicCardSizing: true,
    initialZoom: "fit" as const,
  };

  alSeleccionarNodo(evento: { node: SchemaNode; originalEvent: MouseEvent }) {
    console.log("Nodo seleccionado:", evento.node);
  }

  alClickearConexion(evento: { edge: SchemaEdge; originalEvent: MouseEvent }) {
    console.log("Conexión clickeada:", evento.edge);
  }
}
```

## 🏗 Arquitectura General

```
projects/schema/src/lib/
├── models.ts                    # Definiciones de tipos principales
├── services/
│   ├── json-adapter.service.ts  # Conversión JSON → Grafo
│   └── schema-layout.service.ts # Cálculos de layout
├── components/
│   ├── schema/                  # Componente orquestador principal
│   ├── schema-card/            # Renderizador de nodos individuales
│   └── schema-links/           # Renderizador de conexiones
└── public-api.ts               # Exports de la librería
```

### Componentes Principales

#### SchemaComponent (Contenedor Principal)

- **Propósito**: Orquesta toda la visualización
- **Características**: Controles pan/zoom, manejo de eventos, layout responsivo
- **Inputs**: `data`, `graph`, `options`, `cardTemplate`
- **Outputs**: `nodeClick`, `linkClick`, `layoutComplete`

#### SchemaCardComponent (Renderizador de Nodos)

- **Propósito**: Renderiza nodos JSON individuales como cards interactivas
- **Características**: Dimensionado dinámico, visualización de atributos, templates personalizados
- **Funciones Inteligentes**: Extracción de títulos, truncado de contenido, estilos basados en tipo

#### SchemaLinksComponent (Renderizador de Conexiones)

- **Propósito**: Dibuja conexiones entre nodos usando SVG
- **Estilos**: Línea, curva, ortogonal, escalón
- **Características**: Efectos hover, manejo de clicks, estilos dinámicos

### Servicios Principales

#### JsonAdapterService

Transforma cualquier estructura JSON en un grafo navegable:

```typescript
interface SchemaGraph {
  nodes: SchemaNode[]; // Representación visual de elementos JSON
  edges: SchemaEdge[]; // Conexiones entre nodos
  meta: {
    // Metadatos del grafo
    rootNodeId: string;
    maxDepth: number;
    totalNodes: number;
    nodeTypeCount: Record<string, number>;
  };
}
```

**Características Clave**:

- Maneja referencias circulares de forma segura
- Límites configurables de profundidad e hijos
- Manejo inteligente de arrays con diferentes políticas
- Truncado y previsualizaciones conscientes del contenido

#### SchemaLayoutService

Calcula posicionamiento óptimo de nodos:

- **Layout Árbol**: Jerárquico con relaciones padre-hijo
- **Layout por Niveles**: Agrupa nodos por profundidad JSON
- **Layout de Fuerzas**: Posicionamiento basado en física (planificado)
- **Layout Circular**: Disposición radial (planificado)

**Características**:

- Espaciado dinámico basado en contenido
- Optimización de viewport para datasets grandes
- Alineación y espacios configurables

## 📋 Opciones de Configuración

### Interfaz SchemaOptions

| Propiedad                    | Tipo                                                 | Por Defecto                        | Descripción                                        |
| ---------------------------- | ---------------------------------------------------- | ---------------------------------- | -------------------------------------------------- |
| **Layout y Posicionamiento** |                                                      |                                    |                                                    |
| `layout`                     | `'tree' \| 'level' \| 'force' \| 'circular'`         | `'tree'`                           | Estrategia del algoritmo de layout                 |
| `align`                      | `'firstChild' \| 'center' \| 'left'`                 | `'firstChild'`                     | Alineación del padre relativo a los hijos          |
| `gapX`                       | `number`                                             | `280`                              | Espaciado horizontal entre nodos                   |
| `gapY`                       | `number`                                             | `140`                              | Espaciado vertical entre nodos                     |
| `padding`                    | `number`                                             | `24`                               | Padding interno del contenedor                     |
| **Estilo Visual**            |                                                      |                                    |                                                    |
| `linkStyle`                  | `'line' \| 'curve' \| 'orthogonal' \| 'step'`        | `'orthogonal'`                     | Estilo de líneas de conexión                       |
| `theme`                      | `'light' \| 'dark' \| 'auto'`                        | `'auto'`                           | Tema visual                                        |
| `colorScheme`                | `'default' \| 'rainbow' \| 'monochrome' \| 'custom'` | `'default'`                        | Paleta de colores                                  |
| **Procesamiento JSON**       |                                                      |                                    |                                                    |
| `jsonMaxDepth`               | `number`                                             | `10`                               | Profundidad máxima de procesamiento                |
| `jsonMaxChildren`            | `number`                                             | `50`                               | Máximo de hijos por nodo                           |
| `jsonArrayPolicy`            | `'count' \| 'fanout' \| 'sample'`                    | `'count'`                          | Estrategia de manejo de arrays                     |
| `jsonArraySampleSize`        | `number`                                             | `3`                                | Tamaño de muestra para preview de array            |
| `jsonStringMaxLen`           | `number`                                             | `100`                              | Longitud de truncado de strings                    |
| `jsonTitleKeys`              | `string[]`                                           | `['name', 'title', 'label', 'id']` | Claves priorizadas para títulos de nodo            |
| `jsonIgnoreKeys`             | `string[]`                                           | `[]`                               | Claves a excluir del procesamiento                 |
| **Dimensionado Dinámico**    |                                                      |                                    |                                                    |
| `dynamicCardSizing`          | `boolean`                                            | `true`                             | Habilitar dimensionado de card basado en contenido |
| `cardMinSize`                | `{width: number, height: number}`                    | `{width: 160, height: 80}`         | Dimensiones mínimas de card                        |
| `cardMaxSize`                | `{width: number, height: number}`                    | `{width: 450, height: 320}`        | Dimensiones máximas de card                        |
| **Interacción**              |                                                      |                                    |                                                    |
| `panZoomEnabled`             | `boolean`                                            | `true`                             | Habilitar pan y zoom                               |
| `zoomMin`                    | `number`                                             | `0.25`                             | Nivel mínimo de zoom                               |
| `zoomMax`                    | `number`                                             | `2`                                | Nivel máximo de zoom                               |
| `initialZoom`                | `number \| 'fit'`                                    | `'fit'`                            | Nivel inicial de zoom                              |

## 🎨 Theming y Personalización

### Propiedades CSS Personalizadas

Schema utiliza propiedades CSS personalizadas para theming fácil:

```css
:root {
  /* Estilo de nodos */
  --schema-node-bg: #ffffff;
  --schema-node-border: #e2e8f0;
  --schema-node-text: #334155;
  --schema-node-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

  /* Estilo de conexiones */
  --schema-link-stroke: #64748b;
  --schema-link-width: 1px;
  --schema-link-hover: #3b82f6;

  /* Contenedor */
  --schema-bg: #f8fafc;
  --schema-padding: 24px;
}

/* Tema oscuro */
[data-theme="dark"] {
  --schema-node-bg: #1e293b;
  --schema-node-border: #475569;
  --schema-node-text: #f1f5f9;
  --schema-bg: #0f172a;
}
```

### Templates de Card Personalizados

Crea representaciones de nodo completamente personalizadas:

```typescript
@Component({
  template: `
    <schema [data]="datos" [cardTemplate]="templatePersonalizado"> </schema>

    <ng-template #templatePersonalizado let-node>
      <div class="mi-card-personalizada" [ngClass]="'tipo-' + node.type">
        <!-- Sección de título -->
        <div class="cabecera-card">
          <h4>{{ obtenerTituloMostrar(node) }}</h4>
          <span class="badge-tipo">{{ node.type }}</span>
        </div>

        <!-- Atributos -->
        <div class="cuerpo-card" *ngIf="node.jsonMeta?.attributes">
          <div *ngFor="let attr of node.jsonMeta.attributes | keyvalue" class="fila-atributo">
            <span class="clave">{{ attr.key }}:</span>
            <span class="valor">{{ formatearValor(attr.value) }}</span>
          </div>
        </div>

        <!-- Información de array -->
        <div class="pie-card" *ngIf="node.jsonMeta?.arrayInfo">
          <small>{{ node.jsonMeta.arrayInfo.length }} elementos</small>
        </div>
      </div>
    </ng-template>
  `,
})
export class ComponenteTemplatePersonalizado {
  obtenerTituloMostrar(node: SchemaNode): string {
    return node.jsonMeta?.title || "Sin título";
  }

  formatearValor(valor: any): string {
    if (typeof valor === "string" && valor.length > 30) {
      return valor.substring(0, 30) + "...";
    }
    return String(valor);
  }
}
```

## 📊 Performance y Datasets Grandes

### Manejo de Archivos JSON Grandes

Schema incluye varias estrategias de optimización:

```typescript
// Para datasets grandes
const opcionesOptimizadas: SchemaOptions = {
  // Limitar profundidad de procesamiento
  jsonMaxDepth: 5,
  jsonMaxChildren: 25,

  // Usar manejo eficiente de arrays
  jsonArrayPolicy: "sample",
  jsonArraySampleSize: 2,

  // Habilitar dimensionado dinámico con límites
  dynamicCardSizing: true,
  cardMaxSize: { width: 300, height: 200 },

  // Optimizar espaciado del layout
  gapX: 200,
  gapY: 100,
};
```

### Carga Progresiva (Roadmap)

Las versiones futuras soportarán:

- Expandir/colapsar a nivel de nodo
- Carga lazy de subárboles
- Scroll virtual para datasets masivos
- Procesamiento en Web Worker para operaciones intensivas de CPU

## 🛠 Desarrollo y Contribución

### Configurar Entorno de Desarrollo

```bash
# Clonar repositorio
git clone https://github.com/miguimono/schema.git
cd schema

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
ng serve

# Ejecutar tests
ng test

# Construir librería
ng build schema
```

### Estructura del Proyecto

```
schema/
├── projects/
│   ├── schema/           # Código fuente de la librería
│   └── demo/            # Aplicación demo
├── docs/                # Documentación
└── examples/           # Ejemplos de uso
```

## 🗺 Hoja de Ruta

### Versión 2.0 (Actual)

- ✅ Visualización JSON principal
- ✅ Múltiples algoritmos de layout
- ✅ Dimensionado dinámico de cards
- ✅ Soporte de temas
- ✅ Templates personalizados

### Versión 2.1 (Próxima)

- 🔄 Expansión/colapso progresivo de nodos
- 🔄 Theming avanzado con variables CSS
- 🔄 Componente toolbar con controles de zoom
- 🔄 Accesibilidad mejorada (soporte ARIA)

### Versión 3.0 (Planificada)

- 📅 Scroll virtual para datasets masivos
- 📅 Soporte Web Worker para procesamiento en background
- 📅 Sistema de plugins para tipos de nodo personalizados
- 📅 Funcionalidad de exportación (PNG, SVG, JSON)
- 📅 Layouts dirigidos por fuerzas y circulares
- 📅 Sistema de animación para transiciones de layout

<!-- ## 📚 Ejemplos y Demos

Visita nuestras [demos interactivas](https://miguimono.github.io/schema) para ver Schema en acción:

- **Uso Básico**: Estructuras JSON simples
- **Datos Complejos**: Objetos y arrays anidados
- **Datasets Grandes**: Performance con más de 1000 nodos
- **Theming Personalizado**: Modo oscuro y esquemas de color
- **Respuestas de API**: JSON del mundo real desde APIs REST -->

## 🤝 Contribuir

¡Damos la bienvenida a las contribuciones! Por favor consulta nuestra [Guía de Contribución](CONTRIBUTING.md) para más detalles.

### Formas de Contribuir

- 🐛 Reportar bugs y problemas
- 💡 Sugerir nuevas características
- 📝 Mejorar documentación
- 🧪 Añadir tests y ejemplos
- 🎨 Contribuir temas y templates

## 📄 Licencia

Licencia MIT - ver archivo [LICENSE](LICENSE) para más detalles.

## 🙋‍♂️ Soporte

- **Issues**: [GitHub Issues](https://github.com/miguimono/schema/issues)
- **Discusiones**: [GitHub Discussions](https://github.com/miguimono/schema/discussions)
- **Email**: support@miguimono.com

---

Hecho con ❤️ por [miguimono](https://github.com/miguimono)
