// projects/schema/src/lib/services/schema-layout.service.ts
// ====================================================================
// SchemaLayoutService (layout tipo "tidy tree")
// - RIGHT/DOWN con orden estable por jsonMeta.childOrder
// - Alineación del padre al PRIMER hijo cuando layoutAlign==='firstChild'
// - Sin solapes: cada hermano ocupa el ALTO/ANCHO de su SUBÁRBOL
// - Sin mezcla de ramas: se apilan por grupos de padre
// - Links: si linkStyle==='orthogonal' => codos; si 'curve' o 'line' => [start,end]
// - Pin map (pinY/pinX) se mantiene para estabilidad (no forzamos reposicionamiento)
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
  // Separaciones
  private readonly hGap = 64; // separación entre columnas (RIGHT) o filas (DOWN)
  private readonly vGap = 20; // separación entre hermanos (sobre eje secundario)

  async layout(
    g: NormalizedGraph,
    settings: SchemaSettings = DEFAULT_SETTINGS
  ): Promise<NormalizedGraph> {
    const s = this.mergeSettings(settings);
    const dir: LayoutDirection = (s.layout?.layoutDirection ??
      DEFAULT_SETTINGS.layout.layoutDirection) as LayoutDirection;
    const alignFirstChild =
      (s.layout?.layoutAlign ?? 'firstChild') === 'firstChild';
    const linkStyle: LinkStyle = (s.layout?.linkStyle ??
      DEFAULT_SETTINGS.layout.linkStyle)!;

    // --- mapas auxiliares ---
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

    // Ordenar hijos de cada padre por childOrder del adapter (estable)
    for (const [pid, arr] of childrenById) {
      arr.sort((aId, bId) => {
        const a = nodesById.get(aId);
        const b = nodesById.get(bId);
        const ao = a?.jsonMeta?.childOrder ?? 0;
        const bo = b?.jsonMeta?.childOrder ?? 0;
        if (ao !== bo) return ao - bo;
        return (a?.id ?? '').localeCompare(b?.id ?? '');
      });
    }

    // Raíces visibles (sin padres)
    const roots = g.nodes.filter(
      (n) => (parentsById.get(n.id)?.length ?? 0) === 0
    );

    // Profundidad por BFS (múltiples raíces si aplica)
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

    // Tamaños seguros
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

    // Altura (RIGHT) o ancho (DOWN) del SUBÁRBOL por nodo (DFS)
    const subtreeSize = new Map<string, number>(); // RIGHT=>altura; DOWN=>ancho

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
        if (i < kids.length - 1) sum += this.vGap;
      }
      subtreeSize.set(id, sum);
      return sum;
    };

    for (const r of roots) measureSubtree(r.id);

    // Offsets por columna/fila (eje principal)
    // RIGHT: x por profundidad; DOWN: y por profundidad
    const maxDepth = Math.max(0, ...Array.from(depthById.values()));
    const mainOffset: number[] = new Array(maxDepth + 1).fill(0);
    for (let d = 0; d <= maxDepth; d++) {
      const nodesAtDepth = g.nodes.filter(
        (n) => (depthById.get(n.id) ?? 0) === d
      );
      const maxSize =
        dir === 'RIGHT'
          ? Math.max(1, ...nodesAtDepth.map(getW), 1)
          : Math.max(1, ...nodesAtDepth.map(getH), 1);
      mainOffset[d] =
        d === 0
          ? 0
          : mainOffset[d - 1] +
            (dir === 'RIGHT'
              ? Math.max(
                  1,
                  ...g.nodes
                    .filter((n) => (depthById.get(n.id) ?? 0) === d - 1)
                    .map(getW),
                  1
                )
              : Math.max(
                  1,
                  ...g.nodes
                    .filter((n) => (depthById.get(n.id) ?? 0) === d - 1)
                    .map(getH),
                  1
                )) +
            this.hGap;
      // Ajuste para d=0 (queda en 0)
      if (d === 0) mainOffset[0] = 0;
      // También guardamos el ancho/alto máximo por capa si lo necesitas
      void maxSize;
    }

    // Pin map (no forzamos posición, solo registramos la nueva)
    const meta = g.meta ?? {};
    const pinKey = dir === 'RIGHT' ? 'pinY' : 'pinX';
    if (!meta[pinKey]) meta[pinKey] = {};
    const pin: PinMap = meta[pinKey] as PinMap;

    // Posicionamiento "tidy": coloca cada subárbol como bloque continuo
    const placeSubtree = (id: string, depth: number, start: number): number => {
      // start = inicio del bloque del subárbol sobre eje secundario (y en RIGHT / x en DOWN)
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

      // Colocar hijos en cascada
      let cursor = start;
      const childCenters: number[] = [];
      for (let i = 0; i < kids.length; i++) {
        const cid = kids[i];
        const cSize = subtreeSize.get(cid)!;
        // colocar subárbol del hijo desde 'cursor'
        placeSubtree(cid, depth + 1, cursor);
        // centro del hijo (sobre eje secundario)
        const center = cursor + cSize / 2;
        childCenters.push(center);
        cursor += cSize;
        if (i < kids.length - 1) cursor += this.vGap;
      }

      // Alinear padre:
      // - firstChild => centro del primer hijo
      // - center     => centro del bloque de todos los hijos
      const firstCenter = childCenters[0];
      const blockCenter =
        childCenters.length === 1
          ? childCenters[0]
          : (childCenters[0] + childCenters[childCenters.length - 1]) / 2;

      const targetCenter = alignFirstChild ? firstCenter : blockCenter;

      if (dir === 'RIGHT') {
        node.x = Math.round(mainPos);
        node.y = Math.round(targetCenter - getH(node) / 2);
        pin[node.id] = Math.round(node.y + getH(node) / 2);
      } else {
        node.y = Math.round(mainPos);
        node.x = Math.round(targetCenter - getW(node) / 2);
        pin[node.id] = Math.round(node.x + getW(node) / 2);
      }

      return mySize; // el alto/ancho consumido del bloque del subárbol
    };

    // Distribuir subárboles raíz, uno bajo el otro, sin mezcla
    let globalCursor = 0;
    for (let i = 0; i < roots.length; i++) {
      const r = roots[i];
      const rSize =
        subtreeSize.get(r.id) ?? (dir === 'RIGHT' ? getH(r) : getW(r));
      placeSubtree(r.id, 0, globalCursor);
      globalCursor += rSize;
      if (i < roots.length - 1) globalCursor += this.vGap; // espacio entre raíces
    }

    // --- Calcular puntos de aristas ---
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
        } else {
          // curve | line → dejamos que SchemaLinksComponent genere la curva/recta
          return {
            ...e,
            points: [
              { x: ax, y: ay },
              { x: bx, y: by },
            ],
          };
        }
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
        } else {
          return {
            ...e,
            points: [
              { x: ax, y: ay },
              { x: bx, y: by },
            ],
          };
        }
      }
    });

    // Devolver grafo actualizado (copias superficiales)
    return {
      nodes: g.nodes.map((n) => ({ ...n })), // n.x/n.y ya mutados arriba
      edges,
      meta: { ...meta },
    };
  }

  // ---- helpers ----

  private mergeSettings(s: SchemaSettings): Required<SchemaSettings> {
    // Forzamos Required para que TS "sepa" que hay defaults
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
