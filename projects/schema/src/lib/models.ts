// projects/schema/src/lib/models.ts
// =======================================================
// Definiciones de modelo para la librería Schema, sin SchemaOptions
// (se reemplaza por SchemaSettings + DEFAULT_SETTINGS).
// =======================================================

/**
 * Dirección de layout del grafo.
 * - 'RIGHT': flujo de izquierda → derecha.
 * - 'DOWN':  flujo de arriba → abajo.
 */
export type LayoutDirection = 'RIGHT' | 'DOWN';

/**
 * Alineación del padre con respecto a sus hijos.
 * - 'firstChild': centra al padre con el primer hijo (según jsonMeta.childOrder).
 * - 'center':     centra al padre con el promedio vertical de sus hijos.
 */
export type LayoutAlign = 'firstChild' | 'center';

/**
 * Estilo visual de las aristas.
 * - 'orthogonal': segmentos en L (ruteo ortogonal).
 * - 'curve':      curva cúbica con puntos de control laterales.
 * - 'line':       recta simple entre origen y destino.
 */
export type LinkStyle = 'curve' | 'orthogonal' | 'line';

/**
 * Nodo del grafo normalizado.
 * Generado por {@link JsonAdapterService} y posicionado por {@link SchemaLayoutService}.
 */
export interface SchemaNode {
  /**
   * Identificador único del nodo.
   * @example "$.central.cables[0]"
   * @remarks Por defecto se usa la ruta JSON (jsonPath) como id estable.
   */
  id: string;

  /**
   * Etiqueta principal del nodo (título visible en la card).
   * @default Seleccionado con heurística de título (ver jsonMeta.title)
   */
  label: string;

  /**
   * Ruta JSON origen del nodo.
   * Útil para debugging, deep-linking y plantillas personalizadas.
   */
  jsonPath: string;

  /**
   * Objeto original asociado (para uso en plantillas).
   * @remarks Se recomienda no mutar este objeto desde la UI.
   */
  data: Record<string, any>;

  /**
   * Metadatos calculados durante la normalización.
   * - title: título sugerido (usado por defecto si showTitle === true).
   * - attributes: preview de pares clave/valor (escalares y arrays escalares).
   * - childrenCount: número de hijos directos en el grafo.
   * - arrayCounts: tamaños de arrays no escalares por clave.
   * - childOrder: índice relativo entre hermanos (para orden estable).
   */
  jsonMeta?: {
    /** Título sugerido para la card. */
    title?: string;
    /** Atributos de vista previa (clave/valor). */
    attributes?: Record<string, any>;
    /** Número de hijos directos del nodo. */
    childrenCount?: number;
    /** Conteo de arrays no escalares por clave. */
    arrayCounts?: Record<string, number>;
    /** Posición relativa del nodo respecto a sus hermanos. */
    childOrder?: number;
  };

  /**
   * Posición y tamaño asignados por el layout/medición.
   * @remarks Estos valores pueden refinarse tras medición de DOM si autoResizeCards=true.
   */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

/**
 * Arista del grafo normalizado. Une dos nodos por sus IDs.
 * Los puntos de dibujo (polyline/curva) se calculan tras el layout.
 */
export interface SchemaEdge {
  /** Identificador único del edge. */
  id: string;

  /** ID del nodo origen. */
  source: string;

  /** ID del nodo destino. */
  target: string;

  /** Etiqueta opcional (no usada por defecto en el render). */
  label?: string;

  /**
   * Puntos del path SVG en coordenadas del grafo.
   * - orthogonal: start, bends, end.
   * - curve/line: típicamente [start, (c1), (c2), end] o [start, end].
   */
  points?: Array<{ x: number; y: number }>;
}

/**
 * Estructura del grafo normalizado (nodos + aristas) con metadatos auxiliares.
 */
export interface NormalizedGraph {
  /** Lista de nodos del grafo. */
  nodes: SchemaNode[];

  /** Lista de aristas del grafo. */
  edges: SchemaEdge[];

