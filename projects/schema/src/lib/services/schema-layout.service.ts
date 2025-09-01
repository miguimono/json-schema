// projects/schema/src/lib/services/schema-layout.service.ts
import { Injectable } from '@angular/core';
import {
  PositionsMap,
  SchemaGraph,
  SchemaOptions,
  SchemaSize,
  SchemaNode,
  Point,
  LayoutStrategy,
  withSchemaDefaults,
} from '../models';

/** Nodo preparado para layout (incluye medidas finales) */
interface LayoutNode {
  id: string;
  level: number;
  children: string[];
  width: number;
  height: number;
  node: SchemaNode;
}

/** Resultado del layout */
interface LayoutResult {
  positions: PositionsMap;
  size: SchemaSize;
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

@Injectable({ providedIn: 'root' })
export class SchemaLayoutService {
  /**
   * Calcula layout según la estrategia indicada (tree | level).
   * Usa medidas reales de cada nodo si existen (node.size), con defaults de seguridad.
   */
  calculateLayout(
    graph: SchemaGraph,
    options: SchemaOptions = {},
    defaultNodeSize = { width: 180, height: 84 }
  ): LayoutResult {
    const cfg = withSchemaDefaults(options);
    const strategy = cfg.layout ?? 'tree';

    switch (strategy) {
      case 'level':
        return this.layoutByDepth(graph, cfg, defaultNodeSize);
      case 'tree':
      case 'force': // placeholder → usa tree por ahora
      case 'circular': // placeholder → usa tree por ahora
      default:
        return this.layoutAsTree(graph, cfg, defaultNodeSize);
    }
  }

  /**
   * Layout por profundidad: coloca columnas por nivel y apila los nodos
   * respetando su altura real + gapY.
   */
  private layoutByDepth(
    graph: SchemaGraph,
    options: SchemaOptions,
    defaultSize: { width: number; height: number }
  ): LayoutResult {
    const gapX = options.gapX ?? 280;
    const gapY = options.gapY ?? 160;
    const padding = options.padding ?? 24;

    // Agrupar por profundidad
    const depthBuckets = new Map<number, SchemaNode[]>();
    let maxDepth = 0;
    for (const node of graph.nodes) {
      const d = node.jsonMeta.depth ?? 0;
      maxDepth = Math.max(maxDepth, d);
      if (!depthBuckets.has(d)) depthBuckets.set(d, []);
      depthBuckets.get(d)!.push(node);
    }

    // Preparar layout nodes (con width/height reales o por defecto)
    const layoutNodes = new Map<string, LayoutNode>();
    for (const node of graph.nodes) {
      const sz = node.size ?? defaultSize;
      layoutNodes.set(node.id, {
        id: node.id,
        level: node.jsonMeta.depth ?? 0,
        children: [],
        width: Math.max(1, sz.width ?? defaultSize.width),
        height: Math.max(1, sz.height ?? defaultSize.height),
        node,
      });
    }

    const positions: PositionsMap = new Map();

    // Posicionar columnas por profundidad
    for (let depth = 0; depth <= maxDepth; depth++) {
      const columnNodes = (depthBuckets.get(depth) ?? []).slice();
      // Orden estable para consistencia visual
      columnNodes.sort((a, b) => this.compareSameLevel(a, b));

      // Acumulador vertical por columna (usa alturas reales)
      let cursorY = padding;
      for (const n of columnNodes) {
        const LN = layoutNodes.get(n.id)!;
        const x = padding + depth * gapX;
        const y = cursorY;
        positions.set(n.id, { x, y });
        cursorY += LN.height + gapY;
      }
    }

    const bounds = this.calculateBounds(positions, layoutNodes, padding);
    return {
      positions,
      size: { width: bounds.maxX + padding, height: bounds.maxY + padding },
      bounds,
    };
  }

