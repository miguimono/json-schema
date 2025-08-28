// projects/sh-schema/src/lib/services/schema-layout.service.ts
import { Injectable } from '@angular/core';
import {
  PositionsMap,
  SchemaGraph,
  SchemaLevel,
  SchemaOptions,
  SchemaSize,
  SCHEMA_LEVEL_ORDER,
} from '../models';

@Injectable({ providedIn: 'root' })
export class SchemaLayoutService {
  /**
   * Layout por niveles de dominio (central → cable → port → cto → user).
   * Útil cuando usas el modo "dominio". Para JSON genérico, prefiere layoutTree.
   */
  layoutLevel(
    graph: SchemaGraph,
    options: SchemaOptions = {},
    nodeSize = { w: 180, h: 84 }
  ): { positions: PositionsMap; size: SchemaSize } {
    const gapX = options.gapX ?? 280;
    const gapY = options.gapY ?? 160;
    const padding = options.padding ?? 24;

    // Agrupa ids por nivel declarado en el nodo
    const buckets = new Map<SchemaLevel, string[]>();
    for (const lvl of SCHEMA_LEVEL_ORDER) buckets.set(lvl, []);
    for (const n of graph.nodes) {
      if (buckets.has(n.level as any)) buckets.get(n.level as any)!.push(n.id);
    }

    const positions: PositionsMap = new Map();
    let maxRows = 0;
    let maxCol = 0;

    SCHEMA_LEVEL_ORDER.forEach((lvl, colIdx) => {
      const arr = buckets.get(lvl) ?? [];
      maxRows = Math.max(maxRows, arr.length);
      if (arr.length > 0) maxCol = Math.max(maxCol, colIdx);
      arr.forEach((id, rowIdx) => {
        positions.set(id, {
          x: padding + colIdx * gapX,
          y: padding + rowIdx * gapY,
        });
      });
    });

    // Un poco de margen extra para evitar recortes del viewBox
    const EXTRA_PAD = 16;

    return {
      positions,
      size: {
        width: padding * 2 + maxCol * gapX + nodeSize.w + EXTRA_PAD,
        height:
          padding * 2 +
          Math.max(1, maxRows) * gapY +
          nodeSize.h / 2 +
          EXTRA_PAD,
      },
    };
  }

  /**
   * Layout jerárquico basado en "rank" (depth) para JSON genérico.
   * - Si node.rank existe se usa; si no, se cae a índice en SCHEMA_LEVEL_ORDER.
   * - Coloca hijos en la columna (rank+1) y centra el padre respecto a sus hijos.
   */
  layoutTree(
    graph: SchemaGraph,
    options: SchemaOptions = {},
    nodeSize = { w: 180, h: 84 }
  ): { positions: PositionsMap; size: SchemaSize } {
    const gapX = options.gapX ?? 280;
    const gapY = options.gapY ?? 140;
    const padding = options.padding ?? 24;
    const align = options.align ?? 'firstChild';

    const positions: PositionsMap = new Map();
    const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));

    const levelIndex = (id: string) => {
      const n = nodesById.get(id)!;
      if (typeof n.rank === 'number') return n.rank; // JSON genérico (depth)
      const idx = SCHEMA_LEVEL_ORDER.indexOf(n.level as any);
      return Math.max(0, idx);
    };

    // Construye children (solo edges entre columnas contiguas) e indegree
    const children = new Map<string, string[]>();
    const indeg = new Map<string, number>();
    for (const n of graph.nodes) indeg.set(n.id, 0);

    for (const e of graph.edges) {
      const s = nodesById.get(e.sourceId);
      const t = nodesById.get(e.targetId);
      if (!s || !t) continue;
      if (levelIndex(t.id) === levelIndex(s.id) + 1) {
        const arr = children.get(s.id);
        if (arr) arr.push(t.id);
        else children.set(s.id, [t.id]); // << FIX: ya no usamos Map.set(...) encadenado
        indeg.set(t.id, (indeg.get(t.id) ?? 0) + 1);
      }
    }

    // Raíces: indegree 0, ordenadas por nivel ascendente
    const roots = graph.nodes
      .filter((n) => (indeg.get(n.id) ?? 0) === 0)
      .sort((a, b) => levelIndex(a.id) - levelIndex(b.id));

    let rowCursor = 0;

    // Coloca un nodo y devuelve [minY, maxY] ocupados por su subárbol
    const place = (id: string): [number, number] => {
      const ch = children.get(id) ?? [];
      const x = padding + levelIndex(id) * gapX;

      if (ch.length === 0) {
        const y = padding + rowCursor * gapY;
        positions.set(id, { x, y });
        rowCursor += 1;
        return [y, y];
      }

      let minY = Infinity;
      let maxY = -Infinity;
      for (const cid of ch) {
        const [cmin, cmax] = place(cid);
        if (cmin < minY) minY = cmin;
        if (cmax > maxY) maxY = cmax;
      }

      const firstY = positions.get(ch[0])!.y;
      const y = align === 'center' ? Math.round((minY + maxY) / 2) : firstY;
      positions.set(id, { x, y });
      return [Math.min(minY, y), Math.max(maxY, y)];
    };

    // Coloca todos los subárboles raíz
    for (const r of roots) place(r.id);

    // Asegura colocar cualquier nodo suelto (sin edges válidos)
    for (const n of graph.nodes) {
      if (!positions.has(n.id)) {
        const x = padding + levelIndex(n.id) * gapX;
        const y = padding + rowCursor * gapY;
        positions.set(n.id, { x, y });
        rowCursor += 1;
      }
    }

    const maxLevel = Math.max(0, ...graph.nodes.map((n) => levelIndex(n.id)));
    // Margen extra para evitar cortes
    const EXTRA_PAD = 16;

    const width = padding * 2 + maxLevel * gapX + nodeSize.w + EXTRA_PAD;
    const height =
      padding * 2 + Math.max(1, rowCursor) * gapY + nodeSize.h / 2 + EXTRA_PAD;

    return { positions, size: { width, height } };
  }
}
