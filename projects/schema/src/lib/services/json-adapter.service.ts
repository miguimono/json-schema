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
 * ### Reglas principales de normalización:
 * - **Entidad:** objeto con al menos un escalar → genera un nodo.
 * - **Arrays escalares:** opcionalmente se muestran como atributo concatenado (preview).
 * - **Wrappers de único hijo:** si no contienen escalares, se colapsan (opcional).
 * - **Orden de hermanos:** se preserva en `jsonMeta.childOrder`.
 * - **childrenCount** y **arrayCounts** se anotan en `jsonMeta`.
 */
@Injectable({ providedIn: 'root' })
export class JsonAdapterService {
  /**
   * Convierte un input JSON en {@link NormalizedGraph}.
   *
   * @param input JSON arbitrario de entrada.
   * @param opts Opciones parciales para normalización (se mezclan con {@link DEFAULT_OPTIONS}).
   * @returns Grafo normalizado con nodos y aristas, incluyendo metadatos auxiliares.
   */
  normalize(input: any, opts: Partial<SchemaOptions> = {}): NormalizedGraph {
    const options: SchemaOptions = { ...DEFAULT_OPTIONS, ...opts };
    const nodes: SchemaNode[] = [];
    const edges: SchemaEdge[] = [];

    /** Determina si un valor es escalar (string, number, boolean o null). */
    const isScalar = (v: any): boolean =>
      v === null || ['string', 'number', 'boolean'].includes(typeof v);

    /** True si el array contiene al menos un elemento y todos son escalares. */
    const arrayIsScalar = (arr: any[]): boolean =>
      arr.length > 0 && arr.every(isScalar);

    /**
     * Elige un título para la card de un objeto.
     *
     * @param obj Objeto candidato a nodo.
     * @param priorities Lista de claves prioritarias.
     * @returns Objeto con título elegido y clave usada.
     *
     * Estrategia:
     * - Busca por prioridades y devuelve el primer valor válido.
     * - Si no encuentra, usa el primer escalar presente en el objeto.
     * - Si no existe nada, retorna "Item".
     */
    const pickTitle = (
      obj: any,
      priorities: string[]
    ): { title: string; usedKey?: string } => {
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
     * Construye los atributos de vista previa para un nodo.
     *
     * @param obj Objeto fuente.
     * @param usedKey Clave usada para el título (se omite en el preview).
     * @param options Opciones activas de normalización.
     * @returns Objeto clave/valor con atributos de preview.
     *
     * Reglas:
     * - Omite claves ocultas (`hiddenKeysGlobal`) y la clave usada como título.
     * - Incluye escalares.
     * - Incluye arrays de escalares como string concatenado si `treatScalarArraysAsAttribute=true`.
     * - Respeta límite de `previewMaxKeys`.
     */
    const buildPreviewAttributes = (
      obj: any,
      usedKey?: string,
      options: SchemaOptions = DEFAULT_OPTIONS
    ): Record<string, any> => {
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

    /**
     * Determina si un objeto es "entidad":
     * - Debe ser objeto.
     * - Debe tener al menos un escalar.
     */
    const isEntity = (obj: any): boolean => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
      return Object.values(obj).some(isScalar);
    };

    /**
     * Determina si un objeto es un "wrapper colapsable":
     * - Es objeto con único hijo objeto/array no escalar.
     * - No tiene escalares propios.
     * - Si está habilitado `collapseSingleChildWrappers`, se colapsa.
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

    /**
     * Obtiene tamaños de arrays no escalares de un objeto.
     * @returns Mapa clave → tamaño.
     */
    const arrayCountsOf = (obj: any): Record<string, number> => {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(obj ?? {})) {
        if (Array.isArray(v) && !(v.length > 0 && v.every(isScalar))) {
          out[k] = v.length;
        }
      }
      return out;
    };

    // Contadores de hijos y orden relativo por padre
    const childCounter = new Map<string, number>();
    const childOrderByParent = new Map<string, number>();

    /**
     * Agrega un nodo al grafo y su arista con el padre (si existe).
     *
     * @param jsonPath Ruta JSON del nodo.
     * @param obj Objeto fuente.
     * @param parentId ID del nodo padre (opcional).
     * @returns ID asignado al nodo nuevo.
     *
     * Acciones:
     * - Crea nodo con jsonMeta.title, attributes, childrenCount=0, arrayCounts.
     * - Asigna childOrder relativo respecto a su padre.
     * - Crea arista hacia el padre si corresponde.
     */
    const addNode = (jsonPath: string, obj: any, parentId?: string): string => {
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
     * Recorre el JSON recursivamente y construye nodos/aristas.
     *
     * @param val Valor actual.
     * @param path Ruta JSON actual.
     * @param parentId Nodo padre (si existe).
     * @param depth Profundidad actual.
     *
     * Reglas:
     * - Si es array → recorre elementos.
     * - Si es wrapper colapsable → lo salta directo a su hijo.
     * - Si es entidad → crea nodo.
     * - Recorre hijos objetos/arrays no escalares.
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
        // Colapso de wrapper
        if (isCollapsibleWrapper(val)) {
          for (const [k, v] of Object.entries(val)) {
            if (v && typeof v === 'object') {
              traverse(v, `${path}.${k}`, parentId, depth + 1);
              break;
            }
          }
          return;
        }

        // Entidad → nodo
        let myId = parentId;
        if (isEntity(val)) {
          myId = addNode(path, val, parentId);
          if (parentId)
            childCounter.set(parentId, (childCounter.get(parentId) ?? 0) + 1);
        }

        // Recorre hijos no escalares
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

    // === Inicio del recorrido en raíz ===
    traverse(input, '$', undefined, 0);

    // === Actualiza childrenCount ===
    nodes.forEach(
      (n) => (n.jsonMeta!.childrenCount = childCounter.get(n.id) ?? 0)
    );

    return { nodes, edges, meta: {} };
  }
}
