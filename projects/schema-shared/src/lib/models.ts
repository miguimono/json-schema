/**
 * Tipos y modelos base de la librería Schema.
 * ---------------------------------------------------------------------------
 * Este archivo define:
 *  - Tipos de configuración (dirección del layout, estilos, depuración, etc.)
 *  - Estructuras del grafo normalizado (nodos y aristas)
 *  - Estructura de configuración SchemaSettings (por secciones)
 *  - Valores por defecto (DEFAULT_SETTINGS)
 *
 * CONVENCIONES:
 *  - No se realizan operaciones lógicas aquí; solo contratos y defaults.
 *  - No modifiques nombres de propiedades existentes: otros módulos dependen
 *    de ellas. Cualquier cambio es breaking.
 *  - Todos los ejemplos son ilustrativos y no afectan el comportamiento.
 */

/* =========================================
 *          Layout / Estilos
 * ========================================= */
/**
 * Dirección del layout del grafo.
 * - "RIGHT": flujo de izquierda → derecha (X crece).
 * - "DOWN" : flujo de arriba → abajo (Y crece).
 *
 * Ejemplo de uso:
 *  layoutDirection: "RIGHT"
 */
export type LayoutDirection = "RIGHT" | "DOWN";

/**
 * Alineación del padre respecto a sus hijos.
 * - "firstChild": el centro del padre se alinea con el primer hijo (respeta orden JSON).
 * - "center"    : el centro del padre se alinea con el promedio de los hijos.
 *
 * Ejemplo de uso:
 *  layoutAlign: "center"
 */
export type LayoutAlign = "firstChild" | "center";

/**
 * Estilo visual de las aristas.
 * - "orthogonal": segmentos tipo “L”.
 * - "curve"     : curva cúbica suave.
 * - "line"      : recta simple.
 *
 * Ejemplo de uso:
 *  linkStyle: "orthogonal"
 */
export type LinkStyle = "curve" | "orthogonal" | "line";

/**
 * Estrategia de ajuste de imagen en su contenedor.
 * - "contain"    : mantiene proporción, siempre completa dentro del cuadro.
 * - "cover"      : mantiene proporción, puede recortar para cubrir el cuadro.
 * - "scale-down" : como "contain", pero solo escala hacia abajo si es necesario.
 *
 * Nota: estos valores se mapean a CSS `object-fit`.
 */
export type ImageFit = "contain" | "cover" | "scale-down";

/* =========================================
 *             Grafo Normalizado
 * ========================================= */

/**
 * Nodo del grafo normalizado.
 * - `id` y `jsonPath` deben ser únicos por nodo.
 * - `label` es opcionalmente derivado de claves preferidas (titleKeyPriority).
 * - `data` conserva el objeto original asociado al nodo.
 * - `width/height` pueden ajustarse dinámicamente tras medición del DOM.
 */
export interface SchemaNode {
  /** Identificador único (por defecto, `jsonPath`). */
  id: string;

  /** Etiqueta visible opcional (título corto del nodo). */
  label: string;

  /** Ruta JSON (ej: "$.meta.children[0].name"). Debe ser estable y única. */
  jsonPath: string;

  /** Objeto original (o sub-objeto) del cual se derivó el nodo. */
  data: Record<string, any>;

  /** Metadatos derivados del proceso de normalización. */
  jsonMeta?: {
    /** Título calculado a partir de `titleKeyPriority` (si existe). */
    title?: string;

    /** Clave usada para el título (si fue encontrada). */
    titleKeyUsed?: string;

    /**
     * Subconjunto de pares clave-valor “visibles” como vista previa.
     * Incluye escalares y, opcionalmente, arrays escalares (join(", ")).
     */
    attributes?: Record<string, any>;

    /** Número de hijos directos (no incluye descendencia). */
    childrenCount?: number;

    /** Cantidades de arrays no escalares por clave (para badges). */
    arrayCounts?: Record<string, number>;

    /**
     * Orden relativo del hijo dentro de su padre (0, 1, 2, ...),
     * preserva el orden del JSON para un layout estable.
     */
    childOrder?: number;
  };

  /** Posición X (en px) dentro del “stage”; definida por el layout. */
  x?: number;

  /** Posición Y (en px) dentro del “stage”; definida por el layout. */
  y?: number;

  /** Ancho del nodo en px (puede ajustarse tras medición). */
  width?: number;

  /** Alto del nodo en px (puede ajustarse tras medición). */
  height?: number;
}

/**
 * Arista entre dos nodos del grafo.
 * - `source` y `target` son `id` de nodos existentes.
 * - `points` (opcional) contiene los puntos calculados por el layout; si no
 *   existen, el renderizador puede trazar una línea simple entre centros.
 */
export interface SchemaEdge {
  /** Identificador único de la arista (sugerido: `${source}__${target}`). */
  id: string;

