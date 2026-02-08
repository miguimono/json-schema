/**
 * Servicio: SchemaLayoutService
 * ----------------------------------------------------------------------------
 * Calcula posiciones (x,y) para un grafo normalizado (nodos/aristas) usando
 * un layout jerárquico tipo "tidy tree" en dos variantes:
 *  - layoutDirection = "RIGHT": el árbol crece de izquierda → derecha.
 *  - layoutDirection = "DOWN" : el árbol crece de arriba → abajo.
 *
 * Características:
 *  - Respeta el orden de los hijos según `jsonMeta.childOrder` (estable, derivado del JSON).
 *  - Soporta alineación del padre con respecto a los hijos: "firstChild" o "center".
 *  - Genera puntos para aristas compatibles con estilos: "orthogonal", "curve" y "line".
 *  - Mantiene "pins" en `meta.pinY` o `meta.pinX` (pre-alistado por el componente) para anclajes.
 */

import { Injectable } from "@angular/core";
import {
  DEFAULT_SETTINGS,
  LayoutDirection,
  NormalizedGraph,
  SchemaEdge,
  SchemaNode,
  SchemaSettings,
  LinkStyle,
} from "../models";

type PinMap = Record<string, number>;

/**
 * Servicio de layout tipo “tidy tree” para RIGHT/DOWN.
 * No gestiona pan/zoom ni overlays; solo posiciones y trayectorias.
 */
