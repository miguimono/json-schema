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
  /**
   * Convierte un objeto JSON en un grafo normalizado y apto para layout/render.
   *
   * @param input JSON o sub-árbol a procesar.
   * @param opts  Opciones parciales de `SchemaOptions` que sobrescriben los defaults.
   * @returns     Grafo con listas de nodos y aristas.
   */
  normalize(input: any, opts: Partial<SchemaOptions> = {}): NormalizedGraph {
    const options: SchemaOptions = { ...DEFAULT_OPTIONS, ...opts };
    const nodes: SchemaNode[] = [];
    const edges: SchemaEdge[] = [];

    /** Determina si un valor es escalar (string/number/boolean o null). */
    const isScalar = (v: any) =>
      v === null || ['string', 'number', 'boolean'].includes(typeof v);

    /** True si TODOS los elementos del array son escalares y hay al menos uno. */
    const arrayIsScalar = (arr: any[]) => arr.length > 0 && arr.every(isScalar);

    /**
     * Elige el título de una entidad:
     *  1) Primer match por prioridad `priorities` con valor no vacío.
     *  2) Si no hay prioridad, toma el primer escalar encontrado.
     *  3) Si no hay, usa "Item".
     * Devuelve además `usedKey` para evitar duplicarlo en atributos si hubo prioridad.
     */
    const pickTitle = (obj: any, priorities: string[]) => {
      if (priorities.length) {
        for (const k of priorities) {
          const v = obj?.[k];
          if (v != null && String(v).trim() !== '')
            return { title: String(v), usedKey: k };
        }
      }
      // si NO hay prioridades, no forzamos título; que sea genérico
      // y devolvemos usedKey = undefined para NO excluir nada del cuerpo
      const firstScalar = Object.entries(obj ?? {}).find(([k, v]) =>
        isScalar(v)
      );
      if (firstScalar)
        return { title: String(firstScalar[1]), usedKey: undefined };
      return { title: 'Item', usedKey: undefined };
    };

    /**
     * Construye el objeto de atributos "preview" para la card:
     *  - Incluye escalares.
     *  - Incluye arrays de escalares si `treatScalarArraysAsAttribute` (como texto join).
     *  - Excluye claves listadas en `hiddenKeysGlobal`.
     *  - Si se usó una clave prioritaria para el título (usedTitleKey), la omite.
     *  - Limita la cantidad a `previewMaxKeys`.
     */
    const buildPreviewAttributes = (
      obj: any,
      usedTitleKey?: string,
      options: SchemaOptions = DEFAULT_OPTIONS
    ) => {
      const entries: [string, any][] = [];
      for (const [k, v] of Object.entries(obj ?? {})) {
        if ((options.hiddenKeysGlobal ?? []).includes(k)) continue;
        // 👇 solo excluye si hubo prioridad (usedKey definido)
        if (usedTitleKey && k === usedTitleKey) continue;
        if (isScalar(v)) entries.push([k, v]);
        else if (
          Array.isArray(v) &&
          options.treatScalarArraysAsAttribute &&
          arrayIsScalar(v)
        )
          entries.push([k, v.join(', ')]);
      }
      return Object.fromEntries(entries.slice(0, options.previewMaxKeys));
    };

    /** Un objeto es "entidad" si tiene al menos un escalar. */
    const isEntity = (obj: any): boolean => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
      // entidad si tiene algún escalar o si calzó prioridad (aunque ésta esté vacía)
      return Object.values(obj).some(isScalar);
    };

    /**
     * Detecta "wrappers" colapsables:
     *  - Sin escalares.
     *  - Con exactamente un hijo "objeto" (o array de objetos).
     *  - Solo aplica si `collapseSingleChildWrappers` es true.
     */
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

    /**
     * Arma el mapa de conteos de arrays NO escalares (para pills "k: N items").
     */
    const arrayCountsOf = (obj: any) => {
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(obj ?? {})) {
        if (Array.isArray(v)) {
          const scalarArr = v.length > 0 && v.every(isScalar);
          if (!scalarArr) out[k] = v.length;
        }
      }
      return out;
    };

    /**
     * Crea un nodo para el objeto `obj` y, si corresponde, crea la arista desde `parentId`.
     * @returns id del nodo creado.
     */
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

    /** Contador auxiliar de hijos por nodo para rellenar `childrenCount`. */
    const childCounter = new Map<string, number>();

    /**
     * Recorrido DFS del JSON:
     * - Arrays: itera por índice.
     * - Objetos: crea nodo si es entidad; conecta aristas a hijos no escalares.
     * - Respeta `maxDepth` (si no es null).
     * - Colapsa wrappers si corresponde.
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
        // Wrapper colapsable: continúa con su único hijo objeto sin crear nodo.
        if (isCollapsibleWrapper(val)) {
          for (const [k, v] of Object.entries(val)) {
            if (v && typeof v === 'object') {
              traverse(v, `${path}.${k}`, parentId, depth + 1);
              break;
            }
          }
          return;
        }

        // Crear nodo si es entidad
        let myId = parentId;
        if (isEntity(val)) {
          myId = addNode(path, val, parentId);
          if (parentId)
            childCounter.set(parentId, (childCounter.get(parentId) ?? 0) + 1);
        }

        // Recorrer hijos no escalares
        for (const [k, v] of Object.entries(val)) {
          if (isScalar(v)) continue;

          if (Array.isArray(v)) {
            const scalarArr = v.length > 0 && v.every(isScalar);
            // arrays de escalares como atributo (si está habilitado) → no crea hijos
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

    // ---- Ejecución del recorrido
    traverse(input, '$', undefined, 0);

    // ---- Completar childrenCount por nodo
    nodes.forEach(
      (n) => (n.jsonMeta!.childrenCount = childCounter.get(n.id) ?? 0)
    );

    // ---- Grafo resultante
    return { nodes, edges, meta: {} };
  }
}
