import { TemplateRef } from '@angular/core';

/**
 * Tipos de nodos genéricos basados en la estructura JSON.
 */
export type SchemaNodeType =
  | 'json-object' // Objetos JSON {}
  | 'json-array' // Arrays JSON []
  | 'json-primitive' // Valores primitivos (string, number, boolean, null)
  | 'json-root'; // Nodo raíz especial

/**
 * Categorías de datos para agrupación y styling.
 */
export type SchemaCategory =
  | 'container' // Objetos y arrays que contienen otros elementos
  | 'leaf' // Valores primitivos sin hijos
  | 'collection' // Arrays específicamente
  | 'structure'; // Objetos específicamente

/**
 * Nodo del esquema (genérico y autosuficiente).
 * Mantiene datos, metadatos JSON y estado visual básico.
 */
export interface SchemaNode {
  id: string;
  type: SchemaNodeType;
  category: SchemaCategory;

  /** Dato original asociado a este nodo (si aplica). */
  data?: unknown;

  /** Estado visual básico. */
  state?: {
    collapsed?: boolean;
    selected?: boolean;
    highlighted?: boolean;
    visible?: boolean;
  };

  /** Dimensiones medidas (útil para evitar solapes). */
  size?: {
    width: number;
    height: number;
  };

  /** Información jerárquica opcional para layouts. */
  level?: number; // Profundidad en el árbol (0 = raíz)
  rank?: number; // Orden relativo dentro del mismo nivel

  /** Metadatos específicos del JSON. */
  jsonMeta: {
    /** Tipo de estructura JSON (paralelo a type, pero explícito). */
    kind: 'object' | 'array' | 'primitive' | 'root';

    /** Contexto dentro del padre. */
    key?: string; // Clave en objeto padre
    index?: number; // Índice en array padre
    path: string; // Ruta completa (ej: "fruits[0].details")

    /** Presentación. */
    title: string; // Título mostrado en la card
    titleKey?: string; // Clave que originó el título (para no duplicar en atributos)

    /** Contenido del nodo. */
    attributes?: Record<string, unknown>; // Propiedades primitivas del objeto
    children?: string[]; // IDs de nodos hijos

    /** Info de arrays. */
    arrayInfo?: {
      length: number;
      itemType?: 'mixed' | 'object' | 'primitive';
      sample?: unknown[]; // Pequeña muestra para preview
    };

    /** Info de objetos. */
    objectInfo?: {
      keyCount: number;
      hasNestedStructures: boolean;
    };

    /** Flags y preview. */
    preview?: string; // Texto de preview cuando está colapsado
    depth: number; // Profundidad desde la raíz
    isLeaf: boolean; // No tiene hijos
    isEmpty: boolean; // Array/objeto vacío
  };
}

/**
 * Conexión entre nodos (arista).
 */
export interface SchemaEdge {
  id: string;
  sourceId: string;
  targetId: string;

  /** Estado visual opcional. */
  state?: {
    highlighted?: boolean;
    selected?: boolean;
    visible?: boolean;
  };

  /** Metadatos de la conexión. */
  meta?: {
    relationship: 'parent-child' | 'reference' | 'array-item';
    label?: string; // Etiqueta opcional (clave, índice, etc.)
    weight?: number; // Peso para algoritmos de layout
  };
}

/**
 * Grafo completo del esquema.
 */
export interface SchemaGraph {
  nodes: SchemaNode[];
  edges: SchemaEdge[];

  /** Metadatos opcionales del grafo. */
  meta?: {
    rootNodeId?: string;
    maxDepth: number;
    totalNodes: number;
    totalEdges: number;
    nodeTypeCount: Record<SchemaNodeType, number>;
  };
}

/**
 * Políticas para manejo de arrays grandes.
 */
export type JsonArrayPolicy =
  | 'count' // Solo mostrar contador: "Array[100]"
  | 'fanout' // Expandir algunos elementos: mostrar N primeros
  | 'paged' // Paginación por páginas
  | 'sample'; // Muestra representativa + contador

/**
 * Estrategias de layout.
 */
export type LayoutStrategy =
  | 'tree' // Layout jerárquico tipo árbol
  | 'level' // Agrupación por niveles/profundidad
  | 'force' // Layout basado en fuerzas (futuro)
  | 'circular'; // Layout circular (futuro)

/**
 * Estilos de conexiones.
 */
export type LinkStyle =
  | 'line' // Líneas rectas
  | 'curve' // Curvas suaves (bezier)
  | 'orthogonal' // Líneas en ángulo recto
  | 'step'; // Estilo escalonado

/**
 * Configuración del esquema (opciones de comportamiento y visual).
 * Mantener simple y con buenos defaults.
 */
export interface SchemaOptions {
  // Layout y espaciado
  gapX?: number; // Separación horizontal entre nodos
  gapY?: number; // Separación vertical entre nodos
  padding?: number; // Padding del contenedor
  layout?: LayoutStrategy; // Estrategia de posicionamiento
  linkStyle?: LinkStyle; // Estilo de las conexiones
  align?: 'firstChild' | 'center' | 'left'; // Alineación de nodos

