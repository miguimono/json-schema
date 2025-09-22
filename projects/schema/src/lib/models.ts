// projects/schema/src/lib/models.ts
// URL: projects/schema/src/lib/models.ts

/**
 * Dirección del layout del grafo.
 * - 'RIGHT': flujo izquierda → derecha.
 * - 'DOWN':  flujo arriba → abajo.
 */
export type LayoutDirection = "RIGHT" | "DOWN";

/**
 * Alineación del padre respecto a sus hijos.
 * - 'firstChild': centro del padre alineado con el primer hijo (orden JSON).
 * - 'center':     centro del padre alineado con el promedio de los hijos.
 */
export type LayoutAlign = "firstChild" | "center";

/**
 * Estilo visual de las aristas.
 * - 'orthogonal': segmentos tipo “L”.
 * - 'curve':      curva cúbica.
 * - 'line':       recta simple.
 */
export type LinkStyle = "curve" | "orthogonal" | "line";

/** Nodo del grafo normalizado. */
export interface SchemaNode {
  /** Identificador único (ruta JSON estable). */
  id: string;
  /** Etiqueta visible principal. */
  label: string;
  /** Ruta JSON origen del nodo. */
  jsonPath: string;
  /** Objeto original (no mutar desde UI). */
  data: Record<string, any>;
  /** Metadatos calculados durante la normalización. */
  jsonMeta?: {
    /** Título sugerido para la card. */
    title?: string;
    /** Atributos de vista previa (clave/valor). */
    attributes?: Record<string, any>;
    /** Número de hijos directos. */
    childrenCount?: number;
    /** Tamaños de arrays no escalares por clave. */
    arrayCounts?: Record<string, number>;
    /** Orden relativo entre hermanos. */
    childOrder?: number;
  };
  /** Posición y tamaño (se actualizan tras layout y medición). */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/** Arista entre dos nodos del grafo. */
export interface SchemaEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  /** Puntos del path SVG en coordenadas del grafo. */
  points?: Array<{ x: number; y: number }>;
}

/** Contenedor de nodos, aristas y metadatos auxiliares. */
export interface NormalizedGraph {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  meta?: Record<string, any>;
}

/**
 * Configuración por secciones (mergeable con DEFAULT_SETTINGS).
 *
 * Organización:
 * - messages  → estados/textos de overlays.
 * - colors    → color de aristas y acentos de cards.
 * - layout    → dirección, alineación y estilo de enlaces.
 * - dataView  → extracción/presentación de datos en cards + medición.
 * - viewport  → alto del visor, toolbar y visibilidad de controles.
 * - debug     → trazas y ayudas de depuración.
 */
export interface SchemaSettings {
  /** Estados y textos de overlays. */
  messages?: {
    isLoading?: boolean;
    isError?: boolean;
    loadingMessage?: string;
    errorMessage?: string;
    emptyMessage?: string;
  };

  /** Colores y acentos. */
  colors?: {
    /** Stroke de enlaces. */
    linkStroke?: string;
    /** Grosor del stroke de enlaces. */
    linkStrokeWidth?: number;

    /** Clave booleana del objeto para acentuar cards (true/false/null). */
    accentByKey?: string | null;
    /** Intercambia la semántica de colores true/false. */
    accentInverse?: boolean;
    /** Aplica color de fondo además del borde. */
    accentFill?: boolean;

    /** Controla si se colorea cuando el valor es true. */
    showColorTrue?: boolean;
    /** Controla si se colorea cuando el valor es false. */
    showColorFalse?: boolean;
    /** Controla si se colorea cuando el valor es null. */
    showColorNull?: boolean;
  };

  /** Parámetros de layout y ruteo. */
  layout?: {
    /** Dirección del layout general. */
    layoutDirection?: LayoutDirection;
    /** Alineación del padre con los hijos. */
    layoutAlign?: LayoutAlign;

    /** Estilo de arista. */
    linkStyle?: LinkStyle;

    /** Tensión de curva (20–200) para linkStyle='curve'. */
    curveTension?: number;
    /**
     * Umbral horizontal bajo el cual se dibuja recto aunque linkStyle='curve'.
     * Evita “curvas cortas” visualmente extrañas.
     */
    straightThresholdDx?: number;

    /** Separación horizontal mínima entre cards (px). */
    columnGapPx?: number;
    /** Separación vertical mínima entre cards (px). */
    rowGapPx?: number;
  };