  /**
   * Layout jerárquico tipo árbol:
   * - Calcula altura total de subárboles (sumando alturas reales de hijos + gaps).
   * - Coloca hijos secuencialmente y centra el padre entre min/max y de sus hijos (o usa firstChild/left).
   */
  private layoutAsTree(
    graph: SchemaGraph,
    options: SchemaOptions,
    defaultSize: { width: number; height: number }
  ): LayoutResult {
    const gapX = options.gapX ?? 280;
    const gapY = options.gapY ?? 140;
    const padding = options.padding ?? 24;
    const align = options.align ?? 'firstChild';

    // Preparar nodos con medidas reales
    const layoutNodes = this.prepareLayoutNodes(graph, defaultSize);

    // Relación padre → hijos (basado en edges y niveles consecutivos)
    const { childrenMap, rootNodes } = this.buildHierarchy(graph, layoutNodes);

    const positions: PositionsMap = new Map();

    // Precalcular altura total de cada subárbol (memo)
    const subtreeHeightCache = new Map<string, number>();
    const subtreeHeight = (id: string): number => {
      if (subtreeHeightCache.has(id)) return subtreeHeightCache.get(id)!;
      const node = layoutNodes.get(id)!;
      const children = childrenMap.get(id) ?? [];
      if (children.length === 0) {
        subtreeHeightCache.set(id, node.height);
        return node.height;
      }
      // Altura = suma de subárboles hijos + gaps entre ellos, comparado con altura del padre (por si es más alta)
      let sum = 0;
      for (const childId of children) sum += subtreeHeight(childId);
      const total = Math.max(
        node.height,
        sum + gapY * Math.max(0, children.length - 1)
      );
      subtreeHeightCache.set(id, total);
      return total;
    };

    // Colocar recursivamente un subárbol
    const placeSubtree = (
      id: string,
      baseX: number,
      baseY: number
    ): { minY: number; maxY: number } => {
      const node = layoutNodes.get(id)!;
      const x = baseX;
      const children = childrenMap.get(id) ?? [];

      if (children.length === 0) {
        // Hoja: colocar en (x, baseY)
        positions.set(id, { x, y: baseY });
        return { minY: baseY, maxY: baseY + node.height };
      }

      // Colocar hijos uno debajo de otro dentro del bloque de altura de subárbol
      const blockHeight = subtreeHeight(id);
      const childrenTotalHeight =
        children.reduce((acc, ch) => acc + subtreeHeight(ch), 0) +
        gapY * Math.max(0, children.length - 1);
      const startY =
        baseY + Math.max(0, (blockHeight - childrenTotalHeight) / 2); // centrar hijos en el bloque

      let cursorY = startY;
      let minChild = Number.POSITIVE_INFINITY;
      let maxChild = Number.NEGATIVE_INFINITY;

      for (const childId of children) {
        const chHeight = subtreeHeight(childId);
        const { minY, maxY } = placeSubtree(childId, baseX + gapX, cursorY);
        minChild = Math.min(minChild, minY);
        maxChild = Math.max(maxChild, maxY);
        cursorY += chHeight + gapY;
      }

      // Posicionar padre según align
      let parentY: number;
      switch (align) {
        case 'center':
          parentY = Math.round((minChild + maxChild - node.height) / 2);
          break;
        case 'firstChild':
          parentY = minChild; // alinea con la parte superior del primer hijo
          break;
        case 'left':
        default:
          parentY = minChild; // comportamiento similar a firstChild
          break;
      }

      positions.set(id, { x, y: parentY });
      return {
        minY: Math.min(parentY, minChild),
        maxY: Math.max(parentY + node.height, maxChild),
      };
    };

    // Colocar todos los árboles raíz (uno debajo del otro)
    let globalCursorY = padding;
    for (const rootId of rootNodes) {
      const h = subtreeHeight(rootId);
      placeSubtree(rootId, padding, globalCursorY);
      globalCursorY += h + gapY; // espacio entre árboles raíz
    }

    // Nodos que quedaron sin colocar (desconectados): apilarlos al final
    for (const [id, n] of layoutNodes) {
      if (!positions.has(id)) {
        positions.set(id, { x: padding + n.level * gapX, y: globalCursorY });
        globalCursorY += n.height + gapY;
      }
    }

    const bounds = this.calculateBounds(positions, layoutNodes, padding);
    return {
      positions,
      size: { width: bounds.maxX + padding, height: bounds.maxY + padding },
      bounds,
    };
  }

  /** Prepara LayoutNodes usando medidas reales si están disponibles */
  private prepareLayoutNodes(
    graph: SchemaGraph,
    defaultSize: { width: number; height: number }
  ): Map<string, LayoutNode> {
    const map = new Map<string, LayoutNode>();
    for (const node of graph.nodes) {
      const sz = node.size ?? defaultSize;
      map.set(node.id, {
        id: node.id,
        level: node.jsonMeta.depth ?? 0,
        children: [],
        width: Math.max(1, sz.width ?? defaultSize.width),
        height: Math.max(1, sz.height ?? defaultSize.height),
        node,
      });
    }
    return map;
  }

  /**
   * Construye jerarquía padre→hijos a partir de edges,
   * considerando sólo aristas entre niveles consecutivos (padre.nivel + 1 = hijo.nivel).
   */
  private buildHierarchy(
    graph: SchemaGraph,
    layoutNodes: Map<string, LayoutNode>
  ): { childrenMap: Map<string, string[]>; rootNodes: string[] } {
    const childrenMap = new Map<string, string[]>();
    const hasParent = new Set<string>();

    for (const id of layoutNodes.keys()) childrenMap.set(id, []);

    for (const edge of graph.edges) {
      const src = layoutNodes.get(edge.sourceId);
      const trg = layoutNodes.get(edge.targetId);
      if (!src || !trg) continue;

      // Considerar jerarquía sólo si respeta niveles
      if ((trg.level ?? 0) === (src.level ?? 0) + 1) {
        childrenMap.get(edge.sourceId)!.push(edge.targetId);
        hasParent.add(edge.targetId);
      }
    }

    // Orden estable de hijos por consistencia visual
    for (const [pid, kids] of childrenMap) {
      kids.sort((a, b) =>
        this.compareSameLevel(
          layoutNodes.get(a)!.node,
          layoutNodes.get(b)!.node
        )
      );
      layoutNodes.get(pid)!.children = kids;
    }

    // Raíces: nodos sin padre
    const rootNodes = Array.from(layoutNodes.keys()).filter(
      (id) => !hasParent.has(id)
    );
    // Ordenar raíces por nivel y luego por identidad estable
    rootNodes.sort((a, b) => {
      const A = layoutNodes.get(a)!,
        B = layoutNodes.get(b)!;
      if (A.level !== B.level) return A.level - B.level;
      return a.localeCompare(b);
    });

    return { childrenMap, rootNodes };
  }