  // Procesamiento JSON
  jsonMaxDepth?: number; // Profundidad máxima (default: 10)
  jsonMaxChildren?: number; // Máximo hijos por nodo (default: 50)
  jsonStringMaxLen?: number; // Longitud máxima de strings (default: 100)
  jsonAttrMax?: number; // Máximo atributos visibles por card (default: 10)
  jsonArrayPolicy?: JsonArrayPolicy; // Manejo de arrays grandes
  jsonArraySampleSize?: number; // Ítems en sample (default: 3)
  jsonTitleKeys?: string[]; // Claves priorizadas como título
  jsonIgnoreKeys?: string[]; // Claves a ignorar completamente
  showNodeTitle?: boolean;

  // Control de visibilidad
  hideRootArrayCard?: boolean; // Ocultar card del array raíz
  hideRootObjectCard?: boolean; // Ocultar card del objeto raíz
  hideEmptyNodes?: boolean; // Poda de nodos vacíos

  // Pan & Zoom
  panZoomEnabled?: boolean; // Habilitar pan/zoom
  zoomMin?: number; // Zoom mínimo
  zoomMax?: number; // Zoom máximo
  zoomStep?: number; // Incremento por scroll
  initialZoom?: number | 'fit'; // Zoom inicial (número o "fit")
  fitPadding?: number; // Padding al ajustar a contenido

  // Personalización visual
  theme?: 'light' | 'dark' | 'auto';
  colorScheme?: 'default' | 'rainbow' | 'monochrome' | 'custom';
  customColors?: {
    object?: string;
    array?: string;
    primitive?: string;
    root?: string;
  };

  // Rendimiento en JSON masivos
  virtualization?: boolean; // Render virtual
  lazyLoading?: boolean; // Carga perezosa de nodos
  collapseThreshold?: number; // Auto-colapsar nodos con más de N hijos
}

/**
 * Dimensiones calculadas del canvas/grafo.
 */
export interface SchemaSize {
  width: number;
  height: number;
}

/** Punto en coordenadas 2D. */
export interface Point {
  x: number;
  y: number;
}

/** Mapa de posiciones de nodos (id -> punto). */
export type PositionsMap = Map<string, Point>;

/** Información de viewport (para zoom/pan/virtualización). */
export interface ViewportInfo {
  x: number;
  y: number;
  width: number;
  height: number;
  zoom: number;
}

/**
 * Eventos del esquema.
 */
export interface SchemaEvents {
  nodeClick?: (node: SchemaNode, event: MouseEvent) => void;
  nodeDoubleClick?: (node: SchemaNode, event: MouseEvent) => void;
  nodeHover?: (node: SchemaNode | null, event: MouseEvent) => void;
  edgeClick?: (edge: SchemaEdge, event: MouseEvent) => void;
  backgroundClick?: (event: MouseEvent) => void;
  zoomChange?: (zoom: number) => void;
  panChange?: (position: Point) => void;
}

/**
 * Configuración de templates personalizados (opcional).
 */
export interface SchemaTemplateConfig {
  cardTemplate?: TemplateRef<unknown>;
  nodeTemplate?: TemplateRef<unknown>;
  attributeTemplate?: TemplateRef<unknown>;
  arrayPreviewTemplate?: TemplateRef<unknown>;
}

/* ============================================================================
 * Defaults sencillos + helper para aplicar defaults
 * ==========================================================================*/

/** Valores por defecto recomendados (simples). */
export const SCHEMA_DEFAULTS: SchemaOptions = {
  // Layout
  gapX: 32,
  gapY: 24,
  padding: 16,
  layout: 'tree',
  linkStyle: 'orthogonal',
  align: 'firstChild',

  // JSON
  jsonMaxDepth: 10,
  jsonMaxChildren: 50,
  jsonStringMaxLen: 100,
  jsonAttrMax: 10,
  jsonArrayPolicy: 'sample',
  jsonArraySampleSize: 3,
  jsonTitleKeys: ['name', 'title', 'id'],
  jsonIgnoreKeys: [],

  // Visibilidad
  hideRootArrayCard: true,
  hideRootObjectCard: false,
  hideEmptyNodes: true,

  // Pan & Zoom
  panZoomEnabled: true,
  zoomMin: 0.1,
  zoomMax: 3,
  zoomStep: 0.1,
  initialZoom: 'fit',
  fitPadding: 32,

  // Theming
  theme: 'auto',
  colorScheme: 'default',

  // Rendimiento
  virtualization: false,
  lazyLoading: true,
  collapseThreshold: 100,
};

/**
 * Aplica defaults a un conjunto de opciones.
 * Útil para garantizar valores al consumir en servicios/componentes.
 */
export function withSchemaDefaults(options?: SchemaOptions): SchemaOptions {
  return { ...SCHEMA_DEFAULTS, ...(options || {}) };
}
