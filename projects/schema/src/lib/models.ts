// projects/schema/src/lib/models.ts

/**
 * Dirección de layout del grafo.
 * - RIGHT: flujo de izquierda → derecha
 * - DOWN:  flujo de arriba → abajo
 */
export type LayoutDirection = 'RIGHT' | 'DOWN';

/**
 * Alineación del padre con respecto a sus hijos:
 * - firstChild: centra al padre con el primer hijo (orden según childOrder)
 * - center:     centra al padre con el promedio vertical de sus hijos
 */
export type LayoutAlign = 'firstChild' | 'center';

/**
 * Estilo visual de los enlaces/aristas.
 * - orthogonal: codos con ruteo en L
 * - curve:      curva cúbica con controles laterales
 * - line:       línea recta
 */
export type LinkStyle = 'orthogonal' | 'curve' | 'line';

/**
 * Modo de título de la card.
 * - auto: intenta derivar el título a partir de claves o primer escalar
 * - none: no mostrar título en el template por defecto
 */
export type TitleMode = 'auto' | 'none';

/**
 * Nodo del grafo normalizado.
 * Generado por el JsonAdapterService y posicionado por el SchemaLayoutService.
 */
export interface SchemaNode {
  /** Identificador único del nodo. Por defecto se usa el jsonPath. */
  id: string;
  /** Etiqueta principal del nodo (se muestra en la card). */
  label: string;
  /** Ruta JSON que dio origen al nodo (ej: $.central.cables[0]). */
  jsonPath: string;
  /** Objeto original asociado al nodo (para plantillas custom). */
  data: Record<string, any>;

  /**
   * Metadatos calculados durante la normalización:
   * - title: título sugerido (usado por defecto si titleMode !== 'none')
   * - attributes: pares clave/valor derivadas (escalares y arrays de escalares)
   * - childrenCount: número de hijos directos en el grafo
   * - arrayCounts: tamaños de arrays no escalares por clave
   * - childOrder: posición relativa del nodo respecto a sus hermanos
   */
  jsonMeta?: {
    title?: string;
    attributes?: Record<string, any>;
    childrenCount?: number;
    arrayCounts?: Record<string, number>;
    childOrder?: number;
  };

  /** Posición y tamaño asignados por el layout/medición. */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * Arista del grafo normalizado.
 * Une dos nodos por sus IDs. Los puntos de dibujo se calculan tras el layout.
 */
export interface SchemaEdge {
  /** Identificador único del edge. */
  id: string;
  /** ID del nodo origen. */
  source: string;
  /** ID del nodo destino. */
  target: string;
  /** Etiqueta opcional. */
  label?: string;
  /** Puntos de dibujo del path SVG (start/bends/end). */
  points?: Array<{ x: number; y: number }>;
}

/**
 * Estructura del grafo normalizado (nodos + aristas) con metadatos auxiliares.
 */
export interface NormalizedGraph {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  /**
   * Metadatos auxiliares. Por ejemplo:
   * - pinY: Record<nodeId, y> para fijar verticalmente ciertos hijos al relayout.
   */
  meta?: Record<string, any>;
}

/**
 * Opciones planas históricas (compatibilidad).
 * Se recomienda usar SchemaSettings, pero estas opciones siguen vigentes.
 */
export interface SchemaOptions {
  // ===== Extracción / preview =====
  /** Prioridad de claves para derivar título (ej: ["name","title","id"]). */
  titleKeyPriority: string[];
  /** Claves globales ocultas en el preview de atributos. */
  hiddenKeysGlobal?: string[];
  /** Si true, colapsa contenedores que sean arrays "envolventes" innecesarios. */
  collapseArrayContainers: boolean;
  /** Si true, colapsa wrappers de único hijo objeto (sin escalares). */
  collapseSingleChildWrappers: boolean;
  /** Profundidad máxima de recorrido. null = sin límite. */
  maxDepth: number | null;
  /** Máximo de atributos a previsualizar. */
  previewMaxKeys: number;
  /** Si true, arrays de escalares se muestran como atributo concatenado. */
  treatScalarArraysAsAttribute: boolean;

  // ===== Tamaño base de las cards =====
  defaultNodeSize?: { width: number; height: number };

  // ===== Enlaces / layout =====
  /** Color del trazo de aristas. */
  linkStroke?: string;
  /** Grosor de aristas. */
  linkStrokeWidth?: number;
  /** Alineación padre ↔ hijos. */
  layoutAlign?: LayoutAlign;
  /** Estilo de arista (orthogonal/curve/line). */
  linkStyle?: LinkStyle;
  /** Tensión de curva para linkStyle='curve'. */
  curveTension?: number;
  /** Clave booleana para acentuar cards por valor true/false/null. */
  accentByKey?: string | null;
  /** Si true, aplica fondo además del borde al acentuar. */
  accentFill?: boolean;
  /** Si true, invierte mapping de colores (true↔false). */
  accentInverse?: boolean;
  /** Si true, colorea cuando v===true. */
  showColorTrue?: boolean;
  /** Si true, colorea cuando v===false. */
  showColorFalse?: boolean;
  /** Si true, colorea cuando v===null. */
  showColorNull?: boolean;
  /** Modo de título en card por defecto. */
  titleMode?: TitleMode;
  /** Dirección del layout (RIGHT/DOWN). */
  layoutDirection?: LayoutDirection;
  /**
   * Umbral horizontal (dx) bajo el cual un enlace 'curve' se dibuja recto.
   * Evita curvas raras cuando los nodos están muy cerca.
   */
  straightThresholdDx?: number;

