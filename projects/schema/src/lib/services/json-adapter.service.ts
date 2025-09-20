// projects/schema/src/lib/services/json-adapter.service.ts
// =======================================================
// JsonAdapterService
// Convierte un JSON arbitrario en un grafo normalizado (nodos + aristas),
// utilizando SchemaSettings (sin SchemaOptions). Los valores por defecto
// provienen de DEFAULT_SETTINGS y se combinan por sección (deep merge).
// =======================================================

import { Injectable } from '@angular/core';
import {
  DEFAULT_SETTINGS,
  NormalizedGraph,
  SchemaEdge,
  SchemaNode,
  SchemaSettings,
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
   * @param opts  Settings parciales (se combinan con {@link DEFAULT_SETTINGS} por sección).
   * @returns Grafo normalizado con nodos y aristas, incluyendo metadatos auxiliares.
   */
  normalize(input: any, opts: Partial<SchemaSettings> = {}): NormalizedGraph {
    // ===== Merge por secciones (deep-merge ligero) =====
    const settings: Required<SchemaSettings> = {
      colors: { ...DEFAULT_SETTINGS.colors, ...(opts.colors ?? {}) },
      layout: { ...DEFAULT_SETTINGS.layout, ...(opts.layout ?? {}) },
      dataView: { ...DEFAULT_SETTINGS.dataView, ...(opts.dataView ?? {}) },
      messages: { ...DEFAULT_SETTINGS.messages, ...(opts.messages ?? {}) },
      viewport: { ...DEFAULT_SETTINGS.viewport, ...(opts.viewport ?? {}) },
      debug: { ...DEFAULT_SETTINGS.debug, ...(opts.debug ?? {}) },
    };

    const dv = settings.dataView;

    // ======== VALORES EFECTIVOS (sin undefined) ========
    // Estas constantes resuelven los “posiblemente undefined” de TS.
    const titleKeyPriority =
      dv.titleKeyPriority ?? DEFAULT_SETTINGS.dataView.titleKeyPriority;
    const hiddenKeysGlobal: string[] =
      dv.hiddenKeysGlobal ?? DEFAULT_SETTINGS.dataView.hiddenKeysGlobal ?? [];
    const treatScalarArraysAsAttribute =
      dv.treatScalarArraysAsAttribute ??
      DEFAULT_SETTINGS.dataView.treatScalarArraysAsAttribute;
    const previewMaxKeys =
      dv.previewMaxKeys ?? DEFAULT_SETTINGS.dataView.previewMaxKeys;
    const defaultNodeSize =
      dv.defaultNodeSize ?? DEFAULT_SETTINGS.dataView.defaultNodeSize;
    const maxDepth = dv.maxDepth ?? DEFAULT_SETTINGS.dataView.maxDepth;

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
      if (Array.isArray(priorities) && priorities.length > 0) {
        for (const k of priorities) {
          const v = obj?.[k];
          if (v != null && String(v).trim() !== '') {
            return { title: String(v), usedKey: k };
          }
        }
      }
      return { title: '', usedKey: undefined };
    };

    /**
     * Construye los atributos de vista previa para un nodo.
     *
     * @param obj Objeto fuente.
     * @param usedKey Clave usada para el título (se omite en el preview).
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
      usedKey?: string
    ): Record<string, any> => {
      const entries: [string, any][] = [];
      for (const [k, v] of Object.entries(obj ?? {})) {
        if (hiddenKeysGlobal.includes(k)) continue;
        if (usedKey && k === usedKey) continue;
        if (isScalar(v)) entries.push([k, v]);
        else if (
          Array.isArray(v) &&
          treatScalarArraysAsAttribute &&
          arrayIsScalar(v)
        ) {
          entries.push([k, v.join(', ')]);
        }
      }
      return Object.fromEntries(entries.slice(0, previewMaxKeys));
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
      const { title, usedKey } = pickTitle(obj, titleKeyPriority ?? []);
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
        data: obj,
        jsonMeta: {
          title,
          attributes: buildPreviewAttributes(obj, usedKey),
          childrenCount: 0,
          arrayCounts: arrayCountsOf(obj),
          childOrder,
        },
        width: defaultNodeSize?.width ?? 220,
        height: defaultNodeSize?.height ?? 96,
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
      // Nota: maxDepth puede ser null → sin límite.
      if (maxDepth !== undefined && maxDepth !== null && depth > maxDepth)
        return;

      if (Array.isArray(val)) {
        val.forEach((c, i) =>
          traverse(c, `${path}[${i}]`, parentId, depth + 1)
        );
        return;
      }

      if (val && typeof val === 'object') {
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
            if (scalarArr && treatScalarArraysAsAttribute) continue;
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
