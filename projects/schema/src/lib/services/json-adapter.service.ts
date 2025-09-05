// path: projects/schema/src/lib/json-adapter.service.ts

import { Injectable } from "@angular/core";
import { DEFAULT_OPTIONS, NormalizedGraph, SchemaEdge, SchemaNode, SchemaOptions } from "../models";

@Injectable({ providedIn: "root" })
export class JsonAdapterService {
  normalize(input: any, opts: Partial<SchemaOptions> = {}): NormalizedGraph {
    const options: SchemaOptions = { ...DEFAULT_OPTIONS, ...opts };
    const nodes: SchemaNode[] = [];
    const edges: SchemaEdge[] = [];

    const hidden = new Set(options.hiddenKeysGlobal ?? []);

    // ===== Helpers =====
    const isScalar = (v: any) => v === null || ["string", "number", "boolean"].includes(typeof v);

    const arrayIsScalar = (arr: any[]) => arr.length > 0 && arr.every(isScalar);

    const hasAnyTitleKey = (obj: any) =>
      options.titleKeyPriority.some((k) => obj && obj[k] != null && String(obj[k]).trim() !== "");

    const countScalarProps = (obj: any) =>
      Object.entries(obj ?? {}).filter(([k, v]) => !hidden.has(k) && isScalar(v)).length;

    const resolveTitle = (obj: any): string => {
      for (const k of options.titleKeyPriority) {
        const v = obj?.[k];
        if (v != null && String(v).trim() !== "") return String(v);
      }
      // fallback: primer escalar
      const firstScalar = Object.entries(obj ?? {}).find(([k, v]) => isScalar(v));
      if (firstScalar) return String(firstScalar[1]);
      // último fallback
      return "Item";
    };

    const addNode = (jsonPath: string, obj: any, parentId?: string, containerKeyForEdge?: string) => {
      const id = jsonPath; // estable
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
          label: options.edgeLabelFromContainerKey ? containerKeyForEdge : undefined,
        });
      }
      return id;
    };

    const buildPreviewAttributes = (obj: any): Record<string, any> => {
      if (!obj || typeof obj !== "object") return {};
      const entries: [string, any][] = [];

      for (const [k, v] of Object.entries(obj)) {
        if (hidden.has(k)) continue;
        if (isScalar(v)) {
          entries.push([k, v]);
        } else if (Array.isArray(v) && options.treatScalarArraysAsAttribute && arrayIsScalar(v)) {
          // Unir arrays de escalares como string corto
          entries.push([k, v.join(", ")]);
        }
      }

      return Object.fromEntries(entries.slice(0, options.previewMaxKeys));
    };

    // Decide si un objeto debe ser nodo (entidad) o wrapper a colapsar
    const isEntity = (obj: any): boolean => {
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
      if (hasAnyTitleKey(obj)) return true;
      if (countScalarProps(obj) > 0) return true;
      return false;
    };

    // Si un objeto no tiene escalares ni title, y solo 1 hijo objeto → wrapper colapsable
    const isCollapsibleWrapper = (obj: any): boolean => {
      if (!options.collapseSingleChildWrappers) return false;
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;

      const scalarCount = countScalarProps(obj);
      if (scalarCount > 0 || hasAnyTitleKey(obj)) return false;

      let objChildren = 0;
      for (const [k, v] of Object.entries(obj)) {
        if (hidden.has(k)) continue;
        if (v && typeof v === "object" && !Array.isArray(v)) objChildren++;
        if (Array.isArray(v) && v.some((el) => el && typeof el === "object")) objChildren++;
        if (objChildren > 1) break;
      }
      return objChildren === 1;
    };

    // ===== Traversal genérico =====
    const traverse = (val: any, path: string, parentId?: string, containerKeyForEdge?: string, depth: number = 0) => {
      if (options.maxDepth !== null && depth > options.maxDepth) return;

      // Arrays
      if (Array.isArray(val)) {
        if (options.collapseArrayContainers) {
          val.forEach((child, i) => {
            traverse(child, `${path}[${i}]`, parentId, containerKeyForEdge, depth + 1);
          });
        } else {
          // Si NO colapsa arrays, podrían modelarse como nodo (no recomendado)
          // Por tu objetivo, lo dejamos colapsado siempre (default true).
          val.forEach((child, i) => {
            traverse(child, `${path}[${i}]`, parentId, containerKeyForEdge, depth + 1);
          });
        }
        return;
      }

      // Escalares → atributos del padre (ya manejado por buildPreviewAttributes)
      if (isScalar(val)) {
        // Nada que hacer aquí: lo recogerá el padre si corresponde.
        return;
      }

      // Objetos
      if (val && typeof val === "object") {
        // Wrapper colapsable: baja directo al único hijo objeto
        if (isCollapsibleWrapper(val)) {
          for (const [k, v] of Object.entries(val)) {
            if (hidden.has(k)) continue;
            if (v && typeof v === "object") {
              const childPath = `${path}.${k}`;
              traverse(v, childPath, parentId, k, depth + 1);
              break;
            }
          }
          return;
        }

        // Entidad real → crear nodo
        let myId: string | undefined;
        if (isEntity(val)) {
          myId = addNode(path, val, parentId, containerKeyForEdge);
        } else {
          // Objeto sin escalares ni title y con múltiples hijos: podría ser contenedor.
          // No creamos nodo y bajamos a sus hijos.
          myId = parentId;
        }

        // Recorremos hijos
        for (const [k, v] of Object.entries(val)) {
          if (hidden.has(k)) continue;

          // Escalares: no crean nodos (quedan como atributos del mío)
          if (isScalar(v)) continue;

          // Arrays: conectar hijos con este (sin nodo intermedio)
          if (Array.isArray(v)) {
            if (options.treatScalarArraysAsAttribute && arrayIsScalar(v)) {
              // Ya quedó como atributo
              continue;
            }
            v.forEach((child, i) => {
              traverse(child, `${path}.${k}[${i}]`, myId, k, depth + 1);
            });
            continue;
          }

          // Objetos
          traverse(v, `${path}.${k}`, myId, k, depth + 1);
        }
      }
    };

    // Punto de entrada: si viene envuelto, intenta empezar por la raíz real
    // Usa '$' como raíz JSONPath
    traverse(input, "$", undefined, undefined, 0);

    return { nodes, edges, meta: {} };
  }
}
