// projects/schema/src/lib/models.ts

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
export type LinkStyle = 'orthogonal' | 'curve' | 'line';

/**
 * Modo de título para el template por defecto de la card.
 * - 'auto': intenta derivarlo de claves prioritarias o primer escalar.
 * - 'none': no renderiza título en el template por defecto.
 */
export type TitleMode = 'auto' | 'none';

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
   * - title: título sugerido (usado por defecto si titleMode !== 'none').
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
 * Opciones planas históricas (compatibilidad).
 * @deprecated Se recomienda usar {@link SchemaSettings}; estas opciones siguen vigentes
 *             y son la base efectiva tras el merge.
 */
export interface SchemaOptions {
  // ===== Extracción / preview =====

  /**
   * Prioridad de claves para derivar título.
   * @example ["name","title","id"]
   */
  titleKeyPriority: string[];

  /**
   * Claves globales ocultas en el preview de atributos.
   * @default []
   */
  hiddenKeysGlobal?: string[];

  /**
   * Si true, colapsa contenedores que sean arrays "envolventes" innecesarios.
   * @default true
   */
  collapseArrayContainers: boolean;

  /**
   * Si true, colapsa wrappers con único hijo objeto y sin escalares.
   * @default true
   */
  collapseSingleChildWrappers: boolean;

  /**
   * Profundidad máxima de recorrido.
   * @default null (sin límite)
   */
  maxDepth: number | null;

  /**
   * Máximo de atributos a previsualizar por card.
   * @default 4
   */
  previewMaxKeys: number;

  /**
   * Si true, arrays de escalares se muestran como atributo concatenado.
   * @default true
   */
  treatScalarArraysAsAttribute: boolean;

  // ===== Tamaño base de las cards =====

  /**
   * Tamaño base por defecto de cada card (antes de medición).
   * @default { width: 220, height: 96 }
   */
  defaultNodeSize?: { width: number; height: number };

  // ===== Enlaces / layout =====

  /** Color del trazo de aristas. @default '#019df4' */
  linkStroke?: string;

  /** Grosor del trazo de aristas. @default 2 */
  linkStrokeWidth?: number;

  /** Alineación padre ↔ hijos. @default 'center' */
  layoutAlign?: LayoutAlign;

  /** Estilo de arista. @default 'orthogonal' */
  linkStyle?: LinkStyle;

  /**
   * Tensión de curva para linkStyle='curve'.
   * Rango efectivo 20–200 (clamp interno).
   * @default 80
   */
  curveTension?: number;

  /**
   * Clave booleana para acentuar cards por valor true/false/null.
   * @example "in_damage"
   * @default null
   */
  accentByKey?: string | null;

  /**
   * Si true, aplica fondo además del borde al acentuar.
   * @default false
   */
  accentFill?: boolean;

  /**
   * Si true, invierte mapping de colores (true↔false).
   * @default false
   */
  accentInverse?: boolean;

  /**
   * Si true, muestra color cuando v===true para accentByKey.
   * @default false
   */
  showColorTrue?: boolean;

  /**
   * Si true, muestra color cuando v===false para accentByKey.
   * @default false
   */
  showColorFalse?: boolean;

  /**
   * Si true, muestra color cuando v===null para accentByKey.
   * @default false
   */
  showColorNull?: boolean;

  /** Modo de título de card por defecto. @default 'auto' */
  titleMode?: TitleMode;

  /** Dirección del layout. @default 'RIGHT' */
  layoutDirection?: LayoutDirection;

  /**
   * Umbral horizontal (dx) bajo el cual un enlace 'curve' se dibuja recto.
   * Evita curvas raras cuando los nodos están muy cerca.
   * @default 160
   */
  straightThresholdDx?: number;

  // ===== Auto-resize de cards =====

  /**
   * Si true, mide DOM y relayout hasta estabilizar tamaños.
   * @default true
   */
  autoResizeCards?: boolean;

  /**
   * Ancho máximo de card (limita crecimiento).
   * @default null (sin límite)
   */
  maxCardWidth?: number | null;

  /**
   * Alto máximo de card (limita crecimiento).
   * @default null (sin límite)
   */
  maxCardHeight?: number | null;

  /**
   * Claves cuyos valores NO deben hacer wrap de línea.
   * @example ["port_name","cto_name"]
   * @default []
   */
  noWrapKeys?: string[];

  // ===== Alineaciones opcionales =====