  /** Id del nodo origen. */
  source: string;

  /** Id del nodo destino. */
  target: string;

  /** Etiqueta opcional. No se usa en el render por defecto. */
  label?: string;

  /** Secuencia de puntos en px (para line/curve/orthogonal). */
  points?: Array<{ x: number; y: number }>;
}

/**
 * Contenedor inmutable de nodos, aristas y metadatos auxiliares.
 * - `meta` permite transportar información del layout o anclajes (pinX/pinY).
 */
export interface NormalizedGraph {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  meta?: Record<string, any>;
}

/* =========================================
 *        Presentación de imagen en Card
 * ========================================= */

/** Forma de la miniatura de imagen en la card. */
export type ImageShape = "square" | "rounded" | "circle";

/* =========================================
 *           Configuración (Settings)
 * ========================================= */

/**
 * Configuración general de Schema, por secciones.
 * Todas las propiedades son opcionales y se fusionan con DEFAULT_SETTINGS.
 *
 * Recomendación:
 *  - Define solo lo que necesites modificar.
 *  - Mantén las secciones separadas para claridad (colors/layout/dataView/...).
 */
export interface SchemaSettings {
  /* -------------------- Mensajes / Estados -------------------- */
  messages?: {
    /** Forzar overlay de “cargando”. */
    isLoading?: boolean;
    /** Forzar overlay de “error”. */
    isError?: boolean;
    /** Texto del overlay de carga. */
    loadingMessage?: string;
    /** Texto del overlay de error. */
    errorMessage?: string;
    /** Texto del overlay “vacío”. */
    emptyMessage?: string;
  };

  /* -------------------------- Colores -------------------------- */
  colors?: {
    /** Color del trazo de aristas (CSS color). Ej: "#019df4" */
    linkStroke?: string;
    /** Grosor del trazo de aristas (px). Ej: 2 */
    linkStrokeWidth?: number;
    /**
     * Clave booleana en `node.data` para acentuar cards.
     * Si esta clave está presente en un nodo, se pintará su contorno (y/o fondo)
     * según su valor true/false/null. La clave será omitida de la vista
     * previa de atributos (se implementa en JsonAdapterService).
     *      * Ej: "in_damage" | "certified" | null
     */
    accentByKey?: string | null;

    /** Invierte la semántica de los acentos (true ↔ false). */
    accentInverse?: boolean;

    /** Si `true`, aplica un relleno de fondo adicional según el valor. */
    accentFill?: boolean;

    /** Habilita clase de color para valor `true`. */
    showColorTrue?: boolean;
    /** Habilita clase de color para valor `false`. */
    showColorFalse?: boolean;
    /** Habilita clase de color para valor `null`. */
    showColorNull?: boolean;
  };

  /* -------------------------- Layout --------------------------- */
  layout?: {
    /** Dirección del layout ("RIGHT" | "DOWN"). */
    layoutDirection?: LayoutDirection;

    /** Alineación del padre respecto a hijos ("firstChild" | "center"). */
    layoutAlign?: LayoutAlign;

    /** Estilo de aristas ("orthogonal" | "curve" | "line"). */
    linkStyle?: LinkStyle;

    /**
     * Tensión para curvas (px). Rango sugerido: 20–200.
     * Valores altos generan curvas más “amplias”.
     */
    curveTension?: number;

    /**
     * Umbral (px) por debajo del cual una curva se renderiza como línea recta
     * (evita “curvas demasiado cortas”). Sugerido: 40–120.
     */
    straightThresholdDx?: number;

    /** Separación horizontal entre columnas (px). */
    columnGapPx?: number;

    /** Separación vertical entre filas (px). */
    rowGapPx?: number;
  };