  /**
   * Extracción y presentación de datos en cards + medición/autoajuste.
   *
   * Subgrupos:
   * a) Extracción de datos
   * b) Presentación
   * c) Interacción por nodo
   * d) Medición y autoajuste
   */
  dataView?: {
    // a) Extracción de datos (qué se muestra)
    /** Prioridad de claves para derivar el título. */
    titleKeyPriority?: string[];
    /** Claves globales a ocultar en el preview. */
    hiddenKeysGlobal?: string[];
    /**
     * Muestra arrays de escalares como atributo concatenado.
     * @default true
     * @example
     * // tags: ["red","green","blue"] -> "red, green, blue"
     */
    treatScalarArraysAsAttribute?: boolean;

    /** Profundidad máxima de recorrido (null = sin límite). */
    maxDepth?: number | null;
    /** Mapa de traducciones de claves → etiqueta visible. */
    labelData?: Record<string, string>;

    // b) Presentación (cómo se ve)
    /** Muestra el título sugerido en la card por defecto. */
    showTitle?: boolean;
    /** Máximo de atributos en preview. */
    previewMaxKeys?: number;
    /** Límite de caracteres visibles por valor (añade "…" si supera). */
    valueMaxChars?: number | null;
    /** Muestra tooltip con el valor completo. */
    valueShowTooltip?: boolean;
    /** Claves que no deben hacer wrap en la card. */
    noWrapKeys?: string[];

    /** Límite de ancho por card (px). null = sin límite. */
    maxCardWidth?: number | null;
    /** Límite de alto por card (px). null = sin límite. */
    maxCardHeight?: number | null;
    /** Tamaño base por defecto de card. */
    defaultNodeSize?: { width: number; height: number };

    // c) Interacción/feature flags del nodo
    /** Habilita botón de colapso/expansión por card (si tiene hijos). */
    enableCollapse?: boolean;

    // d) Medición y autoajuste (afinamiento tras render)
    /**
     * Si true, mide el DOM y realinea hasta estabilizar tamaños.
     * Útil para templates custom o textos variables.
     */
    autoResizeCards?: boolean;
    /** Margen extra de ancho a sumar tras la medición (px). */
    paddingWidthPx?: number;
    /** Margen extra de alto a sumar tras la medición (px). */
    paddingHeightPx?: number;
  };

  /** Vista/viewport del esquema. */
  viewport?: {
    /** Altura del viewport (px). */
    height?: number;
    /** Altura mínima del viewport (px). */
    minHeight?: number;
    /** Muestra la toolbar integrada. */
    showToolbar?: boolean;

    /**
     * Visibilidad de controles de la toolbar (todos true por defecto).
     * Controla la presencia de los selectores de:
     * - estilo de enlace (linkStyle)
     * - alineación (layoutAlign)
     * - dirección (layoutDirection)
     */
    toolbarControls?: {
      showLinkStyle?: boolean;
      showLayoutAlign?: boolean;
      showLayoutDirection?: boolean;
    };
  };

  /** Flags de depuración. */
  debug?: {
    /** Log de medición. */
    measure?: boolean;
    /** Log de layout/relayout. */
    layout?: boolean;
    /** Dibuja bounds de cards. */
    paintBounds?: boolean;
    /** Expone `schemaDebug` en window. */
    exposeOnWindow?: boolean;
  };
}

/**
 * Valores por defecto seguros.
 *
 * Ejemplo de uso:
 * ```ts
 * const settings: SchemaSettings = {
 *   ...DEFAULT_SETTINGS,
 *   layout: { ...DEFAULT_SETTINGS.layout, linkStyle: 'orthogonal' },
 *   dataView: {
 *     ...DEFAULT_SETTINGS.dataView,
 *     showTitle: true,
 *     titleKeyPriority: ['name','title','id']
 *   }
 * };
 * ```
 */
export const DEFAULT_SETTINGS: Required<SchemaSettings> = {
  messages: {
    isLoading: false,
    isError: false,
    loadingMessage: "Cargando…",
    errorMessage: "Error al cargar el esquema",
    emptyMessage: "No hay datos para mostrar",
  },

  colors: {
    linkStroke: "#019df4",
    linkStrokeWidth: 2,
    accentByKey: null,
    accentInverse: false,
    accentFill: false,
    showColorTrue: false,
    showColorFalse: false,
    showColorNull: false,
  },

  layout: {
    layoutDirection: "RIGHT",
    layoutAlign: "firstChild",
    linkStyle: "curve",
    curveTension: 30,
    straightThresholdDx: 60,
    columnGapPx: 64,
    rowGapPx: 32,
  },

  dataView: {
    // a) Extracción
    titleKeyPriority: [],
    hiddenKeysGlobal: [],
    treatScalarArraysAsAttribute: true,
    maxDepth: null,
    labelData: {},

    // b) Presentación
    showTitle: false,
    previewMaxKeys: 999,
    valueMaxChars: null,
    valueShowTooltip: false,
    noWrapKeys: [],
    maxCardWidth: null,
    maxCardHeight: null,
    defaultNodeSize: { width: 256, height: 64 },

    // c) Interacción
    enableCollapse: false,

    // d) Medición
    autoResizeCards: true,
    paddingWidthPx: 16,
    paddingHeightPx: 0,
  },

  viewport: {
    height: 800,
    minHeight: 480,
    showToolbar: true,
    toolbarControls: {
      showLinkStyle: true,
      showLayoutAlign: true,
      showLayoutDirection: true,
    },
  },

  debug: {
    measure: false,
    layout: false,
    paintBounds: false,
    exposeOnWindow: false,
  },
};