@Injectable({ providedIn: "root" })
export class SchemaLayoutService {
  /**
   * Aplica layout al grafo.
   * @param g         Grafo normalizado (nodos/aristas).
   * @param settings  Configuración parcial. Se fusiona con DEFAULT_SETTINGS.
   * @returns         Grafo con nodos posicionados y aristas con `points`.
   */
  async layout(g: NormalizedGraph, settings: SchemaSettings = DEFAULT_SETTINGS): Promise<NormalizedGraph> {
    const s = this.mergeSettings(settings);

    // Dirección principal y opciones de alineación/estilo
    const dir: LayoutDirection = s.layout?.layoutDirection ?? DEFAULT_SETTINGS.layout.layoutDirection!;
    const alignFirstChild = (s.layout?.layoutAlign ?? DEFAULT_SETTINGS.layout.layoutAlign) === "firstChild";
    const linkStyle: LinkStyle = s.layout?.linkStyle ?? DEFAULT_SETTINGS.layout.linkStyle!;

    // Gaps (separaciones) con defaults seguros
    const GAP_X = s.layout?.columnGapPx ?? DEFAULT_SETTINGS.layout.columnGapPx ?? 0;
    const GAP_Y = s.layout?.rowGapPx ?? DEFAULT_SETTINGS.layout.rowGapPx ?? 0;

    // Índices de consulta rápida
    const nodesById = new Map<string, SchemaNode>(g.nodes.map((n) => [n.id, n]));
    const childrenById = new Map<string, string[]>();
    const parentsById = new Map<string, string[]>();
    for (const n of g.nodes) {
      childrenById.set(n.id, []);
      parentsById.set(n.id, []);
    }
    for (const e of g.edges) {
      if (childrenById.has(e.source)) childrenById.get(e.source)!.push(e.target);
      if (parentsById.has(e.target)) parentsById.get(e.target)!.push(e.source);
    }

    // Orden estable por childOrder (si empatan, ordena por id)
    for (const [pid, arr] of childrenById) {
      arr.sort((aId, bId) => {
        const a = nodesById.get(aId);
        const b = nodesById.get(bId);
        const ao = a?.jsonMeta?.childOrder ?? 0;
        const bo = b?.jsonMeta?.childOrder ?? 0;
        return ao === bo ? (a?.id ?? "").localeCompare(b?.id ?? "") : ao - bo;
      });
    }

    // Raíces (nodos sin padres)
    const roots = g.nodes.filter((n) => (parentsById.get(n.id)?.length ?? 0) === 0);

    // Profundidad por nodo (BFS)
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

    // Helpers de tamaño (con fallback a defaults)
    const getW = (n: SchemaNode) => {
      const fallback = DEFAULT_SETTINGS.dataView.defaultNodeSize?.width ?? 1;
      const w = n.width ?? fallback;
      return Number.isFinite(w) && w > 0 ? w : fallback;
    };
    const getH = (n: SchemaNode) => {
      const fallback = DEFAULT_SETTINGS.dataView.defaultNodeSize?.height ?? 1;
      const h = n.height ?? fallback;
      return Number.isFinite(h) && h > 0 ? h : fallback;
    };

    // Tamaño acumulado de cada subárbol en el eje secundario (para apilado)
    const subtreeSize = new Map<string, number>();
    const measureSubtree = (id: string): number => {
      const node = nodesById.get(id);
      const kids = childrenById.get(id) ?? [];
      if (!node) {
        subtreeSize.set(id, 0);
        return 0;
      }
      if (kids.length === 0) {
        const leafSize = dir === "RIGHT" ? getH(node) : getW(node);
        subtreeSize.set(id, leafSize);
        return leafSize;
      }
      let sum = 0;
      for (let i = 0; i < kids.length; i++) {
        sum += measureSubtree(kids[i]);
        if (i < kids.length - 1) sum += GAP_Y; // espacio entre hermanos
      }
      subtreeSize.set(id, sum);
      return sum;
    };
    for (const r of roots) measureSubtree(r.id);

    // Offset acumulado por profundidad en el eje principal
    const depths = Array.from(depthById.values());
    const maxDepth = depths.length ? Math.max(0, ...depths) : 0;
    const sizeByDepth: number[] = new Array(maxDepth + 1).fill(0);
    for (let d = 0; d <= maxDepth; d++) {
      const nodesAtD = g.nodes.filter((n) => (depthById.get(n.id) ?? 0) === d);
      sizeByDepth[d] = dir === "RIGHT" ? Math.max(1, ...nodesAtD.map(getW), 1) : Math.max(1, ...nodesAtD.map(getH), 1);
    }
    const mainOffset: number[] = new Array(maxDepth + 1).fill(0);
    for (let d = 1; d <= maxDepth; d++) {
      mainOffset[d] = mainOffset[d - 1] + sizeByDepth[d - 1] + GAP_X;
    }

    // Preparación de "pin" en meta (mapa de centros por eje secundario)
    const meta = g.meta ?? {};
    const pinKey = dir === "RIGHT" ? "pinY" : "pinX";
    if (!meta[pinKey]) meta[pinKey] = {};
    const pin: PinMap = (meta[pinKey] as PinMap) ?? {};

    /**
     * Coloca recursivamente un subárbol:
     *  - depth: profundidad actual
     *  - start: posición inicial en el eje secundario para apilar hijos
     * Retorna el tamaño del subárbol en el eje secundario.
     */
    const placeSubtree = (id: string, depth: number, start: number): number => {
      const node = nodesById.get(id);
      const kids = childrenById.get(id) ?? [];
      const mySize = subtreeSize.get(id) ?? 0;
      const mainPos = mainOffset[depth] ?? 0;

      if (!node) return mySize;

      // Hoja: centra sobre el rango [start, start+mySize]
      if (kids.length === 0) {
        const centerSec = start + mySize / 2;
        if (dir === "RIGHT") {
          node.x = Math.round(mainPos);
          node.y = Math.round(centerSec - getH(node) / 2);
          pin[node.id] = Math.round((node.y ?? 0) + getH(node) / 2);
        } else {
          node.y = Math.round(mainPos);
          node.x = Math.round(centerSec - getW(node) / 2);
          pin[node.id] = Math.round((node.x ?? 0) + getW(node) / 2);
        }
        return mySize;
      }

      // Nodo con hijos: posiciona hijos apilados y centra el padre
      let cursor = start;
      const childCenters: number[] = [];
      for (let i = 0; i < kids.length; i++) {
        const cid = kids[i];
        const cNode = nodesById.get(cid);
        const cSize = subtreeSize.get(cid) ?? (cNode ? (dir === "RIGHT" ? getH(cNode) : getW(cNode)) : 0);

        placeSubtree(cid, depth + 1, cursor);

        if (cNode) {
          const cCenter = dir === "RIGHT" ? (cNode.y ?? 0) + getH(cNode) / 2 : (cNode.x ?? 0) + getW(cNode) / 2;
          childCenters.push(cCenter);
        }

        cursor += cSize + (i < kids.length - 1 ? GAP_Y : 0);
      }

      // Objetivo de centrado del padre
      const targetCenter =
        alignFirstChild || childCenters.length === 0
          ? (childCenters[0] ?? 0)
          : childCenters.reduce((a, b) => a + b, 0) / Math.max(1, childCenters.length);

      if (dir === "RIGHT") {
        node.x = Math.round(mainPos);
        node.y = Math.round(targetCenter - getH(node) / 2);
        pin[node.id] = Math.round(targetCenter);
      } else {
        node.y = Math.round(mainPos);
        node.x = Math.round(targetCenter - getW(node) / 2);
        pin[node.id] = Math.round(targetCenter);
      }

      return mySize;
    };

    // Coloca cada raíz con un margen superior/izquierdo inicial
    let globalCursor = 40;
    for (let i = 0; i < roots.length; i++) {
      const r = roots[i];
      const rSize = subtreeSize.get(r.id) ?? (dir === "RIGHT" ? getH(r) : getW(r));
      placeSubtree(r.id, 0, globalCursor);
      globalCursor += rSize + (i < roots.length - 1 ? (s.layout.rowGapPx ?? 0) : 0);
    }

    // Generación de puntos para aristas en función del estilo
    const edges: SchemaEdge[] = g.edges.map((e) => {
      const a = nodesById.get(e.source);
      const b = nodesById.get(e.target);
      if (!a || !b) return { ...e, points: [] };

      if (dir === "RIGHT") {
        const ax = (a.x ?? 0) + getW(a);
        const ay = (a.y ?? 0) + Math.round(getH(a) / 2);
        const bx = b.x ?? 0;
        const by = (b.y ?? 0) + Math.round(getH(b) / 2);

        if (linkStyle === "orthogonal") {
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
        // curve/line: el componente define la forma final (curva o línea)
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

        if (linkStyle === "orthogonal") {
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

    // Retorna copias superficiales (no muta el original `g`)
    return { nodes: g.nodes.map((n) => ({ ...n })), edges, meta: { ...(g.meta ?? {}) } };
  }

  /**
   * Fusiona settings parciales con DEFAULT_SETTINGS, sección por sección.
   */
  private mergeSettings(s: SchemaSettings): Required<SchemaSettings> {
    return {
      colors: { ...DEFAULT_SETTINGS.colors, ...(s.colors ?? {}) },
      layout: { ...DEFAULT_SETTINGS.layout, ...(s.layout ?? {}) },
      dataView: { ...DEFAULT_SETTINGS.dataView, ...(s.dataView ?? {}) },
      messages: { ...DEFAULT_SETTINGS.messages, ...(s.messages ?? {}) },
      viewport: { ...DEFAULT_SETTINGS.viewport, ...(s.viewport ?? {}) },
    };
  }
}
