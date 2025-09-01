// projects/schema/src/lib/services/json-adapter.service.ts
import { Injectable } from '@angular/core';
import {
  JsonArrayPolicy,
  SchemaEdge,
  SchemaGraph,
  SchemaNode,
  SchemaOptions,
  SchemaNodeType,
  SchemaCategory,
  withSchemaDefaults,
} from '../models';

/**
 * Convierte un JSON arbitrario en un grafo navegable (SchemaGraph).
 *  - Genérico (sin referencias a dominios)
 *  - Respetando límites (profundidad/hijos)
 *  - Con títulos inteligentes y poda opcional
 */
@Injectable({ providedIn: 'root' })
export class JsonAdapterService {
  buildGraphFromJson(data: unknown, options: SchemaOptions = {}): SchemaGraph {
    const cfg = withSchemaDefaults(options);
    const ctx: AdapterContext = {
      nodes: [],
      edges: [],
      seen: new WeakMap<object, string>(),
      cfg,
    };

    // Caso especial: raíz primitiva -> crear un nodo raíz simple
    if (this.isPrimitive(data)) {
      const id = this.generateId([]); // "$" raíz
      ctx.nodes.push(this.createRootPrimitiveNode(id, data));
      return this.finalize(ctx);
    }

    // Procesar raíz (objeto o array)
    const rootId = this.processValue(data, [], 0, ctx);

    // Si por alguna razón no se generó nodo (JSON inesperado), aseguramos raíz
    if (!rootId) {
      const id = this.generateId([]);
      ctx.nodes.push(this.createRootPrimitiveNode(id, data));
    }

    return this.finalize(ctx);
  }

  // ---------------------------
  // Proceso principal
  // ---------------------------

  private processValue(
    value: unknown,
    path: (string | number)[],
    depth: number,
    ctx: AdapterContext,
    parentId?: string,
    relationshipLabel?: string
  ): string | null {
    // Límite de profundidad
    if (depth >= (ctx.cfg.jsonMaxDepth ?? 10)) {
      const id = this.createTruncatedNode(
        path,
        depth,
        ctx,
        parentId,
        relationshipLabel
      );
      return id;
    }

    if (Array.isArray(value)) {
      return this.processArray(
        value,
        path,
        depth,
        ctx,
        parentId,
        relationshipLabel
      );
    }

    if (this.isObject(value)) {
      return this.processObject(
        value as Record<string, unknown>,
        path,
        depth,
        ctx,
        parentId,
        relationshipLabel
      );
    }

    // Los primitivos se muestran como atributos del padre (no generan nodo),
    // excepto en raíz o casos especiales (truncado/ciclos) manejados aparte.
    return null;
  }

  private processArray(
    array: unknown[],
    path: (string | number)[],
    depth: number,
    ctx: AdapterContext,
    parentId?: string,
    relationshipLabel?: string
  ): string {
    const id = this.generateId(path);

    // Ciclos
    if (
      this.handleCyclicReference(
        array,
        path,
        depth,
        ctx,
        parentId,
        relationshipLabel
      )
    ) {
      const refId = id + '_ref';
      // ya se agregó edge y nodo de referencia dentro de handleCyclicReference
      return refId;
    }

    const key = this.getPathKey(path);
    const node = this.createArrayNode(array, id, key, path, depth, ctx);
    ctx.nodes.push(node);

    if (parentId) {
      this.createEdge(parentId, id, ctx, relationshipLabel, 'parent-child');
    }

    // Procesar hijos (objetos / arrays) respetando política y límites
    this.processArrayElements(array, path, depth, ctx, id);

    return id;
  }