  /**
   * Metadatos auxiliares del grafo.
   * @example
   *  meta.pinY: Record<nodeId, y> para fijar verticalmente ciertos hijos al relayout.
   */
  meta?: Record<string, any>;
}

/**
 * Contenedor de settings por secciones.
 * Si no se especifica alguna sección/prop, se aplican defaults desde {@link DEFAULT_SETTINGS}.
 *
 * @example Activar enlaces curvos y acento por booleano
 * ```ts
 * const settings: SchemaSettings = {
 *   colors: { linkStroke: '#019df4', linkStrokeWidth: 2, accentByKey: 'certified' },
 *   layout: { linkStyle: 'curve', layoutAlign: 'center' },
 *   dataView: { enableCollapse: true }
 * };
 * ```
 */
export interface SchemaSettings {
  /** Colores y acentos. */
  colors?: {
    /** Color de aristas (stroke). @default '#019df4' */
    linkStroke?: string;
    /** Grosor del trazo de aristas. @default 2 */
    linkStrokeWidth?: number;
    /** Clave booleana para acentuar cards (true/false/null). @default null */
    accentByKey?: string | null;
    /** Aplica fondo de acento además del borde. @default false */
    accentFill?: boolean;
    /** Invierte mapping de colores (true↔false). @default false */
    accentInverse?: boolean;
    /** Muestra color cuando v===true. @default false */
    showColorTrue?: boolean;
    /** Muestra color cuando v===false. @default false */
    showColorFalse?: boolean;
    /** Muestra color cuando v===null. @default false */
    showColorNull?: boolean;
  };

  /** Parámetros visuales del layout y ruteo. */
  layout?: {
    /** Dirección del layout general. @default 'RIGHT' */
    layoutDirection?: LayoutDirection;
    /** Alineación padre ↔ hijos. @default 'center' */
    layoutAlign?: LayoutAlign;
    /** Estilo de arista. @default 'curve' */
    linkStyle?: LinkStyle;
    /**
     * Tensión de curva para linkStyle='curve'. Clamp 20–200.
     * @default 30
     */
    curveTension?: number;
    /**
     * Umbral horizontal (dx) bajo el cual un enlace 'curve' se dibuja recto.
     * @default 60
     */
    straightThresholdDx?: number;
    /**
     * Alinea verticalmente los hijos del root a una misma línea central.
     * @default false
     */
    snapRootChildrenY?: boolean;
    /**
     * Alinea cadenas lineales (out=1,in=1) para trazado recto.
     * @default false
     */
    snapChainSegmentsY?: boolean;
  };

  /** Cómo extraer/mostrar datos en cards y medición. */
  dataView?: {
    /** Prioridad de claves para derivar título. @default ['name','title','id','label'] */
    titleKeyPriority?: string[];
    /** Claves globales ocultas en el preview. @default [] */
    hiddenKeysGlobal?: string[];
    /** Modo de título del template por defecto. @default 'auto' */
    showTitle?: boolean;
    /** Máximo de atributos en preview. @default 4 */
    previewMaxKeys?: number;
    /** Arrays escalares como atributo concatenado. @default true */
    treatScalarArraysAsAttribute?: boolean;
    /** Colapsar contenedores array envolventes. @default true */
    collapseArrayContainers?: boolean;
    /** Colapsar wrappers de único hijo sin escalares. @default true */
    collapseSingleChildWrappers?: boolean;
    /** Profundidad máxima de recorrido (null = sin límite). @default null */
    maxDepth?: number | null;
    /** Tamaño base por defecto de card. @default { width: 320, height: 96 } */
    defaultNodeSize?: { width: number; height: number };
    /** Claves que no deben hacer wrap. @default [] */
    noWrapKeys?: string[];
    /** Ancho máximo de card. @default null (sin límite) */
    maxCardWidth?: number | null;
    /** Alto máximo de card. @default null (sin límite) */
    maxCardHeight?: number | null;
    /** Medir DOM y relayout hasta estabilizar. @default true */
    autoResizeCards?: boolean;
    /** Colchón extra en ancho al medir. @default 24 */
    measureExtraWidthPx?: number;
    /** Colchón extra en alto al medir. @default 0 */
    measureExtraHeightPx?: number;

    /**
     * Habilita el botón de colapso/expansión por card (si tiene hijos).
     * - true: se muestran controles y funciona el colapso por ancestros.
     * - false/undefined: no se muestra ningún control (comportamiento anterior).
     * @default false
     */
    enableCollapse?: boolean;
  };

