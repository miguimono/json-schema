// ============================================
// projects/schema/src/lib/models.ts
// v0.3.7-debug — añade opciones de debug
// ============================================

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
    preview?: string;
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

export interface SchemaOptions {
  // Extracción / preview
  titleKeyPriority: string[];
  hiddenKeysGlobal?: string[];
  collapseArrayContainers: boolean;
  collapseSingleChildWrappers: boolean;
  edgeLabelFromContainerKey: boolean;
  maxDepth: number | null;
  nodeIdStrategy: 'jsonpath';
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
  titleMode?: TitleMode;
  layoutDirection?: LayoutDirection;
  straightThresholdDx?: number;

  // Auto-resize de cards
  autoResizeCards?: boolean;
  maxCardWidth?: number | null;
  maxCardHeight?: number | null;
  noWrapKeys?: string[];

  // 🔍 DEBUG
  debug?: {
    /** Loggea mediciones por consola (console.table) */
    measure?: boolean;
    /** Loggea antes/después de layout (tamaños, cambios) */
    layout?: boolean;
    /** Pinta outline de las cards para ver sus bounds reales */
    paintBounds?: boolean;
    /** Expone el componente en window.schemaDebug para comandos manuales */
    exposeOnWindow?: boolean;
  };
}

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

  linkStroke: '#4CAF50',
  linkStrokeWidth: 1.25,
  layoutAlign: 'center',
  linkStyle: 'orthogonal',
  curveTension: 80,
  accentByKey: null,
  titleMode: 'auto',
  layoutDirection: 'RIGHT',
  straightThresholdDx: 160,

  autoResizeCards: true,
  maxCardWidth: 560,
  maxCardHeight: null,
  noWrapKeys: ['cto_name', 'cai'],

  // DEBUG por defecto apagado
  debug: {
    measure: false,
    layout: false,
    paintBounds: false,
    exposeOnWindow: false,
  },
};
