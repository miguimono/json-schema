// path: projects/schema/src/lib/json-adapter.service.ts
// Cambios mínimos: eliminar el uso de `hidden` al TRAVERSAR. Se mantiene para el preview.

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

    const hidden = new Set(options.hiddenKeysGlobal ?? []);

    const isScalar = (v: any) =>
      v === null || ['string', 'number', 'boolean'].includes(typeof v);

    const arrayIsScalar = (arr: any[]) => arr.length > 0 && arr.every(isScalar);

    const hasAnyTitleKey = (obj: any) =>
      options.titleKeyPriority.some(
        (k) => obj && obj[k] != null && String(obj[k]).trim() !== ''
      );

    const countScalarProps = (obj: any) =>
      Object.entries(obj ?? {}).filter(([k, v]) => isScalar(v)).length; // ← quitamos filtro por `hidden`

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

    const addNode = (
      jsonPath: string,
      obj: any,
      parentId?: string,
      containerKeyForEdge?: string
    ) => {
      const id = jsonPath;
      const attributes = buildPreviewAttributes(obj);

      const node: SchemaNode = {
        id,
        jsonPath,
        label: resolveTitle(obj),
        data: obj,
        jsonMeta: { title: resolveTitle(obj), attributes },
      };
      nodes.push(node);

      if (parentId) {
        edges.push({
          id: `${parentId}__${id}`,
          source: parentId,
          target: id,
          label: options.edgeLabelFromContainerKey
            ? containerKeyForEdge
            : undefined,
        });
      }
      return id;
    };

    const buildPreviewAttributes = (obj: any): Record<string, any> => {
      if (!obj || typeof obj !== 'object') return {};
      const entries: [string, any][] = [];

      for (const [k, v] of Object.entries(obj)) {
        if (hidden.has(k)) continue; // ← `hidden` SOLO aplica a preview
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
      if (hasAnyTitleKey(obj)) return true;
      if (countScalarProps(obj) > 0) return true;
      return false;
    };

    const isCollapsibleWrapper = (obj: any): boolean => {
      if (!options.collapseSingleChildWrappers) return false;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;

      const scalarCount = countScalarProps(obj);
      if (scalarCount > 0 || hasAnyTitleKey(obj)) return false;

      let objChildren = 0;
      for (const [, v] of Object.entries(obj)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) objChildren++;
        if (Array.isArray(v) && v.some((el) => el && typeof el === 'object'))
          objChildren++;
        if (objChildren > 1) break;
      }
      return objChildren === 1;
    };

    const traverse = (
      val: any,
      path: string,
      parentId?: string,
      containerKeyForEdge?: string,
      depth: number = 0
    ) => {
      if (options.maxDepth !== null && depth > options.maxDepth) return;

      if (Array.isArray(val)) {
        val.forEach((child, i) => {
          traverse(
            child,
            `${path}[${i}]`,
            parentId,
            containerKeyForEdge,
            depth + 1
          );
        });
        return;
      }

      if (isScalar(val)) return;

      if (val && typeof val === 'object') {
        if (isCollapsibleWrapper(val)) {
          for (const [k, v] of Object.entries(val)) {
            if (v && typeof v === 'object') {
              traverse(v, `${path}.${k}`, parentId, k, depth + 1);
              break;
            }
          }
          return;
        }

        let myId: string | undefined;
        if (isEntity(val)) {
          myId = addNode(path, val, parentId, containerKeyForEdge);
        } else {
          myId = parentId;
        }

        for (const [k, v] of Object.entries(val)) {
          // ⚠️ ya NO se salta por `hidden`: siempre se recorre
          if (isScalar(v)) continue;

          if (Array.isArray(v)) {
            if (options.treatScalarArraysAsAttribute && arrayIsScalar(v)) {
              continue; // como atributo en preview
            }
            v.forEach((child, i) => {
              traverse(child, `${path}.${k}[${i}]`, myId, k, depth + 1);
            });
            continue;
          }

          traverse(v, `${path}.${k}`, myId, k, depth + 1);
        }
      }
    };

    traverse(input, '$', undefined, undefined, 0);
    return { nodes, edges, meta: {} };
  }
}
