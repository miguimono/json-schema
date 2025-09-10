import { Injectable } from "@angular/core";
import { DEFAULT_OPTIONS, NormalizedGraph, SchemaEdge, SchemaNode, SchemaOptions } from "../models";

@Injectable({ providedIn: "root" })
export class JsonAdapterService {
  /**
   * Convierte un JSON en un grafo normalizado (nodes/edges).
   * - Entidades: objetos con al menos un escalar.
   * - Arrays de escalares: opcionalmente como atributos (preview).
   * - Wrappers con único hijo objeto: colapsables.
   */
  normalize(input: any, opts: Partial<SchemaOptions> = {}): NormalizedGraph {
    const options: SchemaOptions = { ...DEFAULT_OPTIONS, ...opts };
    const nodes: SchemaNode[] = [];
    const edges: SchemaEdge[] = [];

    const isScalar = (v: any) => v === null || ["string", "number", "boolean"].includes(typeof v);

    const arrayIsScalar = (arr: any[]) => arr.length > 0 && arr.every(isScalar);

    const pickTitle = (obj: any, priorities: string[]) => {
      if (priorities.length) {
        for (const k of priorities) {
          const v = obj?.[k];
          if (v != null && String(v).trim() !== "") {
            return { title: String(v), usedKey: k };
          }
        }
      }
      const firstScalar = Object.entries(obj ?? {}).find(([_, v]) => isScalar(v));
      if (firstScalar) return { title: String(firstScalar[1]), usedKey: undefined };
      return { title: "Item", usedKey: undefined };
    };

    const buildPreviewAttributes = (obj: any, usedTitleKey?: string, options: SchemaOptions = DEFAULT_OPTIONS) => {
      const entries: [string, any][] = [];
      for (const [k, v] of Object.entries(obj ?? {})) {
        if ((options.hiddenKeysGlobal ?? []).includes(k)) continue;
        if (usedTitleKey && k === usedTitleKey) continue;
        if (isScalar(v)) entries.push([k, v]);
        else if (Array.isArray(v) && options.treatScalarArraysAsAttribute && arrayIsScalar(v)) {
          entries.push([k, v.join(", ")]);
        }
      }
      return Object.fromEntries(entries.slice(0, options.previewMaxKeys));
    };

    const isEntity = (obj: any): boolean => {
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
      return Object.values(obj).some(isScalar);
    };

    const isCollapsibleWrapper = (obj: any): boolean => {
      if (!options.collapseSingleChildWrappers) return false;
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
      if (Object.values(obj).some(isScalar)) return false;

      let objs = 0;
      for (const v of Object.values(obj)) {
        if (v && typeof v === "object") {
          if (Array.isArray(v)) {
            if (v.some((x) => x && typeof x === "object")) objs += 1;
          } else {
            objs += 1;
          }
        }
        if (objs > 1) break;
      }
      return objs === 1;
    };

    const arrayCountsOf = (obj: any) => {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(obj ?? {})) {
        if (Array.isArray(v) && !(v.length > 0 && v.every(isScalar))) {
          out[k] = v.length;
        }
      }
      return out;
    };

    const addNode = (jsonPath: string, obj: any, parentId?: string) => {
      const { title, usedKey } = pickTitle(obj, options.titleKeyPriority);
      const attrs = buildPreviewAttributes(obj, usedKey, options);
      const node: SchemaNode = {
        id: jsonPath,
        jsonPath,
        label: title,
        data: obj,
        jsonMeta: {
          title,
          attributes: attrs,
          childrenCount: 0,
          arrayCounts: arrayCountsOf(obj),
        },
        width: options.defaultNodeSize?.width ?? 220,
        height: options.defaultNodeSize?.height ?? 96,
      };
      nodes.push(node);
      if (parentId) {
        edges.push({
          id: `${parentId}__${node.id}`,
          source: parentId,
          target: node.id,
        });
      }
      return node.id;
    };

    const childCounter = new Map<string, number>();

    const traverse = (val: any, path: string, parentId?: string, depth = 0) => {
      if (options.maxDepth !== null && depth > options.maxDepth) return;

      if (Array.isArray(val)) {
        val.forEach((c, i) => traverse(c, `${path}[${i}]`, parentId, depth + 1));
        return;
      }

      if (val && typeof val === "object") {
        if (isCollapsibleWrapper(val)) {
          for (const [k, v] of Object.entries(val)) {
            if (v && typeof v === "object") {
              traverse(v, `${path}.${k}`, parentId, depth + 1);
              break;
            }
          }
          return;
        }

        let myId = parentId;
        if (isEntity(val)) {
          myId = addNode(path, val, parentId);
          if (parentId) childCounter.set(parentId, (childCounter.get(parentId) ?? 0) + 1);
        }

        for (const [k, v] of Object.entries(val)) {
          if (isScalar(v)) continue;

          if (Array.isArray(v)) {
            const scalarArr = v.length > 0 && v.every(isScalar);
            if (scalarArr && options.treatScalarArraysAsAttribute) continue;
            v.forEach((c, i) => traverse(c, `${path}.${k}[${i}]`, myId, depth + 1));
          } else {
            traverse(v, `${path}.${k}`, myId, depth + 1);
          }
        }
      }
    };

    traverse(input, "$", undefined, 0);

    nodes.forEach((n) => (n.jsonMeta!.childrenCount = childCounter.get(n.id) ?? 0));

    return { nodes, edges, meta: {} };
  }
}
