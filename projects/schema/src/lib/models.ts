// ============================================
// projects/schema/src/lib/models.ts
// ============================================
// Define los tipos base del grafo (nodos, aristas), el contenedor NormalizedGraph,
// y la interfaz de configuración SchemaOptions con sus valores por defecto.
// No hay lógica; solo tipos y constantes.
// ============================================

import { TemplateRef } from '@angular/core';

/** Alineación vertical del layout por capas. */
export type LayoutAlign = 'firstChild' | 'center';

/** Estilo de enlace a renderizar. */
export type LinkStyle = 'orthogonal' | 'curve' | 'line';

/** Modo de título en la card de cada nodo. */
export type TitleMode = 'auto' | 'none';

/** Dirección principal del layout en ELK. */
export type LayoutDirection = 'RIGHT' | 'DOWN';

/**
 * Nodo del grafo visualizado.
 * - `jsonMeta` contiene información para el render (título, atributos, conteos de arrays).
 * - `x,y,width,height` son asignados por el servicio de layout.
 */
export interface SchemaNode {
  /** Identificador estable del nodo (por defecto: jsonPath). */
  id: string;
  /** Texto base de etiqueta del nodo (usualmente coincide con el título elegido). */
  label: string;
  /** Ruta JSON única del nodo dentro del input. */
  jsonPath: string;
  /** Objeto de datos original asociado al nodo. */
  data: Record<string, any>;
  /** Metadatos de renderado y conteos auxiliares. */
  jsonMeta?: {
    /** Título elegido (por prioridad o primer escalar). */
    title?: string;
    /** Atributos "preview" (pares clave/valor). */
    attributes?: Record<string, any>;
    /** Texto de preview opcional (no usado por defecto). */
    preview?: string;
    /** Cantidad de hijos objeto/híbridos directos (no escalares). */
    childrenCount?: number;
    /** Conteo por clave de arrays no escalares (para "k: N items"). */
    arrayCounts?: Record<string, number>;
  };
  /** Posición X (asignada por layout). */
  x?: number;
  /** Posición Y (asignada por layout). */
  y?: number;
  /** Ancho (puede ajustarse tras medir DOM). */
  width?: number;
  /** Alto (puede ajustarse tras medir DOM). */
  height?: number;
  /**  */
  linkStyle?: LinkStyle;
}

/**
 * Arista del grafo entre dos nodos.
 * - `points` es la secuencia de puntos a dibujar (calculada por el layout service).
 */
export interface SchemaEdge {
  /** Identificador estable de la arista (por ejemplo: `${source}__${target}`). */
  id: string;
  /** Id del nodo fuente. */
  source: string;
  /** Id del nodo destino. */
  target: string;
  /** Etiqueta opcional de la arista. */
  label?: string;
  /** Puntos ordenados para el render del camino SVG. */
  points?: Array<{ x: number; y: number }>;
}

/** Contenedor del grafo normalizado con listas de nodos/aristas. */
export interface NormalizedGraph {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  /** Espacio para metadatos adicionales de layout o render. */
  meta?: Record<string, any>;
}

/**
 * Opciones de configuración de extracción, layout y render.
 * Los defaults están definidos en `DEFAULT_OPTIONS`.
 */
export interface SchemaOptions {
  /** Prioridad de claves para titular entidades (equivalente a jsonTitleKeys en la implementación). */
  titleKeyPriority: string[];

  /** Claves globales a ocultar al construir atributos (no se muestran en la card). */
  hiddenKeysGlobal?: string[];

  /** Si true, no crea nodos contenedores para arrays; conecta el padre con cada elemento. */
  collapseArrayContainers: boolean;

  /**
   * Si true, omite objetos "envoltorio" sin escalares ni título y con 1 solo hijo objeto.
   * Ej.: { wrapper: { ...objeto... } } → colapsa a { ...objeto... }.
   */
  collapseSingleChildWrappers: boolean;

  /** Si true, permite etiquetar aristas con la clave contenedora (no usado por defecto). */
  edgeLabelFromContainerKey: boolean;

  /** Límite de profundidad (null = sin límite). */
  maxDepth: number | null;

  /** Estrategia de id de nodos (actualmente fija: "jsonpath"). */
  nodeIdStrategy: 'jsonpath';

  /** Cantidad máxima de claves a mostrar en el preview por card. */
  previewMaxKeys: number;

  /** Si true, arrays de escalares se muestran como atributo (join) en el padre. */
  treatScalarArraysAsAttribute: boolean;

  /** Tamaño por defecto de nodo para layout (puede ser refinado tras medir DOM). */
  defaultNodeSize?: { width: number; height: number };

  /** Color de stroke de enlaces. */
  linkStroke?: string;
  /** Grosor de stroke de enlaces. */
  linkStrokeWidth?: number;

  /** Alineación vertical del layout por capas. */
  layoutAlign?: LayoutAlign;

  /** Estilo de enlace a renderizar. */
  linkStyle?: LinkStyle;

  /**
   * Tensión de curvas cuando `linkStyle = "curve"`.
   * - Rango efectivo interno: 20–200.
   * - Valores bajos (20–40): curvas muy suaves.
   * - Medios (60–120): curvas marcadas.
   * - Altos (140–200): curvas abiertas.
   */
  curveTension?: number;

  /**
   * Clave booleana del objeto `data` para acentuar la card:
   * - true  → clase "accent-true"
   * - false → clase "accent-false"
   */
  accentByKey?: string | null;

  /** Modo de título de la card: "auto" (por defecto) u "none" (oculto). */
  titleMode?: TitleMode;

  /** Dirección principal del layout: "RIGHT" (izq→der) o "DOWN" (arriba→abajo). */
  layoutDirection?: LayoutDirection;

  /**
   * Umbral horizontal (en px) para decidir recta vs curva cuando `linkStyle = "curve"`.
   * - Si `dx < straightThresholdDx` → se dibuja **recta**.
   * - Si `dx ≥ straightThresholdDx` → se dibuja **curva** (afectada por `curveTension`).
   * - Rango recomendado: 60–240 (no forzado internamente).
   */
  straightThresholdDx?: number;
}

/**
 * Valores por defecto para `SchemaOptions`.
 * Estos defaults están pensados para graficar JSON arbitrario con buena legibilidad.
 */
export const DEFAULT_OPTIONS: SchemaOptions = {
  titleKeyPriority: ['name', 'title', 'id', 'label'],
  hiddenKeysGlobal: [],
  collapseArrayContainers: true,
  collapseSingleChildWrappers: true,
  edgeLabelFromContainerKey: false,
  maxDepth: null,
  nodeIdStrategy: 'jsonpath',
  previewMaxKeys: 4,
  treatScalarArraysAsAttribute: true,
  defaultNodeSize: { width: 220, height: 96 },

  linkStroke: '#019df4',
  linkStrokeWidth: 2,

  layoutAlign: 'center',
  linkStyle: 'orthogonal',
  curveTension: 80, // rango efectivo interno: 20–200
  accentByKey: null,
  titleMode: 'auto',
  layoutDirection: 'RIGHT',

  straightThresholdDx: 160, // recomendado: 60–240
};