  private processObject(
    obj: Record<string, unknown>,
    path: (string | number)[],
    depth: number,
    ctx: AdapterContext,
    parentId?: string,
    relationshipLabel?: string
  ): string {
    const id = this.generateId(path);

    // Ciclos
    if (
      this.handleCyclicReference(
        obj,
        path,
        depth,
        ctx,
        parentId,
        relationshipLabel
      )
    ) {
      const refId = id + '_ref';
      return refId;
    }

    const key = this.getPathKey(path);
    const node = this.createObjectNode(obj, id, key, path, depth, ctx);
    ctx.nodes.push(node);

    if (parentId) {
      this.createEdge(parentId, id, ctx, relationshipLabel, 'parent-child');
    }

    // Procesar propiedades (objetos/arrays)
    this.processObjectProperties(obj, path, depth, ctx, id);

    return id;
  }

  // ---------------------------
  // Creación de nodos
  // ---------------------------

  private createRootPrimitiveNode(id: string, value: unknown): SchemaNode {
    return {
      id,
      type: 'json-root',
      category: 'leaf',
      data: value,
      level: 0,
      rank: 0,
      jsonMeta: {
        kind: 'root',
        path: '$',
        title: this.previewValue(value),
        attributes: { value: this.previewValue(value) },
        depth: 0,
        isLeaf: true,
        isEmpty: value == null,
      },
    };
  }

  private createArrayNode(
    array: unknown[],
    id: string,
    key: string | undefined,
    path: (string | number)[],
    depth: number,
    ctx: AdapterContext
  ): SchemaNode {
    const analysis = this.analyzeArrayContent(array);
    const sample = array
      .filter(this.isPrimitive)
      .slice(0, ctx.cfg.jsonArraySampleSize ?? 3)
      .map((v) => this.previewValue(v, ctx.cfg.jsonStringMaxLen));

    return {
      id,
      type: 'json-array',
      category: 'collection',
      data: array,
      level: depth,
      rank: depth,
      jsonMeta: {
        kind: 'array',
        key,
        path: this.pathToString(path),
        title: this.generateArrayTitle(key, array.length),
        attributes: {}, // arrays no listan primitivos como nodos
        children: [], // se rellenará al procesar elementos complejos
        arrayInfo: {
          length: array.length,
          itemType: analysis.itemType,
          sample: sample.length > 0 ? sample : undefined,
        },
        preview: `Array[${array.length}]`,
        depth,
        isLeaf: array.length === 0,
        isEmpty: array.length === 0,
      },
    };
  }

  private createObjectNode(
    obj: Record<string, unknown>,
    id: string,
    key: string | undefined,
    path: (string | number)[],
    depth: number,
    ctx: AdapterContext
  ): SchemaNode {
    const ignore = ctx.cfg.jsonIgnoreKeys ?? [];
    const entries = Object.entries(obj).filter(([k]) => !ignore.includes(k));

    // Separar primitivos y estructuras
    const primitives: Record<string, unknown> = {};
    let hasNestedStructures = false;

    const maxLen = ctx.cfg.jsonStringMaxLen ?? 100;
    const arraySampleSize = ctx.cfg.jsonArraySampleSize ?? 3;

    for (const [k, v] of entries) {
      if (
        v === null ||
        typeof v === 'string' ||
        typeof v === 'number' ||
        typeof v === 'boolean' ||
        typeof v === 'bigint'
      ) {
        // ⚠️ Usamos this.previewValue(v, maxLen) para evitar cards gigantes por strings largas
        primitives[k] = this.previewValue(v, maxLen);
      } else if (Array.isArray(v)) {
        // Marca que hay estructuras anidadas; los elementos del array se procesan fuera (children)
        hasNestedStructures = true;

        // (Opcional: no agregamos 'arrays' a jsonMeta para mantener el modelo simple)
        // Si quisieras mostrar un mini-adelanto, puedes dejar un preview genérico:
        // primitives[k] = `Array[${v.length}]`;
      } else if (typeof v === 'object') {
        hasNestedStructures = true;
      }
    }

    // Título inteligente (prioriza jsonTitleKeys)
    const titleKeys = ctx.cfg.jsonTitleKeys ?? [
      'name',
      'title',
      'label',
      'id',
      'key',
    ];
    const title = this.generateObjectTitle(obj, key, titleKeys);
    const titleKey = this.findTitleKey(obj, titleKeys);

    // Evitar duplicar el atributo que se usó como título
    if (titleKey && primitives[titleKey] != null) {
      delete primitives[titleKey];
    }

    return {
      id,
      type: depth === 0 ? 'json-root' : 'json-object',
      category: hasNestedStructures ? 'container' : 'structure',
      data: obj,
      level: depth,
      rank: depth,
      jsonMeta: {
        kind: depth === 0 ? 'root' : 'object',
        key,
        path: this.pathToString(path),
        title,
        titleKey,
        attributes: primitives, // 👈 solo atributos primitivos (preview ya truncado)
        children: [], // 👈 se llenará cuando procesemos propiedades/arrays anidados
        objectInfo: {
          keyCount: entries.length,
          hasNestedStructures,
        },
        preview: hasNestedStructures
          ? '{…}'
          : this.generateObjectPreview(primitives as Record<string, unknown>),
        depth,
        isLeaf: !hasNestedStructures,
        isEmpty: entries.length === 0,
      },
    };
  }

