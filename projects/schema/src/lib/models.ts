export type LayoutAlign = 'firstChild' | 'center';
export type LinkStyle = 'orthogonal' | 'curve' | 'line';
export type TitleMode = 'auto' | 'none';
export type LayoutDirection = 'RIGHT' | 'DOWN';

export interface SchemaNode {
  id: string;
  label: string;
  jsonPath: string;
  data: Record<string, any>;
  jsonMeta?: {
    title?: string;
    attributes?: Record<string, any>;
    childrenCount?: number;
    arrayCounts?: Record<string, number>;
  };
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface SchemaEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  points?: Array<{ x: number; y: number }>;
}

export interface NormalizedGraph {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  meta?: Record<string, any>;
}

/**
 * Opciones internas (back-compat). Se siguen aceptando vía [options].
 * Hoy se recomienda usar [settings] que las organiza.
 */
export interface SchemaOptions {
  // Extracción / preview
  titleKeyPriority: string[];
  hiddenKeysGlobal?: string[];
  collapseArrayContainers: boolean;
  collapseSingleChildWrappers: boolean;
  maxDepth: number | null;
  previewMaxKeys: number;
  treatScalarArraysAsAttribute: boolean;

  // Tamaño base
  defaultNodeSize?: { width: number; height: number };

  // Enlaces / layout
  linkStroke?: string;
  linkStrokeWidth?: number;
  layoutAlign?: LayoutAlign;
  linkStyle?: LinkStyle;
  curveTension?: number;
  accentByKey?: string | null;
  /** Pinta también el interior de la card (además del borde) según accentByKey */
  accentFill?: boolean;
  accentInverse?: boolean;
  showColorTrue?: boolean;
  showColorFalse?: boolean;
  showColorNull?: boolean;
  titleMode?: TitleMode;
  layoutDirection?: LayoutDirection;
  straightThresholdDx?: number;

  // Auto-resize de cards
  autoResizeCards?: boolean;
  maxCardWidth?: number | null;
  maxCardHeight?: number | null;
  noWrapKeys?: string[];

  // Alineaciones
  snapRootChildrenY?: boolean;
  snapChainSegmentsY?: boolean;

  // Colchón extra al medir (se suma a scrollWidth/scrollHeight)
  measureExtraWidthPx?: number;
  measureExtraHeightPx?: number;

  // DEBUG
  debug?: {
    measure?: boolean;
    layout?: boolean;
    paintBounds?: boolean;
    exposeOnWindow?: boolean;
  };
}

/**
 * Nuevo contenedor organizado. Pásalo como [settings].
 * Si no lo pasas, se usan defaults seguros.
 */
export interface SchemaSettings {
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
  layout?: {
    layoutDirection?: LayoutDirection;
    layoutAlign?: LayoutAlign;
    linkStyle?: LinkStyle;
    curveTension?: number;
    straightThresholdDx?: number;
    snapRootChildrenY?: boolean;
    snapChainSegmentsY?: boolean;
  };
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
  };
  messages?: {
    isLoading?: boolean;
    isError?: boolean;
    emptyMessage?: string;
    loadingMessage?: string;
    errorMessage?: string;
  };
  viewport?: {
    /** Altura del viewport del esquema (px). Default 800. */
    height?: number;
    /** Altura mínima del viewport (px). Default 480. */
    minHeight?: number;
    /** Muestra la toolbar integrada. Default true. */
    showToolbar?: boolean;
  };
  debug?: {
    measure?: boolean;
    layout?: boolean;
    paintBounds?: boolean;
    exposeOnWindow?: boolean;
  };
}

export const DEFAULT_OPTIONS: SchemaOptions = {
  titleKeyPriority: ['name', 'title', 'id', 'label'],
  hiddenKeysGlobal: [],
  collapseArrayContainers: true,
  collapseSingleChildWrappers: true,
  maxDepth: null,
  previewMaxKeys: 4,
  treatScalarArraysAsAttribute: true,

  defaultNodeSize: { width: 220, height: 96 },

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

  autoResizeCards: true,
  maxCardWidth: null,
  maxCardHeight: null,
  noWrapKeys: [],

  snapRootChildrenY: false,
  snapChainSegmentsY: true,

  measureExtraWidthPx: 24,
  measureExtraHeightPx: 0,

  debug: {
    measure: false,
    layout: false,
    paintBounds: false,
    exposeOnWindow: false,
  },
};