  // ===== Auto-resize de cards =====
  /** Si true, mide DOM y relayout hasta estabilizar tamaños. */
  autoResizeCards?: boolean;
  /** Ancho máximo de card (limita crecimiento). */
  maxCardWidth?: number | null;
  /** Alto máximo de card (limita crecimiento). */
  maxCardHeight?: number | null;
  /** Claves cuyos valores NO deben hacer wrap de línea. */
  noWrapKeys?: string[];

  // ===== Alineaciones opcionales =====
  /** Ajusta verticalmente los hijos del root a una misma línea central. */
  snapRootChildrenY?: boolean;
  /** Alinea segmentos de cadenas lineales (out=1,in=1) para trazar recto. */
  snapChainSegmentsY?: boolean;

  // ===== Colchón extra al medir DOM =====
  /** px extra a sumar a scrollWidth. */
  measureExtraWidthPx?: number;
  /** px extra a sumar a scrollHeight. */
  measureExtraHeightPx?: number;

  // ===== Depuración =====
  debug?: {
    /** Si true, log de medición. */
    measure?: boolean;
    /** Si true, log de layout/relayout. */
    layout?: boolean;
    /** Si true, pinta bounds de cards. */
    paintBounds?: boolean;
    /** Si true, expone `schemaDebug` en window. */
    exposeOnWindow?: boolean;
  };
}

/**
 * Contenedor recomendado de settings por secciones.
 * Si no se pasa, se aplican defaults seguros desde DEFAULT_OPTIONS.
 */
export interface SchemaSettings {
  /** Colores y acentos. */
  colors?: {
    linkStroke?: string;
    linkStrokeWidth?: number;
    accentByKey?: string | null;
    accentFill?: boolean;
    accentInverse?: boolean;
    showColorTrue?: boolean;
    showColorFalse?: boolean;
    showColorNull?: boolean;
  };
  /** Parámetros visuales del layout y ruteo. */
  layout?: {
    layoutDirection?: LayoutDirection;
    layoutAlign?: LayoutAlign;
    linkStyle?: LinkStyle;
    curveTension?: number;
    straightThresholdDx?: number;
    snapRootChildrenY?: boolean;
    snapChainSegmentsY?: boolean;
  };
  /** Cómo extraer/mostrar datos en cards y medición. */
  dataView?: {
    titleKeyPriority?: string[];
    hiddenKeysGlobal?: string[];
    titleMode?: TitleMode;
    previewMaxKeys?: number;
    treatScalarArraysAsAttribute?: boolean;
    collapseArrayContainers?: boolean;
    collapseSingleChildWrappers?: boolean;
    maxDepth?: number | null;
    defaultNodeSize?: { width: number; height: number };
    noWrapKeys?: string[];
    maxCardWidth?: number | null;
    maxCardHeight?: number | null;
    autoResizeCards?: boolean;
    measureExtraWidthPx?: number;
    measureExtraHeightPx?: number;

    /**
     * Si es true, se habilita el botón de colapso/expansión por card (si tiene hijos).
     * Si es false o no se define, no se muestra ningún control (comportamiento idéntico a antes).
     */
    enableCollapse?: boolean;
  };
  /** Estados y textos de mensajes/overlays. */
  messages?: {
    isLoading?: boolean;
    isError?: boolean;
    emptyMessage?: string;
    loadingMessage?: string;
    errorMessage?: string;
  };
  /** Vista/viewport del esquema. */
  viewport?: {
    /** Altura del viewport del esquema (px). Default 800. */
    height?: number;
    /** Altura mínima del viewport (px). Default 480. */
    minHeight?: number;
    /** Muestra la toolbar integrada. Default true. */
    showToolbar?: boolean;
  };
  /** Flags de depuración. */
  debug?: {
    measure?: boolean;
    layout?: boolean;
    paintBounds?: boolean;
    exposeOnWindow?: boolean;
  };
}

/** Valores por defecto seguros para renderizar y medir el grafo. */
export const DEFAULT_OPTIONS: SchemaOptions = {
  // Extracción / preview
  titleKeyPriority: ['name', 'title', 'id', 'label'],
  hiddenKeysGlobal: [],
  collapseArrayContainers: true,
  collapseSingleChildWrappers: true,
  maxDepth: null,
  previewMaxKeys: 4,
  treatScalarArraysAsAttribute: true,

  // Tamaño base
  defaultNodeSize: { width: 220, height: 96 },

  // Enlaces / layout
  linkStroke: '#019df4',
  linkStrokeWidth: 2,
  layoutAlign: 'center',
  linkStyle: 'orthogonal',
  curveTension: 80,
  accentByKey: null,
  accentFill: false,
  accentInverse: false,
  showColorTrue: false,
  showColorFalse: false,
  showColorNull: false,
  titleMode: 'auto',
  layoutDirection: 'RIGHT',
  straightThresholdDx: 160,

  // Auto-resize
  autoResizeCards: true,
  maxCardWidth: null,
  maxCardHeight: null,
  noWrapKeys: [],

  // Alineaciones
  snapRootChildrenY: false,
  snapChainSegmentsY: true,

  // Colchón medición
  measureExtraWidthPx: 24,
  measureExtraHeightPx: 0,

  // Debug
  debug: {
    measure: false,
    layout: false,
    paintBounds: false,
    exposeOnWindow: false,
  },
};
