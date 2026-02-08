/**
 * Servicio: JsonAdapterService
 * Convierte un JSON arbitrario en un grafo normalizado (nodes + edges).
 * - Aplica reglas de extracción (titleKeyPriority, hiddenKeysGlobal, etc.).
 * - Conservar rutas únicas (`jsonPath`) como IDs de nodos.
 * - Incluye metadatos útiles (childOrder, arrayCounts, atributos).
 * - No calcula layout.
 */

import { Injectable } from "@angular/core";
import { DEFAULT_SETTINGS, NormalizedGraph, SchemaEdge, SchemaNode, SchemaSettings } from "../models";

@Injectable({ providedIn: "root" })
export class JsonAdapterService {
  /**
   * Normaliza un JSON a grafo de nodos y aristas.
   * @param input Objeto JSON arbitrario.
   * @param opts  Configuración parcial (`SchemaSettings`).
   */
  normalize(input: any, opts: Partial<SchemaSettings> = {}): NormalizedGraph {
    // Merge por secciones
    const settings: Required<SchemaSettings> = {
      colors: { ...DEFAULT_SETTINGS.colors, ...(opts.colors ?? {}) },
      layout: { ...DEFAULT_SETTINGS.layout, ...(opts.layout ?? {}) },
      dataView: { ...DEFAULT_SETTINGS.dataView, ...(opts.dataView ?? {}) },
      messages: { ...DEFAULT_SETTINGS.messages, ...(opts.messages ?? {}) },
      viewport: { ...DEFAULT_SETTINGS.viewport, ...(opts.viewport ?? {}) },
    };

    // Accesos rápidos
    const dv = settings.dataView;
    const titleKeyPriority = dv.titleKeyPriority ?? [];
    const hiddenKeysGlobal: string[] = dv.hiddenKeysGlobal ?? [];
    const treatScalarArraysAsAttribute = dv.treatScalarArraysAsAttribute ?? false;
    const previewMaxKeys = dv.previewMaxKeys ?? 999;
    const defaultNodeSize = dv.defaultNodeSize ?? { width: 256, height: 64 };
    const maxDepth = dv.maxDepth ?? null;

    // Claves a ocultar explícitamente en preview
    const imageKey = dv.showImage && dv.showImage.trim() !== "" ? dv.showImage : null;
    const accentKey =
      settings.colors.accentByKey && settings.colors.accentByKey.trim() !== "" ? settings.colors.accentByKey : null;

    const nodes: SchemaNode[] = [];
    const edges: SchemaEdge[] = [];

    // Helpers
    const isScalar = (v: unknown): boolean => v === null || ["string", "number", "boolean"].includes(typeof v);
    /** Determina si un array contiene solo escalares. */

    const arrayIsScalar = (arr: unknown[]): boolean => Array.isArray(arr) && arr.length > 0 && arr.every(isScalar);
    /**
     * Escoge un título a partir de prioridades de clave.
     * Retorna también la clave usada para no duplicar en atributos.
     */ const pickTitle = (obj: any, priorities: string[]): { title: string; usedKey?: string } => {
      if (Array.isArray(priorities) && priorities.length > 0) {
        for (const k of priorities) {
          const v = obj?.[k];
          if (v != null && String(v).trim() !== "") {
            return { title: String(v), usedKey: k };
          }
        }
      }
      return { title: "", usedKey: undefined };
    };

    /**
     * Construye un subconjunto de atributos (clave → valor) para vista previa.
     * - Excluye claves ocultas o la usada como título.
     * - Incluye escalares y arrays escalares (si está habilitado).
     */
    const buildPreviewAttributes = (obj: any, usedKey?: string): Record<string, any> => {
      const toHide = new Set<string>(hiddenKeysGlobal);
      if (usedKey) toHide.add(usedKey);
      if (imageKey) toHide.add(imageKey);
      if (accentKey) toHide.add(accentKey);

      const entries: [string, any][] = [];
      for (const [k, v] of Object.entries(obj ?? {})) {
        if (toHide.has(k)) continue;
        if (isScalar(v)) {
          entries.push([k, v]);
        } else if (Array.isArray(v) && treatScalarArraysAsAttribute && arrayIsScalar(v)) {
          entries.push([k, v.join(", ")]);
        }
      }
      return Object.fromEntries(entries.slice(0, previewMaxKeys));
    };
    /** Determina si un objeto puede representarse como entidad (nodo). */

    const isEntity = (obj: unknown): obj is Record<string, unknown> => {
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
      return Object.values(obj).some(isScalar);
    };
    /** Retorna un mapa clave → longitud de arrays no escalares. */

    const arrayCountsOf = (obj: Record<string, unknown>): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(obj)) {
        if (Array.isArray(v) && !(v.length > 0 && v.every(isScalar))) {
          out[k] = v.length;
        }
      }
      return out;
    };
    // Contadores auxiliares

    const childCounter = new Map<string, number>();
    const childOrderByParent = new Map<string, number>();
    /**
     * Crea un nodo y opcionalmente una arista hacia su padre.
     */
    const addNode = (jsonPath: string, obj: Record<string, unknown>, parentId?: string): string => {
      const { title, usedKey } = pickTitle(obj, titleKeyPriority);
      const attrs = buildPreviewAttributes(obj, usedKey);
      // Orden relativo entre hermanos

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
          titleKeyUsed: usedKey,
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
     * Recorrido recursivo del JSON.
     * - Usa `jsonPath` para mantener rutas únicas.
     * - Crea nodos solo cuando `isEntity(obj)` es verdadero.
     */
    const traverse = (val: unknown, path: string, parentId?: string, depth = 0) => {
      if (maxDepth !== null && depth > maxDepth) return;

      if (Array.isArray(val)) {
        val.forEach((c, i) => traverse(c, `${path}[${i}]`, parentId, depth + 1));
        return;
      }

      if (val && typeof val === "object") {
        const obj = val as Record<string, unknown>;

        let myId = parentId;
        if (isEntity(obj)) {
          myId = addNode(path, obj, parentId);
          if (parentId) childCounter.set(parentId, (childCounter.get(parentId) ?? 0) + 1);
        }

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

    traverse(input, "$", undefined, 0);
    // Completar metadatos (childrenCount)
    nodes.forEach((n) => {
      n.jsonMeta = n.jsonMeta ?? {};
      n.jsonMeta.childrenCount = childCounter.get(n.id) ?? 0;
    });

    return { nodes, edges, meta: {} };
  }
}