  /** Orden estable para nodos del mismo nivel */
  private compareSameLevel(a: SchemaNode, b: SchemaNode): number {
    // 1) tipo: root -> object -> array -> primitive
    const order: Record<string, number> = {
      'json-root': 0,
      'json-object': 1,
      'json-array': 2,
      'json-primitive': 3,
    };
    const ta = order[a.type] ?? 99;
    const tb = order[b.type] ?? 99;
    if (ta !== tb) return ta - tb;

    // 2) por clave
    const ka = a.jsonMeta.key ?? '';
    const kb = b.jsonMeta.key ?? '';
    if (ka !== kb) return ka.localeCompare(kb);

    // 3) por índice si aplica
    const ia = a.jsonMeta.index ?? 0;
    const ib = b.jsonMeta.index ?? 0;
    return ia - ib;
  }

  /** Calcula límites considerando el tamaño real de **cada** nodo */
  private calculateBounds(
    positions: PositionsMap,
    layoutNodes: Map<string, LayoutNode>,
    padding: number
  ): { minX: number; maxX: number; minY: number; maxY: number } {
    if (positions.size === 0) {
      return { minX: padding, maxX: padding, minY: padding, maxY: padding };
    }
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const [id, pos] of positions) {
      const ln = layoutNodes.get(id);
      if (!ln) continue;
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x + ln.width);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y + ln.height);
    }
    return { minX, maxX, minY, maxY };
  }

  /**
   * Sugerencia de estrategia de layout (heurística simple).
   * Útil para `calculateAutoLayout`.
   */
  private selectOptimalStrategy(
    graph: SchemaGraph,
    options: SchemaOptions
  ): LayoutStrategy {
    const nodeCount = graph.nodes.length;
    const maxDepth = graph.nodes.length
      ? Math.max(...graph.nodes.map((n) => n.jsonMeta.depth ?? 0))
      : 0;
    const avgChildrenPerNode = graph.nodes.length
      ? graph.edges.length / graph.nodes.length
      : 0;

    if (nodeCount < 50 && maxDepth > 3) return 'tree';
    if (maxDepth <= 3 && avgChildrenPerNode > 3) return 'level';
    return options.layout ?? 'tree';
  }

  /**
   * Layout automático basado en heurística.
   */
  calculateAutoLayout(
    graph: SchemaGraph,
    options: SchemaOptions = {},
    defaultNodeSize = { width: 180, height: 84 }
  ): LayoutResult {
    const strategy = this.selectOptimalStrategy(graph, options);
    return this.calculateLayout(
      graph,
      { ...options, layout: strategy },
      defaultNodeSize
    );
  }

  /**
   * Utilidad para virtualización: indica qué nodos están dentro del viewport.
   * Usa el tamaño real de cada nodo para determinar visibilidad.
   */
  optimizeForViewport(
    positions: PositionsMap,
    viewport: {
      x: number;
      y: number;
      width: number;
      height: number;
      zoom: number;
    },
    defaultNodeSize: { width: number; height: number },
    layoutNodes?: Map<string, LayoutNode>
  ): { visibleNodes: string[]; culledNodes: string[] } {
    const visibleNodes: string[] = [];
    const culledNodes: string[] = [];

    const bounds = {
      left: viewport.x - defaultNodeSize.width,
      right: viewport.x + viewport.width + defaultNodeSize.width,
      top: viewport.y - defaultNodeSize.height,
      bottom: viewport.y + viewport.height + defaultNodeSize.height,
    };

    for (const [id, pos] of positions) {
      const w = layoutNodes?.get(id)?.width ?? defaultNodeSize.width;
      const h = layoutNodes?.get(id)?.height ?? defaultNodeSize.height;

      const nodeRight = pos.x + w;
      const nodeBottom = pos.y + h;

      const isVisible =
        pos.x < bounds.right &&
        nodeRight > bounds.left &&
        pos.y < bounds.bottom &&
        nodeBottom > bounds.top;

      (isVisible ? visibleNodes : culledNodes).push(id);
    }

    return { visibleNodes, culledNodes };
  }
}