  /** Estados y textos de mensajes/overlays. */
  messages?: {
    /** Modo cargando (overlay). @default false */
    isLoading?: boolean;
    /** Modo error (overlay). @default false */
    isError?: boolean;
    /** Mensaje para estado vacío. @default 'No hay datos para mostrar' */
    emptyMessage?: string;
    /** Mensaje de carga. @default 'Cargando…' */
    loadingMessage?: string;
    /** Mensaje de error. @default 'Error al cargar el esquema' */
    errorMessage?: string;
  };

  /** Vista/viewport del esquema. */
  viewport?: {
    /**
     * Altura del viewport del esquema (px).
     * @default 800
     */
    height?: number;

    /**
     * Altura mínima del viewport (px).
     * @default 480
     */
    minHeight?: number;

    /**
     * Muestra la toolbar integrada.
     * @default true
     */
    showToolbar?: boolean;
  };

  /** Flags de depuración. */
  debug?: {
    /** Log de medición. @default false */
    measure?: boolean;
    /** Log de layout/relayout. @default false */
    layout?: boolean;
    /** Dibuja bounds de cards. @default false */
    paintBounds?: boolean;
    /** Expone `schemaDebug` en window. @default false */
    exposeOnWindow?: boolean;
  };
}

/**
 * Valores por defecto seguros (por secciones) para renderizar y medir el grafo.
 * Usa este objeto como base y combina con tus propios `SchemaSettings`.
 *
 * @example
 * ```ts
 * import { DEFAULT_SETTINGS, SchemaSettings } from '@miguimono/schema';
 *
 * const settings: SchemaSettings = {
 *   ...DEFAULT_SETTINGS,
 *   layout: { ...DEFAULT_SETTINGS.layout, linkStyle: 'orthogonal' },
 *   colors: { ...DEFAULT_SETTINGS.colors, linkStroke: '#00B8A9' }
 * };
 * ```
 */
export const DEFAULT_SETTINGS: Required<SchemaSettings> = {
  messages: {
    isLoading: false,
    isError: false,
    emptyMessage: 'No hay datos para mostrar',
    loadingMessage: 'Cargando…',
    errorMessage: 'Error al cargar el esquema',
  },
  colors: {
    linkStroke: '#019df4',
    linkStrokeWidth: 2,
    accentByKey: null,
    accentFill: false,
    accentInverse: false,
    showColorTrue: false,
    showColorFalse: false,
    showColorNull: false,
  },
  layout: {
    layoutDirection: 'RIGHT',
    layoutAlign: 'firstChild',
    linkStyle: 'curve',
    curveTension: 30,
    straightThresholdDx: 60,
    snapRootChildrenY: false,
    snapChainSegmentsY: true,
  },
  dataView: {
    titleKeyPriority: ['name', 'title', 'id', 'label'],
    hiddenKeysGlobal: [],
    showTitle: false,
    previewMaxKeys: 5,
    treatScalarArraysAsAttribute: true,
    collapseArrayContainers: true,
    collapseSingleChildWrappers: true,
    maxDepth: null,
    defaultNodeSize: { width: 256, height: 64 },
    noWrapKeys: [],
    maxCardWidth: null,
    maxCardHeight: null,
    autoResizeCards: true,
    measureExtraWidthPx: 16,
    measureExtraHeightPx: 0,
    enableCollapse: false,
  },

  viewport: {
    height: 800,
    minHeight: 480,
    showToolbar: true,
  },
  debug: {
    measure: false,
    layout: false,
    paintBounds: false,
    exposeOnWindow: false,
  },
};
