// projects/schema/src/lib/services/json-adapter.service.ts
import { Injectable } from '@angular/core';
import {
  JsonArrayPolicy,
  SchemaEdge,
  SchemaGraph,
  SchemaNode,
  SchemaOptions,
} from '../models';

type ArrayBadge = { length: number; sample?: string[] };

/**
 * Adaptador genérico v2 (1 card = 1 objeto).
 * - Nodos SOLO para objetos (y array raíz).
 * - Primitivos -> jsonMeta.attributes.
 * - Arrays -> jsonMeta.arrays (con sample de primitivos) y SIEMPRE conecta hijos OBJETO con edges,
 *   para que existan conexiones visuales en cualquier policy.
 * - 'paged' hoy se comporta igual a 'count'.
 * - rank = depth.
 */
@Injectable({ providedIn: 'root' })
export class JsonAdapterService {
  buildGraphFromJson(data: unknown, opt: SchemaOptions = {}): SchemaGraph {
    const maxDepth = opt.jsonMaxDepth ?? Infinity;
    const maxChildren = opt.jsonMaxChildren ?? Infinity;
    const strMax = Math.max(0, opt.jsonStringMaxLen ?? 80);
    const arrayPolicy: JsonArrayPolicy = opt.jsonArrayPolicy ?? 'count';
    // MODO GENÉRICO por defecto: sin claves de dominio
    const titleKeys = opt.jsonTitleKeys ?? [];

    const nodes: SchemaNode[] = [];
    const edges: SchemaEdge[] = [];
    const seen = new WeakMap<object, string>();

    const isPrimitive = (v: unknown) =>
      v === null ||
      ['string', 'number', 'boolean', 'bigint'].includes(typeof v);

    const makeId = (path: (string | number)[]) =>
      [
        '#',
        ...path.map((seg) =>
          String(seg).replaceAll('~', '~0').replaceAll('/', '~1')
        ),
      ].join('/');

    const trunc = (s: string) =>
      s.length > strMax ? s.slice(0, strMax) + '…' : s;

    const previewOf = (v: unknown): string => {
      if (v === null) return 'null';
      if (typeof v === 'string') return JSON.stringify(trunc(v));
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      if (Array.isArray(v)) return `[${v.length}]`;
      if (typeof v === 'object') return '{…}';
      return String(v);
    };

    /** Intenta elegir un título legible para un objeto, usando titleKeys si se suministran */
    const pickTitle = (obj: any): string | undefined => {
      if (!obj || typeof obj !== 'object') return undefined;
      for (const k of titleKeys) if (obj[k] != null) return String(obj[k]);
      // fallback opcional: primera clave primitiva
      for (const [k, v] of Object.entries(obj))
        if (isPrimitive(v)) return `${k}: ${previewOf(v)}`;
      return undefined;
    };

    /** OBJETO -> crea nodo y enlaza hijos objeto */
    const visitObject = (
      obj: Record<string, unknown>,
      path: (string | number)[],
      depth: number,
      parentId?: string,
      edgeLabel?: string,
      forceLevel: 'json-object' | 'json-array' = 'json-object'
    ) => {
      const id = makeId(path);

      // Evitar ciclos
      const ref = seen.get(obj as object);
      if (ref && ref !== id) {
        const refNodeId = id + '↺';
        nodes.push({
          id: refNodeId,
          level: 'json-value',
          data: { $ref: ref },
          rank: depth,
          jsonMeta: { kind: 'value', depth, preview: `↺ ref ${ref}` },
        });
        if (parentId) {
          edges.push({
            id: `${parentId}->${refNodeId}`,
            sourceId: parentId,
            targetId: refNodeId,
            label: edgeLabel,
          });
        }
        return;
      }
      seen.set(obj as object, id);

      const attributes: Record<string, string> = {};
      const arrays: Record<string, ArrayBadge> = {};
      const childrenToCreate: Array<{ key: string; value: unknown }> = [];

      // Clasificar props
      const entries = Object.entries(obj);
      for (let i = 0; i < Math.min(entries.length, maxChildren); i++) {
        const [k, v] = entries[i];

        if (isPrimitive(v)) {
          attributes[k] = previewOf(v);
          continue;
        }

        if (Array.isArray(v)) {
          const len = v.length;
          const entry: ArrayBadge = (arrays[k] = { length: len });

          // sample de primitivos en badge
          const samplePrim = v
            .filter(
              (el) =>
                el === null ||
                ['string', 'number', 'boolean', 'bigint'].includes(typeof el)
            )
            .slice(0, 3)
            .map(previewOf);
          if (samplePrim.length) entry.sample = samplePrim;

          // SIEMPRE materializar hijos objeto (edges)
          if (depth < maxDepth) {
            let created = 0;
            for (let idx = 0; idx < v.length && created < maxChildren; idx++) {
              const el = v[idx];
              if (el && typeof el === 'object' && !Array.isArray(el)) {
                childrenToCreate.push({ key: `${k}[${idx}]`, value: el });
                created++;
              }
            }
          }
          continue;
        }

        // objeto hijo
        if (v && typeof v === 'object') {
          childrenToCreate.push({ key: k, value: v });
        }
      }

      const node: SchemaNode = {
        id,
        level: forceLevel,
        data: obj,
        rank: depth,
        jsonMeta: {
          kind: forceLevel === 'json-array' ? 'array' : 'object',
          key:
            typeof path.at(-1) === 'string' ? String(path.at(-1)) : undefined,
          index:
            typeof path.at(-1) === 'number' ? Number(path.at(-1)) : undefined,
          title: pickTitle(obj),
          attributes,
          arrays,
          preview: '{…}',
          depth,
        },
      };
      nodes.push(node);

      if (parentId) {
        edges.push({
          id: `${parentId}->${id}`,
          sourceId: parentId,
          targetId: id,
          label: edgeLabel,
        });
      }

      if (depth >= maxDepth) return;

      // Crear hijos objeto
      for (const child of childrenToCreate) {
        visitAny(child.value, [...path, child.key], depth + 1, id, child.key);
      }
    };

    /** ARRAY en raíz -> crea nodo array y conecta hijos objeto */
    const visitArrayRoot = (
      arr: unknown[],
      path: (string | number)[],
      depth: number
    ) => {
      const id = makeId(path);
      const arrays = { items: { length: arr.length } as ArrayBadge };

      nodes.push({
        id,
        level: 'json-array',
        data: arr,
        rank: depth,
        jsonMeta: {
          kind: 'array',
          depth,
          arrays,
          preview: `[${arr.length}]`,
          title: 'Array',
        },
      });

      if (depth >= maxDepth) return;

      // materializar hijos objeto en arrays raíz
      let created = 0;
      for (let i = 0; i < arr.length && created < maxChildren; i++) {
        const el = arr[i];
        if (el && typeof el === 'object' && !Array.isArray(el)) {
          visitAny(el, [...path, i], depth + 1, id, String(i));
          created++;
        }
      }
    };

    /** Dispatcher genérico */
    const visitAny = (
      value: unknown,
      path: (string | number)[],
      depth: number,
      parentId?: string,
      edgeLabel?: string
    ) => {
      if (value && typeof value === 'object') {
        if (Array.isArray(value)) return visitArrayRoot(value, path, depth);
        return visitObject(
          value as Record<string, unknown>,
          path,
          depth,
          parentId,
          edgeLabel
        );
      }
      // raíz primitiva => crea nodo 'value'
      if (!parentId) {
        const id = makeId(path);
        nodes.push({
          id,
          level: 'json-value',
          data: value,
          rank: depth,
          jsonMeta: { kind: 'value', depth, preview: previewOf(value) },
        });
      }
    };

    // Raíz
    if (Array.isArray(data)) visitArrayRoot(data, [], 0);
    else if (data && typeof data === 'object')
      visitObject(data as Record<string, unknown>, [], 0);
    else visitAny(data, [], 0);

    return { nodes, edges };
  }
}