  private createTruncatedNode(
    path: (string | number)[],
    depth: number,
    ctx: AdapterContext,
    parentId?: string,
    relationshipLabel?: string
  ): string {
    const id = this.generateId(path) + '_truncated';
    const node: SchemaNode = {
      id,
      type: 'json-primitive',
      category: 'leaf',
      data: null,
      level: depth,
      rank: depth,
      jsonMeta: {
        kind: 'primitive',
        path: this.pathToString(path),
        title: 'Max depth reached',
        attributes: { note: 'Increase jsonMaxDepth to expand' },
        preview: '⋯',
        depth,
        isLeaf: true,
        isEmpty: false,
      },
    };
    ctx.nodes.push(node);

    if (parentId) {
      this.createEdge(parentId, id, ctx, relationshipLabel, 'parent-child');
      // Actualizar children del padre
      const parent = ctx.nodes.find((n) => n.id === parentId);
      parent?.jsonMeta.children?.push(id);
    }

    return id;
  }

  // ---------------------------
  // Procesamiento de hijos
  // ---------------------------

  private processArrayElements(
    array: unknown[],
    path: (string | number)[],
    depth: number,
    ctx: AdapterContext,
    arrayNodeId: string
  ): void {
    const policy: JsonArrayPolicy = ctx.cfg.jsonArrayPolicy ?? 'sample';
    const maxChildren = ctx.cfg.jsonMaxChildren ?? 50;
    const sampleSize = ctx.cfg.jsonArraySampleSize ?? 3;

    // Política simple:
    //  - "count": no expandir hijos
    //  - "fanout": expandir hasta sampleSize
    //  - "sample": expandir hasta sampleSize (similar, pero semántico)
    //  - "paged": (no implementamos paginación aquí; tratamos como "fanout")
    let limit = maxChildren;
    if (policy === 'count') limit = 0;
    else if (policy === 'fanout' || policy === 'sample' || policy === 'paged')
      limit = Math.min(maxChildren, sampleSize);

    let processed = 0;
    for (let i = 0; i < array.length && processed < limit; i++) {
      const el = array[i];
      if (this.isObject(el) || Array.isArray(el)) {
        const childId = this.processValue(
          el,
          [...path, i],
          depth + 1,
          ctx,
          arrayNodeId,
          `[${i}]`
        );
        if (childId) {
          processed++;
          // Registrar hijo en el nodo array
          const parent = ctx.nodes.find((n) => n.id === arrayNodeId);
          parent?.jsonMeta.children?.push(childId);
        }
      }
    }
  }

