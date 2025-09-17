// projects/schema/src/lib/services/json-adapter.service.ts

import { Injectable } from '@angular/core';
import {
  DEFAULT_OPTIONS,
  NormalizedGraph,
  SchemaEdge,
  SchemaNode,
  SchemaOptions,
} from '../models';

/**
 * Servicio que convierte un JSON arbitrario en un grafo normalizado (nodos + aristas).
 *
 * Reglas principales:
 * - Entidad = objeto con al menos un escalar → genera un nodo.
 * - Arrays de escalares → (opcionalmente) atributo concatenado en el preview.
 * - Wrappers de único hijo objeto (sin escalares) → se colapsan (si está activado).
 * - Se preserva orden de hermanos en jsonMeta.childOrder.
 * - childrenCount y arrayCounts se anotan en jsonMeta de cada nodo.
 */
@Injectable({ providedIn: 'root' })
export class JsonAdapterService {
  /**
   * Convierte un input JSON en {@link NormalizedGraph}.
   * @param input JSON arbitrario.
   * @param opts Opciones parciales (se mezclan con {@link DEFAULT_OPTIONS}).
   * @returns Nodos y aristas normalizados con metadatos auxiliares.
   */
  normalize(input: any, opts: Partial<SchemaOptions> = {}): NormalizedGraph {
    const options: SchemaOptions = { ...DEFAULT_OPTIONS, ...opts };
    const nodes: SchemaNode[] = [];
    const edges: SchemaEdge[] = [];

    /** Determina si un valor es escalar (string, number, boolean o null). */
    const isScalar = (v: any) =>
      v === null || ['string', 'number', 'boolean'].includes(typeof v);

    /** True si el array contiene al menos un elemento y todos son escalares. */
    const arrayIsScalar = (arr: any[]) => arr.length > 0 && arr.every(isScalar);

    /**
     * Elige un título para la card:
     * - Busca por prioridades; si encuentra una clave con valor no vacío, retorna.
     * - Si no, usa el primer escalar que aparezca en el objeto.
     * - Como fallback, "Item".
     */
    const pickTitle = (obj: any, priorities: string[]) => {
      if (priorities.length) {
        for (const k of priorities) {
          const v = obj?.[k];
          if (v != null && String(v).trim() !== '') {
            return { title: String(v), usedKey: k };
          }
        }
      }
      const firstScalar = Object.entries(obj ?? {}).find(([_, v]) =>
        isScalar(v)
      );
      if (firstScalar)
        return { title: String(firstScalar[1]), usedKey: undefined };
      return { title: 'Item', usedKey: undefined };
    };

    /**
     * Construye atributos de vista previa:
     * - Omite claves ocultas (hiddenKeysGlobal) y la clave usada para el título.
     * - Incluye escalares.
     * - Incluye arrays de escalares como string concatenado, si la opción está activa.
     * - Limita la cantidad con previewMaxKeys.
     */
    const buildPreviewAttributes = (
      obj: any,
      usedKey?: string,
      options: SchemaOptions = DEFAULT_OPTIONS
    ) => {
      const entries: [string, any][] = [];
      for (const [k, v] of Object.entries(obj ?? {})) {
        if ((options.hiddenKeysGlobal ?? []).includes(k)) continue;
        if (usedKey && k === usedKey) continue;
        if (isScalar(v)) entries.push([k, v]);
        else if (
          Array.isArray(v) &&
          options.treatScalarArraysAsAttribute &&
          arrayIsScalar(v)
        ) {
          entries.push([k, v.join(', ')]);
        }
      }
      return Object.fromEntries(entries.slice(0, options.previewMaxKeys));
    };

    /** True si es un objeto con al menos un escalar (se convierte en nodo). */
    const isEntity = (obj: any): boolean => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
      return Object.values(obj).some(isScalar);
    };

    /**
     * True si es un "wrapper" con un único hijo objeto/array no escalar y sin escalares propios.
     * En ese caso, si está activado, se colapsa para evitar nodos vacíos.
     */
    const isCollapsibleWrapper = (obj: any): boolean => {
      if (!options.collapseSingleChildWrappers) return false;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
      if (Object.values(obj).some(isScalar)) return false;

      let objs = 0;
      for (const v of Object.values(obj)) {
        if (v && typeof v === 'object') {
          if (Array.isArray(v)) {
            if (v.some((x) => x && typeof x === 'object')) objs += 1;
          } else {
            objs += 1;
          }
        }
        if (objs > 1) break;
      }
      return objs === 1;
    };

    /** Obtiene tamaños de arrays no escalares por clave. */
    const arrayCountsOf = (obj: any) => {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(obj ?? {})) {
        if (Array.isArray(v) && !(v.length > 0 && v.every(isScalar))) {
          out[k] = v.length;
        }
      }
      return out;
    };

    // Contadores y orden relativos por padre
    const childCounter = new Map<string, number>();
    const childOrderByParent = new Map<string, number>();

    /**
     * Agrega un nodo y la arista con su padre (si aplica).
     * - Define jsonMeta.title y jsonMeta.attributes.
     * - Asigna jsonMeta.childOrder usando un contador por padre.
     * @param jsonPath Ruta JSON de este valor/nodo.
     * @param obj Objeto fuente (entidad).
     * @param parentId ID del nodo padre (si existe).
     * @returns ID asignado al nodo nuevo.
     */
    const addNode = (jsonPath: string, obj: any, parentId?: string) => {
      const { title, usedKey } = pickTitle(obj, options.titleKeyPriority);
      const attrs = buildPreviewAttributes(obj, usedKey, options);

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
        data: obj,
        jsonMeta: {
          title,
          attributes: attrs,
          childrenCount: 0,
          arrayCounts: arrayCountsOf(obj),
          childOrder,
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

    /**
     * Recorre el input respetando el orden natural de Object.entries y los índices de arrays.
     * - Crea nodos sólo para entidades.
     * - Colapsa wrappers de único hijo si la opción está activa.
     * - Actualiza childrenCount por padre.
     * @param val Valor actual del recorrido.
     * @param path Ruta JSON del valor actual.
     * @param parentId ID de nodo padre (si existe).
     * @param depth Profundidad actual (para maxDepth).
     */
    const traverse = (val: any, path: string, parentId?: string, depth = 0) => {
      if (options.maxDepth !== null && depth > options.maxDepth) return;

      if (Array.isArray(val)) {
        val.forEach((c, i) =>
          traverse(c, `${path}[${i}]`, parentId, depth + 1)
        );
        return;
      }

      if (val && typeof val === 'object') {
        // Colapso de wrapper con único hijo no escalar
        if (isCollapsibleWrapper(val)) {
          for (const [k, v] of Object.entries(val)) {
            if (v && typeof v === 'object') {
              traverse(v, `${path}.${k}`, parentId, depth + 1);
              break;
            }
          }
          return;
        }

        // Si es entidad, crea nodo y actualiza contadores
        let myId = parentId;
        if (isEntity(val)) {
          myId = addNode(path, val, parentId);
          if (parentId)
            childCounter.set(parentId, (childCounter.get(parentId) ?? 0) + 1);
        }

        // Recorrer hijos compuestos
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

    // Raíz
    traverse(input, '$', undefined, 0);

    // childrenCount
    nodes.forEach(
      (n) => (n.jsonMeta!.childrenCount = childCounter.get(n.id) ?? 0)
    );

    return { nodes, edges, meta: {} };
  }
}
