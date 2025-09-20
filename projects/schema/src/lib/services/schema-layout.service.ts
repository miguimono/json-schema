// projects/schema/src/lib/services/schema-layout.service.ts
// ====================================================================
// SchemaLayoutService (layout "tidy tree" + snap de cadenas lineales)
// - RIGHT/DOWN con orden estable por jsonMeta.childOrder
// - layoutAlign: 'firstChild' o 'center'
// - Sin solapes: cada hermano ocupa el ALTO/ANCHO de su SUBÁRBOL
// - Snap opcional de cadenas (out=1) a la Y/X del hijo: settings.layout.snapChainSegmentsY
// - Links: 'orthogonal' => codos; 'curve'/'line' => [start,end] (SchemaLinks dibuja)
// ====================================================================

import { Injectable } from '@angular/core';
import {
  DEFAULT_SETTINGS,
  LayoutDirection,
  NormalizedGraph,
  SchemaEdge,
  SchemaNode,
  SchemaSettings,
  LinkStyle,
} from '../models';

type PinMap = Record<string, number>;

@Injectable({ providedIn: 'root' })
export class SchemaLayoutService {
  async layout(
    g: NormalizedGraph,
    settings: SchemaSettings = DEFAULT_SETTINGS
  ): Promise<NormalizedGraph> {
    const s = this.mergeSettings(settings);
    const dir: LayoutDirection = (s.layout?.layoutDirection ??
      DEFAULT_SETTINGS.layout.layoutDirection)!;
    const alignFirstChild =
      (s.layout?.layoutAlign ?? DEFAULT_SETTINGS.layout.layoutAlign) ===
      'firstChild';
    const linkStyle: LinkStyle = (s.layout?.linkStyle ??
      DEFAULT_SETTINGS.layout.linkStyle)!;
    const GAP_X =
      s.layout?.columnGapPx ?? DEFAULT_SETTINGS.layout.columnGapPx ?? 64;
    const GAP_Y = s.layout?.rowGapPx ?? DEFAULT_SETTINGS.layout.rowGapPx ?? 32;

    // --- índices ---
    const nodesById = new Map<string, SchemaNode>(
      g.nodes.map((n) => [n.id, n])
    );
    const childrenById = new Map<string, string[]>();
    const parentsById = new Map<string, string[]>();
    for (const n of g.nodes) {
      childrenById.set(n.id, []);
      parentsById.set(n.id, []);
    }
    for (const e of g.edges) {
      if (childrenById.has(e.source))
        childrenById.get(e.source)!.push(e.target);
      if (parentsById.has(e.target)) parentsById.get(e.target)!.push(e.source);
    }

    // Orden estable de hijos por childOrder
    for (const [pid, arr] of childrenById) {
      arr.sort((aId, bId) => {
        const a = nodesById.get(aId);
        const b = nodesById.get(bId);
        const ao = a?.jsonMeta?.childOrder ?? 0;
        const bo = b?.jsonMeta?.childOrder ?? 0;
        return ao === bo ? (a?.id ?? '').localeCompare(b?.id ?? '') : ao - bo;
      });
    }

    // Raíces (sin padres visibles)
    const roots = g.nodes.filter(
      (n) => (parentsById.get(n.id)?.length ?? 0) === 0
    );

    // Profundidad por BFS
    const depthById = new Map<string, number>();
    const q = [...roots];
    for (const r of roots) depthById.set(r.id, 0);
    while (q.length) {
      const n = q.shift()!;
      const d = depthById.get(n.id) ?? 0;
      for (const cid of childrenById.get(n.id) ?? []) {
        if (!depthById.has(cid)) {
          depthById.set(cid, d + 1);
          const cn = nodesById.get(cid);
          if (cn) q.push(cn);
        }
      }
    }

    // Medidas seguras
    const getW = (n: SchemaNode) =>
      Math.max(
        1,
        n.width ?? DEFAULT_SETTINGS.dataView?.defaultNodeSize?.width ?? 220
      );
    const getH = (n: SchemaNode) =>
      Math.max(
        1,
        n.height ?? DEFAULT_SETTINGS.dataView?.defaultNodeSize?.height ?? 96
      );

    // Tamaño del subárbol (RIGHT => alto; DOWN => ancho)
    const subtreeSize = new Map<string, number>();
    const measureSubtree = (id: string): number => {
      const node = nodesById.get(id)!;
      const kids = childrenById.get(id) ?? [];
      if (kids.length === 0) {
        const leafSize = dir === 'RIGHT' ? getH(node) : getW(node);
        subtreeSize.set(id, leafSize);
        return leafSize;
      }
      let sum = 0;
      for (let i = 0; i < kids.length; i++) {
        sum += measureSubtree(kids[i]);
        if (i < kids.length - 1) sum += GAP_Y;
      }
      subtreeSize.set(id, sum);
      return sum;
    };
    for (const r of roots) measureSubtree(r.id);

    // Offsets por capa (eje principal)
    const depths = Array.from(depthById.values());
    const maxDepth = Math.max(0, ...depths);
    const sizeByDepth: number[] = new Array(maxDepth + 1).fill(0);
    for (let d = 0; d <= maxDepth; d++) {
      const nodesAtD = g.nodes.filter((n) => (depthById.get(n.id) ?? 0) === d);
      sizeByDepth[d] =
        dir === 'RIGHT'
          ? Math.max(1, ...nodesAtD.map(getW), 1)
          : Math.max(1, ...nodesAtD.map(getH), 1);
    }
    const mainOffset: number[] = new Array(maxDepth + 1).fill(0);
    for (let d = 1; d <= maxDepth; d++) {
      mainOffset[d] = mainOffset[d - 1] + sizeByDepth[d - 1] + GAP_X;
    }

    // Pin map
    const meta = g.meta ?? {};
    const pinKey = dir === 'RIGHT' ? 'pinY' : 'pinX';
    if (!meta[pinKey]) meta[pinKey] = {};
    const pin: PinMap = meta[pinKey] as PinMap;

    // Posicionamiento tipo "tidy"
    const placeSubtree = (id: string, depth: number, start: number): number => {
      // start = inicio del bloque del subárbol sobre el eje secundario (y en RIGHT / x en DOWN)
      const node = nodesById.get(id)!;
      const kids = childrenById.get(id) ?? [];
      const mySize =
        subtreeSize.get(id) ?? (dir === 'RIGHT' ? getH(node) : getW(node));

      // Eje principal (x en RIGHT, y en DOWN)
      const mainPos = mainOffset[depth] ?? 0;

      if (kids.length === 0) {
        // Hoja: centrar su propia card dentro del bloque "mySize"
        const centerSec = start + mySize / 2;
        if (dir === 'RIGHT') {
          node.x = Math.round(mainPos);
          node.y = Math.round(centerSec - getH(node) / 2);
          pin[node.id] = Math.round(node.y + getH(node) / 2);
        } else {
          node.y = Math.round(mainPos);
          node.x = Math.round(centerSec - getW(node) / 2);
          pin[node.id] = Math.round(node.x + getW(node) / 2);
        }
        return mySize;
      }

      // Colocar hijos en cascada (por childOrder); guardamos el CENTRO DE LA CARD de cada hijo
      let cursor = start;
      const childCenters: number[] = [];

      for (let i = 0; i < kids.length; i++) {
        const cid = kids[i];
        const cNode = nodesById.get(cid)!;
        const cSize =
          subtreeSize.get(cid) ?? (dir === 'RIGHT' ? getH(cNode) : getW(cNode));

        // Colocamos primero el subárbol del hijo (asigna x/y al hijo)
        placeSubtree(cid, depth + 1, cursor);

        // Ahora tomamos el centro de la **CARD** del hijo (no del subárbol)
        const cCenter =
          dir === 'RIGHT'
            ? (cNode.y ?? 0) + getH(cNode) / 2
            : (cNode.x ?? 0) + getW(cNode) / 2;
        childCenters.push(cCenter);

        cursor += cSize + (i < kids.length - 1 ? GAP_Y : 0);
      }

      // Alineación del padre:
      // - firstChild → centro de la card del PRIMER hijo
      // - center     → promedio de los centros de las cards de los hijos
      const targetCenter = alignFirstChild
        ? childCenters[0]
        : childCenters.reduce((a, b) => a + b, 0) /
          Math.max(1, childCenters.length);

      if (dir === 'RIGHT') {
        node.x = Math.round(mainPos);
        node.y = Math.round(targetCenter - getH(node) / 2);
        pin[node.id] = Math.round(targetCenter);
      } else {
        node.y = Math.round(mainPos);
        node.x = Math.round(targetCenter - getW(node) / 2);
        pin[node.id] = Math.round(targetCenter);
      }

      return mySize; // alto/ancho consumido por el subárbol de este nodo
    };

    // Distribuir raíces (con pequeño padding superior para evitar “pegado” arriba)
    let globalCursor = 40; // padding superior
    for (let i = 0; i < roots.length; i++) {
      const r = roots[i];
      const rSize =
        subtreeSize.get(r.id) ?? (dir === 'RIGHT' ? getH(r) : getW(r));
      placeSubtree(r.id, 0, globalCursor);
      globalCursor += rSize + (i < roots.length - 1 ? GAP_Y : 0);
    }

    // ===== Puntos de aristas =====
    const edges: SchemaEdge[] = g.edges.map((e) => {
      const a = nodesById.get(e.source);
      const b = nodesById.get(e.target);
      if (!a || !b) return { ...e, points: [] };

      if (dir === 'RIGHT') {
        const ax = (a.x ?? 0) + getW(a);
        const ay = (a.y ?? 0) + Math.round(getH(a) / 2);
        const bx = b.x ?? 0;
        const by = (b.y ?? 0) + Math.round(getH(b) / 2);
        if (linkStyle === 'orthogonal') {
          const midX = Math.round((ax + bx) / 2);
          return {
            ...e,
            points: [
              { x: ax, y: ay },
              { x: midX, y: ay },
              { x: midX, y: by },
              { x: bx, y: by },
            ],
          };
        }
        return {
          ...e,
          points: [
            { x: ax, y: ay },
            { x: bx, y: by },
          ],
        };
      } else {
        const ax = (a.x ?? 0) + Math.round(getW(a) / 2);
        const ay = (a.y ?? 0) + getH(a);
        const bx = (b.x ?? 0) + Math.round(getW(b) / 2);
        const by = b.y ?? 0;
        if (linkStyle === 'orthogonal') {
          const midY = Math.round((ay + by) / 2);
          return {
            ...e,
            points: [
              { x: ax, y: ay },
              { x: ax, y: midY },
              { x: bx, y: midY },
              { x: bx, y: by },
            ],
          };
        }
        return {
          ...e,
          points: [
            { x: ax, y: ay },
            { x: bx, y: by },
          ],
        };
      }
    });

    return {
      nodes: g.nodes.map((n) => ({ ...n })), // x/y ya aplicados
      edges,
      meta: { ...meta },
    };
  }

  private mergeSettings(s: SchemaSettings): Required<SchemaSettings> {
    return {
      colors: { ...DEFAULT_SETTINGS.colors, ...(s.colors ?? {}) },
      layout: { ...DEFAULT_SETTINGS.layout, ...(s.layout ?? {}) },
      dataView: { ...DEFAULT_SETTINGS.dataView, ...(s.dataView ?? {}) },
      messages: { ...DEFAULT_SETTINGS.messages, ...(s.messages ?? {}) },
      viewport: { ...DEFAULT_SETTINGS.viewport, ...(s.viewport ?? {}) },
      debug: { ...DEFAULT_SETTINGS.debug, ...(s.debug ?? {}) },
    } as Required<SchemaSettings>;
  }
}
