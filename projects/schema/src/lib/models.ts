// projects/schema/src/lib/models.ts
import { TemplateRef } from '@angular/core';

export type SchemaLevel =
  | 'central'
  | 'cable'
  | 'port'
  | 'cto'
  | 'user'
  | 'json-object'
  | 'json-array'
  | 'json-value';

export const SCHEMA_LEVEL_ORDER: Exclude<
  SchemaLevel,
  'json-object' | 'json-array' | 'json-value'
>[] = ['central', 'cable', 'port', 'cto', 'user'];

export interface SchemaNode {
  id: string;
  level: SchemaLevel;
  data: any;
  state?: { inDamage?: boolean; certified?: boolean | null };
  size?: { w: number; h: number };
  collapsed?: boolean;
  rank?: number;
  jsonMeta?: {
    kind: 'object' | 'array' | 'value';
    key?: string;
    index?: number;
    title?: string;
    /** NUEVO: clave que originó el título, para no repetirla en el body */
    titleKey?: string;
    attributes?: Record<string, string>;
    arrays?: Record<string, { length: number; sample?: string[] }>;
    preview?: string;
    depth: number;
  };
}

export interface SchemaEdge {
  id: string;
  sourceId: string;
  targetId: string;
  state?: { inDamage?: boolean };
  label?: string;
}
export interface SchemaGraph {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
}

export type JsonArrayPolicy = 'count' | 'fanout' | 'paged';

export interface SchemaOptions {
  gapX?: number;
  gapY?: number;
  padding?: number;
  linkStyle?: 'line' | 'curve' | 'orthogonal';
  layout?: 'level' | 'tree';
  align?: 'firstChild' | 'center';

  // JSON
  jsonMaxDepth?: number;
  jsonMaxChildren?: number;
  jsonStringMaxLen?: number;
  jsonAttrMax?: number;
  jsonArrayPolicy?: JsonArrayPolicy;
  jsonTitleKeys?: string[];

  // Pan & Zoom

  panZoomEnabled?: boolean; // default true
  zoomMin?: number; // default 0.25
  zoomMax?: number; // default 2
  zoomStep?: number; // default 0.1 (10% por “tic” de rueda)
  initialZoom?: number | 'fit';
  fitPadding?: number;
  hideRootArrayCard?: boolean; // default true
  hideRootObjectCard?: boolean; // default false
}

export interface SchemaSize {
  width: number;
  height: number;
}
export interface Point {
  x: number;
  y: number;
}
export type PositionsMap = Map<string, Point>;
