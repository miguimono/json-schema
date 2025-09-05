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
    const childCounter = new Map<string, number>(); // 👈 para childrenCount

    const isScalar = (v: any) =>
      v === null || ['string', 'number', 'boolean'].includes(typeof v);

    const arrayIsScalar = (arr: any[]) => arr.length > 0 && arr.every(isScalar);

    const hasAnyTitleKey = (obj: any) =>
      options.titleKeyPriority.some(
        (k) => obj && obj[k] != null && String(obj[k]).trim() !== ''
      );

    const resolveTitle = (obj: any): string => {
      for (const k of options.titleKeyPriority) {
        const v = obj?.[k];
        if (v != null && String(v).trim() !== '') return String(v);
      }
      const firstScalar = Object.entries(obj ?? {}).find(([k, v]) =>
        isScalar(v)
      );
      return firstScalar ? String(firstScalar[1]) : 'Item';
    };

    const estimateSize = (
      title: string,
      attrsCount: number,
      longestLine: number
    ) => {
      // heurística simple: ancho por texto más padding; alto por líneas
      const minW = 180,
        minH = 72;
      const charW = 7.5; // px aprox por carácter
      const w = Math.max(
        minW,
        28 + Math.max(title.length, longestLine) * charW
      );
      const h = Math.max(minH, 28 + 18 + attrsCount * 16 + 8); // título + attrs
      return { width: Math.ceil(w), height: Math.ceil(h) };
    };

    const buildPreviewAttributes = (
      obj: any,
      usedTitleKey?: string
    ): Record<string, any> => {
      if (!obj || typeof obj !== 'object') return {};
      const entries: [string, any][] = [];

      for (const [k, v] of Object.entries(obj)) {
        // ocultar claves globales en preview
        if ((options.hiddenKeysGlobal ?? []).includes(k)) continue;
        // 👇 no duplicar el título en atributos
        if (usedTitleKey && k === usedTitleKey) continue;

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

    const titleKeyUsed = (obj: any): string | undefined => {
      for (const k of options.titleKeyPriority) {
        const v = obj?.[k];
        if (v != null && String(v).trim() !== '') return k;
      }
      return undefined;
    };

    const addNode = (
      jsonPath: string,
      obj: any,
      parentId?: string,
      containerKeyForEdge?: string
    ) => {
      const id = jsonPath;
      const title = resolveTitle(obj);
      const usedKey = titleKeyUsed(obj);
      const attrs = buildPreviewAttributes(obj, usedKey);

      // Longest line estimation
      const longestLine = Math.max(
        title.length,
        ...Object.entries(attrs).map(([k, v]) => `${k}: ${String(v)}`.length)
      );
      const { width, height } = estimateSize(
        title,
        Object.keys(attrs).length,
        longestLine
      );

      const node: SchemaNode = {
        id,
        jsonPath,
        label: title,
        data: obj,
        jsonMeta: { title, attributes: attrs, childrenCount: 0 },
        width,
        height,
      };
      nodes.push(node);

      if (parentId) {
        edges.push({
          id: `${parentId}__${id}`,
          source: parentId,
          target: id,
        });
        childCounter.set(parentId, (childCounter.get(parentId) ?? 0) + 1);
      }
      return id;
    };

    const isEntity = (obj: any): boolean => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
      if (hasAnyTitleKey(obj)) return true;
      // si no tiene title, pero sí escalares → también es entidad
      return Object.entries(obj ?? {}).some(([k, v]) => isScalar(v));
    };

    const isCollapsibleWrapper = (obj: any): boolean => {
      if (!options.collapseSingleChildWrappers) return false;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;

      const hasScalars = Object.entries(obj).some(([k, v]) => isScalar(v));
      if (hasScalars || hasAnyTitleKey(obj)) return false;

      let objChildren = 0;
      for (const [, v] of Object.entries(obj)) {
        if (v && typeof v === 'object') objChildren++;
        if (Array.isArray(v) && v.some((el) => el && typeof el === 'object'))
          objChildren++;
        if (objChildren > 1) break;
      }
      return objChildren === 1;
    };

    const traverse = (val: any, path: string, parentId?: string, depth = 0) => {
      if (options.maxDepth !== null && depth > options.maxDepth) return;

      if (Array.isArray(val)) {
        val.forEach((child, i) =>
          traverse(child, `${path}[${i}]`, parentId, depth + 1)
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

        let myId: string | undefined;
        if (isEntity(val)) {
          myId = addNode(path, val, parentId);
        } else {
          myId = parentId;
        }

        for (const [k, v] of Object.entries(val)) {
          if (isScalar(v)) continue;
          if (Array.isArray(v)) {
            if (options.treatScalarArraysAsAttribute && arrayIsScalar(v))
              continue;
            v.forEach((child, i) =>
              traverse(child, `${path}.${k}[${i}]`, myId, depth + 1)
            );
          } else {
            traverse(v, `${path}.${k}`, myId, depth + 1);
          }
        }
      }
    };

    traverse(input, '$', undefined, 0);

    // aplicar childrenCount
    nodes.forEach((n) => {
      n.jsonMeta = n.jsonMeta ?? {};
      n.jsonMeta.childrenCount = childCounter.get(n.id) ?? 0;
    });

    return { nodes, edges, meta: {} };
  }
}
