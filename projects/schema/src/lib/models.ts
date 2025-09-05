// path: projects/schema/src/lib/models.ts

import { TemplateRef } from '@angular/core';

export type LayoutAlign = 'firstChild' | 'center';
export type LinkStyle = 'orthogonal' | 'curve' | 'line';

export interface SchemaNode {
  id: string;
  label: string;
  jsonPath: string;
  data: Record<string, any>;
  jsonMeta?: {
    title?: string;
    attributes?: Record<string, any>;
    preview?: string;
    childrenCount?: number; // 👈 cantidad de hijos objeto/híbridos
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
  /** Prioridad de claves para titular entidades. Equivale a jsonTitleKeys en tu wrapper. */
  titleKeyPriority: string[];

  /** Oculta estas claves al construir atributos (no se muestran en la card). */
  hiddenKeysGlobal?: string[];

  /** Si true, no crea nodos para arrays; conecta el padre con cada elemento. */
  collapseArrayContainers: boolean;

  /** Si true, omite objetos “envoltorio” sin escalares ni título y con 1 solo hijo objeto. */
  collapseSingleChildWrappers: boolean;

  /** Etiquetar aristas con el nombre del contenedor (clave padre) */
  edgeLabelFromContainerKey: boolean;

  /** Límite de profundidad (null = sin límite) */
  maxDepth: number | null;

  /** Estrategia id: fija a jsonpath para estabilidad */
  nodeIdStrategy: 'jsonpath';

  /** Límite de claves en preview por card */
  previewMaxKeys: number;

  /** Si true, arrays de escalares se muestran como atributo (join) en el padre */
  treatScalarArraysAsAttribute: boolean;

  /** Tamaño por defecto de nodo para layout */
  defaultNodeSize?: { width: number; height: number };

  /** Estilo de links (passthrough a UI) */
  linkStroke?: string;
  linkStrokeWidth?: number;
  layoutAlign?: LayoutAlign; // 'firstChild' | 'center'
  linkStyle?: LinkStyle; // 'orthogonal' | 'curve' | 'line'
  accentByKey?: string | null; // 👈 nueva
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
  accentByKey: null,
};
