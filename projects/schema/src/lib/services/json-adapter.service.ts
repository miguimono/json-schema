// path: projects/schema/src/lib/json-adapter.service.ts

import { Injectable } from '@angular/core';
import {
  DEFAULT_OPTIONS,
  NormalizedGraph,
  SchemaEdge,
  SchemaNode,
  SchemaOptions,
} from '../models';

@Injectable({ providedIn: 'root' })
export class JsonAdapterService {
  normalize(input: any, opts: Partial<SchemaOptions> = {}): NormalizedGraph {
    const options: SchemaOptions = { ...DEFAULT_OPTIONS, ...opts };
    const nodes: SchemaNode[] = [];
    const edges: SchemaEdge[] = [];

    const isScalar = (v: any) =>
      v === null || ['string', 'number', 'boolean'].includes(typeof v);

    const arrayIsScalar = (arr: any[]) => arr.length > 0 && arr.every(isScalar);

    const pickTitle = (obj: any): { title: string; usedKey?: string } => {
      // 1) si hay prioridad, úsala
      for (const k of options.titleKeyPriority) {
        const v = obj?.[k];
        if (v != null && String(v).trim() !== '')
          return { title: String(v), usedKey: k };
      }
      // 2) fallback: primer escalar encontrado
      for (const [k, v] of Object.entries(obj ?? {})) {
        if (isScalar(v)) return { title: String(v), usedKey: k };
      }
      // 3) último fallback
      return { title: 'Item' };
    };

    const buildPreviewAttributes = (
      obj: any,
      usedTitleKey?: string
    ): Record<string, any> => {
      if (!obj || typeof obj !== 'object') return {};
      const entries: [string, any][] = [];
      for (const [k, v] of Object.entries(obj)) {
        if (k === usedTitleKey) continue; // 👈 no duplicar título
        if ((options.hiddenKeysGlobal ?? []).includes(k)) continue; // solo afecta preview
        if (isScalar(v)) {
          entries.push([k, v]);
        } else if (
          Array.isArray(v) &&
          options.treatScalarArraysAsAttribute &&
          arrayIsScalar(v)
        ) {
          entries.push([k, v.join(', ')]);
        }
      }
      return Object.fromEntries(entries.slice(0, options.previewMaxKeys));
    };

    const isEntity = (obj: any): boolean => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
      // entidad si tiene algún escalar o si calzó prioridad (aunque ésta esté vacía)
      return Object.values(obj).some(isScalar);
    };

    const isCollapsibleWrapper = (obj: any): boolean => {
      if (!options.collapseSingleChildWrappers) return false;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
      // si tiene escalares, no colapsa
      if (Object.values(obj).some(isScalar)) return false;
      // cuenta hijos objeto
      let objs = 0;
      for (const v of Object.values(obj)) {
        if (v && typeof v === 'object')
          objs += Array.isArray(v)
            ? v.some((x) => x && typeof x === 'object')
              ? 1
              : 0
            : 1;
        if (objs > 1) break;
      }
      return objs === 1;
    };

    const addNode = (jsonPath: string, obj: any, parentId?: string) => {
      const { title, usedKey } = pickTitle(obj);
      const attrs = buildPreviewAttributes(obj, usedKey);
      const node: SchemaNode = {
        id: jsonPath,
        jsonPath,
        label: title,
        data: obj,
        jsonMeta: { title, attributes: attrs, childrenCount: 0 },
        // tamaño mínimo; luego lo ajusta el auto-size del schema (si lo tienes)
        width: 180,
        height: 72,
      };
      nodes.push(node);
      if (parentId)
        edges.push({
          id: `${parentId}__${node.id}`,
          source: parentId,
          target: node.id,
        });
      return node.id;
    };

    const childCounter = new Map<string, number>();

    const traverse = (val: any, path: string, parentId?: string, depth = 0) => {
      if (options.maxDepth !== null && depth > options.maxDepth) return;
      if (Array.isArray(val)) {
        val.forEach((c, i) =>
          traverse(c, `${path}[${i}]`, parentId, depth + 1)
        );
        return;
      }
      if (val && typeof val === 'object') {
        if (isCollapsibleWrapper(val)) {
          for (const [k, v] of Object.entries(val)) {
            if (v && typeof v === 'object') {
              traverse(v, `${path}.${k}`, parentId, depth + 1);
              break;
            }
          }
          return;
        }
        let myId = parentId;
        if (isEntity(val)) {
          myId = addNode(path, val, parentId);
          if (parentId)
            childCounter.set(parentId, (childCounter.get(parentId) ?? 0) + 1);
        }
        for (const [k, v] of Object.entries(val)) {
          if (isScalar(v)) continue;
          if (Array.isArray(v)) {
            const scalarArr = v.length > 0 && v.every(isScalar);
            if (scalarArr && options.treatScalarArraysAsAttribute) continue;
            v.forEach((c, i) =>
              traverse(c, `${path}.${k}[${i}]`, myId, depth + 1)
            );
          } else {
            traverse(v, `${path}.${k}`, myId, depth + 1);
          }
        }
      }
    };

    traverse(input, '$', undefined, 0);
    nodes.forEach(
      (n) => (n.jsonMeta!.childrenCount = childCounter.get(n.id) ?? 0)
    );
    return { nodes, edges, meta: {} };
  }
}