  /**
   * Ajusta verticalmente los hijos del root a una misma línea central.
   * @default false
   */
  snapRootChildrenY?: boolean;

  /**
   * Alinea cadenas lineales (out=1,in=1) para trazado recto.
   * @default true
   */
  snapChainSegmentsY?: boolean;

  // ===== Colchón extra al medir DOM =====

  /**
   * px extra a sumar a scrollWidth durante medición.
   * @default 24
   */
  measureExtraWidthPx?: number;

  /**
   * px extra a sumar a scrollHeight durante medición.
   * @default 0
   */
  measureExtraHeightPx?: number;

  // ===== Depuración =====

  /**
   * Flags de depuración.
   * - measure: logs de medición DOM.
   * - layout:  logs de layout/relayout.
   * - paintBounds: dibuja bounds de las cards.
   * - exposeOnWindow: expone `schemaDebug` en window.
   * @default { measure:false, layout:false, paintBounds:false, exposeOnWindow:false }
   */
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
 * Si no se pasa, se aplican defaults seguros desde {@link DEFAULT_OPTIONS}.
 * @remarks `SchemaSettings` se fusiona internamente para producir `SchemaOptions` efectivos.
 */
export interface SchemaSettings {
  /** Colores y acentos. */
  colors?: {
    /** Color de aristas. */
    linkStroke?: string;
    /** Grosor de aristas. */
    linkStrokeWidth?: number;
    /** Clave booleana para acentuar cards (true/false/null). */
    accentByKey?: string | null;
    /** Aplica fondo de acento además del borde. */
    accentFill?: boolean;
    /** Invierte mapping de colores (true↔false). */
    accentInverse?: boolean;
    /** Muestra color cuando v===true. */
    showColorTrue?: boolean;
    /** Muestra color cuando v===false. */
    showColorFalse?: boolean;
    /** Muestra color cuando v===null. */
    showColorNull?: boolean;
  };

  /** Parámetros visuales del layout y ruteo. */
  layout?: {
    /** Dirección del layout general (RIGHT/DOWN). */
    layoutDirection?: LayoutDirection;
    /** Alineación padre ↔ hijos. */
    layoutAlign?: LayoutAlign;
    /** Estilo de arista. */
    linkStyle?: LinkStyle;
    /** Tensión de curva para linkStyle='curve'. */
    curveTension?: number;
    /** Umbral para forzar recta si dx es pequeño en curvas. */
    straightThresholdDx?: number;
    /** Alinea verticalmente hijos del root. */
    snapRootChildrenY?: boolean;
    /** Alinea cadenas lineales (out=1,in=1). */
    snapChainSegmentsY?: boolean;
  };

  /** Cómo extraer/mostrar datos en cards y medición. */
  dataView?: {
    /** Prioridad de claves para derivar título. */
    titleKeyPriority?: string[];
    /** Claves globales ocultas en el preview. */
    hiddenKeysGlobal?: string[];
    /** Modo de título del template por defecto. */
    titleMode?: TitleMode;
    /** Máximo de atributos en preview. */
    previewMaxKeys?: number;
    /** Arrays escalares como atributo concatenado. */
    treatScalarArraysAsAttribute?: boolean;
    /** Colapsar contenedores array envolventes. */
    collapseArrayContainers?: boolean;
    /** Colapsar wrappers de único hijo sin escalares. */
    collapseSingleChildWrappers?: boolean;
    /** Profundidad máxima de recorrido. */
    maxDepth?: number | null;
    /** Tamaño base por defecto de card. */
    defaultNodeSize?: { width: number; height: number };
    /** Claves que no deben hacer wrap. */
    noWrapKeys?: string[];
    /** Ancho máximo de card. */
    maxCardWidth?: number | null;
    /** Alto máximo de card. */
    maxCardHeight?: number | null;
    /** Medir DOM y relayout hasta estabilizar. */
    autoResizeCards?: boolean;
    /** Colchón extra en ancho al medir. */
    measureExtraWidthPx?: number;
    /** Colchón extra en alto al medir. */
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
    /** Modo cargando (overlay). */
    isLoading?: boolean;
    /** Modo error (overlay). */
    isError?: boolean;
    /** Mensaje para estado vacío. */
    emptyMessage?: string;
    /** Mensaje de carga. */
    loadingMessage?: string;
    /** Mensaje de error. */
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
 * Valores por defecto seguros para renderizar y medir el grafo.
 * @constant
 * @remarks Base para merge con opciones planas y settings seccionados.
 */
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