  private processObjectProperties(
    obj: Record<string, unknown>,
    path: (string | number)[],
    depth: number,
    ctx: AdapterContext,
    objectNodeId: string
  ): void {
    const entries = Object.entries(obj).filter(
      ([k]) => !(ctx.cfg.jsonIgnoreKeys ?? []).includes(k)
    );
    const maxChildren = ctx.cfg.jsonMaxChildren ?? 50;

    let processed = 0;
    for (const [key, value] of entries) {
      if (processed >= maxChildren) break;

      if (this.isObject(value) || Array.isArray(value)) {
        const childId = this.processValue(
          value,
          [...path, key],
          depth + 1,
          ctx,
          objectNodeId,
          key
        );
        if (childId) {
          processed++;
          const parent = ctx.nodes.find((n) => n.id === objectNodeId);
          parent?.jsonMeta.children?.push(childId);
        }
      }
    }
  }

  // ---------------------------
  // Ciclos y edges
  // ---------------------------

  private handleCyclicReference(
    obj: object,
    path: (string | number)[],
    depth: number,
    ctx: AdapterContext,
    parentId?: string,
    relationshipLabel?: string
  ): boolean {
    const id = this.generateId(path);
    const existing = ctx.seen.get(obj);

    if (existing && existing !== id) {
      const refNodeId = id + '_ref';
      const refNode: SchemaNode = {
        id: refNodeId,
        type: 'json-primitive',
        category: 'leaf',
        data: { $ref: existing },
        level: depth,
        rank: depth,
        jsonMeta: {
          kind: 'primitive',
          path: this.pathToString(path),
          title: `Reference to ${existing}`,
          attributes: { ref: existing },
          preview: `↺ ${existing}`,
          depth,
          isLeaf: true,
          isEmpty: false,
        },
      };
      ctx.nodes.push(refNode);

      if (parentId) {
        this.createEdge(
          parentId,
          refNodeId,
          ctx,
          relationshipLabel,
          'reference'
        );
        // registrar también como hijo del padre
        const parent = ctx.nodes.find((n) => n.id === parentId);
        parent?.jsonMeta.children?.push(refNodeId);
      }
      return true;
    }

    ctx.seen.set(obj, id);
    return false;
  }

  private createEdge(
    sourceId: string,
    targetId: string,
    ctx: AdapterContext,
    label?: string,
    relationship: 'parent-child' | 'reference' | 'array-item' = 'parent-child'
  ): void {
    const edge: SchemaEdge = {
      id: `${sourceId}->${targetId}`,
      sourceId,
      targetId,
      meta: { relationship, label },
    };
    ctx.edges.push(edge);
  }

  // ---------------------------
  // Poda y metadatos finales
  // ---------------------------

  private finalize(ctx: AdapterContext): SchemaGraph {
    if (ctx.cfg.hideEmptyNodes) {
      this.pruneEmptyNodes(ctx);
    }

    const maxDepth = ctx.nodes.length
      ? Math.max(...ctx.nodes.map((n) => n.jsonMeta.depth))
      : 0;

    return {
      nodes: ctx.nodes,
      edges: ctx.edges,
      meta: {
        rootNodeId: ctx.nodes[0]?.id,
        maxDepth,
        totalNodes: ctx.nodes.length,
        totalEdges: ctx.edges.length,
        nodeTypeCount: this.countNodeTypes(ctx.nodes),
      },
    };
  }

  private pruneEmptyNodes(ctx: AdapterContext): void {
    const removable = new Set(
      ctx.nodes
        .filter((n) => n.jsonMeta.isEmpty && n.type !== 'json-root')
        .map((n) => n.id)
    );

    if (removable.size === 0) return;

    // Filtrar nodos y edges
    ctx.nodes = ctx.nodes.filter((n) => !removable.has(n.id));
    ctx.edges = ctx.edges.filter(
      (e) => !removable.has(e.sourceId) && !removable.has(e.targetId)
    );

    // Limpiar listas de hijos en los nodos restantes
    for (const node of ctx.nodes) {
      if (node.jsonMeta.children) {
        node.jsonMeta.children = node.jsonMeta.children.filter(
          (id) => !removable.has(id)
        );
      }
    }
  }