  /* -------------------------- DataView ------------------------- */
  dataView?: {
    /* ---------- a) Extracción de datos ---------- */

    /**
     * Prioridad de claves para título del nodo.
     * Ej: ["name", "title", "id"]
     */
    titleKeyPriority?: string[];

    /**
     * Claves globales a ocultar en los atributos de vista previa.
     * Ej: ["_internal", "password"]
     */
    hiddenKeysGlobal?: string[];

    /**
     * Si `true`, arrays escalares se muestran en la vista previa (join(", ")).
     * Ejemplo:
     *  ["red","green"] → "red, green"
     */
    treatScalarArraysAsAttribute?: boolean;

    /**
     * Profundidad máxima de exploración. Si `null`, sin límite.
     *  - 0: solo raíz
     *  - 1: raíz + 1 nivel
     *  - n: niveles anidados hasta n
     */
    maxDepth?: number | null;

    /**
     * Mapa de claves → etiqueta legible para UI.
     * Ej: { first_name: "Nombre", last_name: "Apellido" }
     */
    labelData?: Record<string, string>;

    /* ---------- b) Presentación general ---------- */

    /**
     * Máximo de pares (k,v) en la vista previa. Evita cards demasiado largas.
     * Sugerido: 20–2000 (por defecto alto para depuración).
     */
    previewMaxKeys?: number;

    /**
     * Trunca valores largos en la vista previa si exceden este número de caracteres.
     * Si `null`, no se trunca.
     */
    valueMaxChars?: number | null;

    /**
     * Si `true`, muestra `title` con el valor completo al pasar el mouse por
     * el valor truncado.
     */
    valueShowTooltip?: boolean;

    /**
     * Claves que NO deben romper línea en su valor (aplica `white-space: nowrap`).
     * Útil para IDs, hashes, etc.
     * Ej: ["id","hash","uuid"]
     */
    noWrapKeys?: string[];

    /** Máximo ancho de la card (px). Si `null`, sin límite. */
    maxCardWidth?: number | null;

    /** Máximo alto de la card (px). Si `null`, sin límite. */
    maxCardHeight?: number | null;

    /**
     * Tamaño por defecto de cada nodo (px).
     * Se ajusta tras medir contenido cuando `autoResizeCards` es `true`.
     */
    defaultNodeSize?: { width: number; height: number };

    /* ---------- c) Presentación de imagen (grupo completo) ---------- */
    /**
     * Clave en `node.data` que contiene la URL de imagen.
     * Ej: "avatarUrl" | "logo" | null (si no hay imagen).
     */
    showImage?: string | null;

    /**
     * Tamaño de la miniatura en px (ancho/alto idénticos).
     * Rango sugerido: 16–96.
     */
    imageSizePx?: number;

    /** Forma de la miniatura: "square" | "rounded" | "circle". */
    imageShape?: ImageShape;

    /** Si `true`, dibuja un borde sutil alrededor de la miniatura. */
    imageBorder?: boolean;

    /** Color o valor CSS para el fondo de la miniatura. Ej: "transparent". */
    imageBg?: string | null;

    /** Estrategia de ajuste de la imagen dentro del cuadro (CSS `object-fit`). */
    imageFit?: ImageFit;

    /**
     * URL/local path de imagen de fallback si falla la carga de `showImage`.
     * Ej: "assets/comingSoon.png" | null para omitir fallback.
     * Nota: el componente puede optar por no utilizarlo si no se implementa.
     */
    imageFallback?: string | null;

    /* ---------- d) Interacción ---------- */

    /**
     * Habilita/Deshabilita la capacidad de colapsar nodos.
     * Cuando está activo, los descendientes de un nodo colapsado no se muestran.
     */
    enableCollapse?: boolean;

    /* ---------- e) Medición (auto-resize) ---------- */

    /** Recalcula tamaño de cards tras render para ajustar al contenido. */
    autoResizeCards?: boolean;

    /** Ancho extra (px) añadido tras la medición (márgenes internos). */
    paddingWidthPx?: number;

    /** Alto extra (px) añadido tras la medición (márgenes internos). */
    paddingHeightPx?: number;
  };

  /* -------------------------- Viewport ------------------------- */
  viewport?: {
    /** Alto del viewport en px (contenedor con scroll oculto). */
    height?: number;

    /** Alto mínimo del viewport en px. */
    minHeight?: number;

    /** Muestra/oculta la toolbar. */
    showToolbar?: boolean;

    /** Controla la visibilidad de selectores en la toolbar. */
    toolbarControls?: {
      /** Selector de estilo de enlaces. */
      showLinkStyle?: boolean;

      /** Selector de alineación. */
      showLayoutAlign?: boolean;

      /** Selector de dirección. */
      showLayoutDirection?: boolean;
    };
  };
}

/* =========================================
 *             Valores por defecto
 * ========================================= */

/**
 * Valores por defecto (seguros) de configuración.
 * - Estos valores son fusionados con `SchemaSettings` provistos por el usuario.
 * - No contienen lógica condicional; son constantes.
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
    /* a) Extracción */
    titleKeyPriority: [],
    hiddenKeysGlobal: [],
    treatScalarArraysAsAttribute: true,
    maxDepth: null,
    labelData: {},

    /* b) Presentación general */
    previewMaxKeys: 999,
    valueMaxChars: null,
    valueShowTooltip: false,
    noWrapKeys: [],
    maxCardWidth: null,
    maxCardHeight: null,
    defaultNodeSize: { width: 256, height: 64 },

    /* c) Presentación de imagen */
    showImage: null,
    imageSizePx: 32,
    imageShape: "rounded",
    imageBorder: false,
    imageBg: "transparent",
    imageFit: "contain",
    imageFallback: null,

    /* d) Interacción */
    enableCollapse: true,

    /* e) Medición */
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
};
