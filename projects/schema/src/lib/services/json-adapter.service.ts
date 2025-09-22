// projects/schema/src/lib/services/json-adapter.service.ts
// URL: projects/schema/src/lib/services/json-adapter.service.ts

import { Injectable } from "@angular/core";
import { DEFAULT_SETTINGS, NormalizedGraph, SchemaEdge, SchemaNode, SchemaSettings } from "../models";

/**
 * Convierte un JSON arbitrario en un grafo normalizado (nodos + aristas).
 *
 * Reglas de normalización:
 * - Objeto con al menos un escalar ⇒ genera nodo (entidad).
 * - Arrays de escalares → si `dataView.treatScalarArraysAsAttribute === true`,
 *   se añaden como atributo concatenado en el preview.
 *   Ejemplo: `{ tags: ['rojo','verde'] }` ⇒ `tags: "rojo, verde"`.
 * - Se preserva el orden de hermanos en `jsonMeta.childOrder`.
 * - Se anotan `childrenCount` y `arrayCounts` por nodo.
 */
@Injectable({ providedIn: "root" })
export class JsonAdapterService {
  /**
   * Convierte un input JSON en {@link NormalizedGraph}.
   *
   * @param input JSON arbitrario.
   * @param opts  Settings parciales (se combinan con {@link DEFAULT_SETTINGS} por sección).
   * @returns Grafo con nodos, aristas y metadatos auxiliares.
   *
   * @example
   * ```ts
   * const graph = adapter.normalize(data, {
   *   dataView: {
   *     showTitle: true,
   *     titleKeyPriority: ['name','title','id'],
   *     treatScalarArraysAsAttribute: true
   *   }
   * });
   * ```
   */
  normalize(input: any, opts: Partial<SchemaSettings> = {}): NormalizedGraph {
    // Merge por secciones
    const settings: Required<SchemaSettings> = {
      colors: { ...DEFAULT_SETTINGS.colors, ...(opts.colors ?? {}) },
      layout: { ...DEFAULT_SETTINGS.layout, ...(opts.layout ?? {}) },
      dataView: { ...DEFAULT_SETTINGS.dataView, ...(opts.dataView ?? {}) },
      messages: { ...DEFAULT_SETTINGS.messages, ...(opts.messages ?? {}) },
      viewport: { ...DEFAULT_SETTINGS.viewport, ...(opts.viewport ?? {}) },
      debug: { ...DEFAULT_SETTINGS.debug, ...(opts.debug ?? {}) },
    };

    const dv = settings.dataView;

    // Valores efectivos (linter-safe)
    const titleKeyPriority = dv.titleKeyPriority ?? [];
    const hiddenKeysGlobal: string[] = dv.hiddenKeysGlobal ?? [];
    const treatScalarArraysAsAttribute = dv.treatScalarArraysAsAttribute ?? false;
    const previewMaxKeys = dv.previewMaxKeys ?? 999;
    const defaultNodeSize = dv.defaultNodeSize ?? { width: 256, height: 64 };
    const maxDepth = dv.maxDepth ?? null;
    const showTitle = dv.showTitle ?? DEFAULT_SETTINGS.dataView.showTitle;

    const nodes: SchemaNode[] = [];
    const edges: SchemaEdge[] = [];

    // === helpers ===
    const isScalar = (v: unknown): boolean => v === null || ["string", "number", "boolean"].includes(typeof v);

    const arrayIsScalar = (arr: unknown[]): boolean => Array.isArray(arr) && arr.length > 0 && arr.every(isScalar);

    /**
     * Selecciona título para una card.
     * - Busca por prioridades.
     * - Si no hay, usa el primer escalar del objeto.
     * - Si no existe, devuelve "Item".
     */
    const pickTitle = (obj: any, priorities: string[]): { title: string; usedKey?: string } => {
      if (Array.isArray(priorities) && priorities.length > 0) {
        for (const k of priorities) {
          const v = obj?.[k];
          if (v != null && String(v).trim() !== "") {
            return { title: String(v), usedKey: k };
          }
        }
      }
      // Fallback: primer escalar encontrado
      for (const [k, v] of Object.entries(obj ?? {})) {
        if (v == null) continue;
        const t = typeof v;
        if (t === "string" || t === "number" || t === "boolean") {
          return { title: String(v), usedKey: k };
        }
      }
      return { title: "", usedKey: undefined };
    };

    /**
     * Construye los atributos de vista previa para un nodo.
     * - Omite claves en `hiddenKeysGlobal`.
     * - Si `showTitle===true` y `usedKey` existe, omite esa clave (para no duplicar lo que ya se verá como título).
     * - Incluye escalares.
     * - Incluye arrays escalares como string concatenado si `treatScalarArraysAsAttribute=true`.
     * - Respeta `previewMaxKeys`.
     *
     * @example
     * // obj = { nivel: "Nivel0", se_muestra: "Se muestra", tags: ["red","green"] }
     * // showTitle = false -> incluye 'nivel' y 'se_muestra' en el preview
     * // showTitle = true  -> si usedKey="nivel", NO incluye 'nivel' en el preview
     */
    const buildPreviewAttributes = (obj: any, usedKey?: string): Record<string, any> => {
      const entries: [string, any][] = [];
      for (const [k, v] of Object.entries(obj ?? {})) {
        if (hiddenKeysGlobal.includes(k)) continue;

        // 👇 Solo ocultamos la clave del título cuando efectivamente se mostrará el título
        if (showTitle && usedKey && k === usedKey) continue;

        if (isScalar(v)) {
          entries.push([k, v]);
        } else if (Array.isArray(v) && treatScalarArraysAsAttribute && arrayIsScalar(v)) {
          entries.push([k, v.join(", ")]);
        }
      }
      return Object.fromEntries(entries.slice(0, previewMaxKeys));
    };

    const isEntity = (obj: unknown): obj is Record<string, unknown> => {
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
      return Object.values(obj).some(isScalar);
    };

    /** Tamaños de arrays no escalares por clave. */
    const arrayCountsOf = (obj: Record<string, unknown>): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (Array.isArray(v) && !(v.length > 0 && v.every(isScalar))) {
          out[k] = v.length;
        }
      }
      return out;
    };

    // Contadores de hijos y orden relativo
    const childCounter = new Map<string, number>();
    const childOrderByParent = new Map<string, number>();

    /**
     * Crea un nodo y su arista con el padre (si corresponde).
     */
    const addNode = (jsonPath: string, obj: Record<string, unknown>, parentId?: string): string => {
      const { title, usedKey } = pickTitle(obj, titleKeyPriority);
      const attrs = buildPreviewAttributes(obj, usedKey);

      // Orden relativo respecto al padre
      let childOrder: number | undefined = undefined;
      if (parentId) {
        const idx = childOrderByParent.get(parentId) ?? 0;
        childOrder = idx;
        childOrderByParent.set(parentId, idx + 1);
      }

      const node: SchemaNode = {
        id: jsonPath,
        jsonPath,
        label: title,
        data: obj as Record<string, any>,
        jsonMeta: {
          title,
          attributes: attrs,
          childrenCount: 0,
          arrayCounts: arrayCountsOf(obj),
          childOrder,
        },
        width: defaultNodeSize.width,
        height: defaultNodeSize.height,
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

    /**
     * Recorrido recursivo de construcción de grafo.
     */
    const traverse = (val: unknown, path: string, parentId?: string, depth = 0) => {
      if (maxDepth !== null && maxDepth !== undefined && depth > maxDepth) return;

      if (Array.isArray(val)) {
        val.forEach((c, i) => traverse(c, `${path}[${i}]`, parentId, depth + 1));
        return;
      }

      if (val && typeof val === "object") {
        const obj = val as Record<string, unknown>;

        // Entidad → nodo
        let myId = parentId;
        if (isEntity(obj)) {
          myId = addNode(path, obj, parentId);
          if (parentId) childCounter.set(parentId, (childCounter.get(parentId) ?? 0) + 1);
        }

        // Recorre hijos no escalares
        for (const [k, v] of Object.entries(obj)) {
          if (isScalar(v)) continue;

          if (Array.isArray(v)) {
            const scalarArr = v.length > 0 && v.every(isScalar);
            if (scalarArr && treatScalarArraysAsAttribute) continue;
            v.forEach((c, i) => traverse(c, `${path}.${k}[${i}]`, myId, depth + 1));
          } else {
            traverse(v, `${path}.${k}`, myId, depth + 1);
          }
        }
      }
    };

    // Inicio en raíz
    traverse(input, "$", undefined, 0);

    // childrenCount finales
    nodes.forEach((n) => {
      n.jsonMeta = n.jsonMeta ?? {};
      n.jsonMeta.childrenCount = childCounter.get(n.id) ?? 0;
    });

    return { nodes, edges, meta: {} };
  }
}