  private countNodeTypes(nodes: SchemaNode[]): Record<SchemaNodeType, number> {
    const initial: Record<SchemaNodeType, number> = {
      'json-object': 0,
      'json-array': 0,
      'json-primitive': 0,
      'json-root': 0,
    };
    for (const n of nodes) initial[n.type]++;
    return initial;
  }

  // ---------------------------
  // Utilidades
  // ---------------------------

  private isPrimitive(v: unknown): boolean {
    return (
      v === null || ['string', 'number', 'boolean', 'bigint'].includes(typeof v)
    );
  }

  private isObject(v: unknown): boolean {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  private generateId(path: (string | number)[]): string {
    // Estilo JSON Pointer simplificado; estable y legible
    return path.length === 0
      ? '$'
      : [
          '$',
          ...path.map((seg) =>
            String(seg).replace(/~/g, '~0').replace(/\//g, '~1')
          ),
        ].join('/');
  }

  private getPathKey(path: (string | number)[]): string | undefined {
    const last = path[path.length - 1];
    return typeof last === 'string' ? last : undefined;
  }

  private pathToString(path: (string | number)[]): string {
    return path.length === 0 ? '$' : path.join('.');
  }

  private previewValue(value: unknown, maxLen = 100): string {
    if (value === null) return 'null';
    if (typeof value === 'string')
      return JSON.stringify(this.truncate(String(value), maxLen));
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    )
      return String(value);
    if (Array.isArray(value)) return `Array[${value.length}]`;
    if (typeof value === 'object') return '{…}';
    return String(value);
  }

  private truncate(str: string, max = 50): string {
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  private analyzeArrayContent(array: unknown[]): {
    itemType: 'mixed' | 'object' | 'primitive';
    hasObjects: boolean;
    hasPrimitives: boolean;
  } {
    if (array.length === 0)
      return { itemType: 'mixed', hasObjects: false, hasPrimitives: false };
    const hasObjects = array.some((x) => this.isObject(x) || Array.isArray(x));
    const hasPrimitives = array.some((x) => this.isPrimitive(x));
    let itemType: 'mixed' | 'object' | 'primitive';
    if (hasObjects && hasPrimitives) itemType = 'mixed';
    else if (hasObjects) itemType = 'object';
    else itemType = 'primitive';
    return { itemType, hasObjects, hasPrimitives };
  }

  private generateObjectTitle(
    obj: Record<string, unknown>,
    key: string | undefined,
    titleKeys: string[]
  ): string {
    for (const tKey of titleKeys) {
      const val = obj[tKey];
      if (val != null && this.isPrimitive(val)) {
        return this.truncate(String(val));
      }
    }
    if (key) return this.humanizeKey(key);
    for (const [k, v] of Object.entries(obj)) {
      if (this.isPrimitive(v) && v != null) {
        return `${this.humanizeKey(k)}: ${this.previewValue(v)}`;
      }
    }
    return 'Object';
  }

  private findTitleKey(
    obj: Record<string, unknown>,
    titleKeys: string[]
  ): string | undefined {
    for (const k of titleKeys) {
      if (obj[k] != null && this.isPrimitive(obj[k])) return k;
    }
    return undefined;
  }

  private generateArrayTitle(key: string | undefined, length: number): string {
    return key ? `${this.humanizeKey(key)} [${length}]` : `Array [${length}]`;
  }

  private generateObjectPreview(attributes: Record<string, unknown>): string {
    const keys = Object.keys(attributes);
    if (keys.length === 0) return '{}';
    if (keys.length === 1) return `{${keys[0]}: ${attributes[keys[0]]}}`;
    return `{${keys.length} properties}`;
  }

  private humanizeKey(key: string): string {
    return key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .trim();
  }
}

// Contexto interno del adaptador (simple y tipado)
interface AdapterContext {
  nodes: SchemaNode[];
  edges: SchemaEdge[];
  seen: WeakMap<object, string>;
  cfg: SchemaOptions;
}
