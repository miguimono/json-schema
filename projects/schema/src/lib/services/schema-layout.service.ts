// projects/schema/src/lib/services/schema-layout.service.ts

import { Injectable } from '@angular/core';
import ELK from 'elkjs/lib/elk.bundled.js';
import {
  NormalizedGraph,
  SchemaOptions,
  DEFAULT_OPTIONS,
  SchemaNode,
} from '../models';

/**
 * Servicio de layout:
 * - Ejecuta ELK (layered) con dirección RIGHT/DOWN y ruteo ORTHOGONAL.
 * - Aplica flip-Y para facilitar el render en un sistema de coordenadas "pantalla".
 * - Reordena hermanos usando jsonMeta.childOrder y aplica gap dinámico legible.
 * - Alinea padre con hijos (firstChild/center).
 * - Reconstruye los puntos de aristas (orthogonal/line/curve) respetando thresholds.
 * - Soporta alineaciones opcionales: snapRootChildrenY / snapChainSegmentsY.
 */
@Injectable({ providedIn: 'root' })
export class SchemaLayoutService {
  private elk = new ELK();

  /**
   * Calcula posiciones (x,y,width,height) de nodos y puntos de aristas.
   * @param graph Grafo normalizado (nodos+aristas).
   * @param opts Opciones parciales (mezcladas con {@link DEFAULT_OPTIONS}).
   * @returns Grafo con posiciones y puntos de dibujo actualizados.
   */
  async layout(
    graph: NormalizedGraph,
    opts: Partial<SchemaOptions> = {}
  ): Promise<NormalizedGraph> {
    const options: SchemaOptions = { ...DEFAULT_OPTIONS, ...opts };
    const dir = options.layoutDirection ?? 'RIGHT';

    // 1) Preparar entrada de ELK
    const elkGraph: any = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': dir,
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.layered.nodePlacement.bk.fixedAlignment':
          options.layoutAlign === 'firstChild' ? 'LEFTUP' : 'BALANCED',
        'elk.layered.spacing.nodeNodeBetweenLayers': '64',
        'elk.spacing.nodeNode': '32',
        'elk.edgeRouting': 'ORTHOGONAL',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      },
      children: graph.nodes.map((n) => ({
        id: n.id,
        width: n.width,
        height: n.height,
        labels: [{ text: n.label }],
      })),
      edges: graph.edges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    };

    // 2) Layout ELK
    const res = await this.elk.layout(elkGraph);

    // 3) Flip Y para tener un sistema "hacia abajo" compatible con pantalla
    const childYs: number[] = (res['children'] || []).map((c: any) => c.y ?? 0);
    const edgeYs: number[] = [];
    for (const ee of res['edges'] || []) {
      for (const s of ee.sections || []) {
        if (s.startPoint) edgeYs.push(s.startPoint.y ?? 0);
        (s.bendPoints || []).forEach((bp: any) => edgeYs.push(bp.y ?? 0));
        if (s.endPoint) edgeYs.push(s.endPoint.y ?? 0);
      }
    }
    const allYs = [...childYs, ...edgeYs];
    const minY = allYs.length ? Math.min(...allYs) : 0;
    const maxY = allYs.length ? Math.max(...allYs) : 0;
    const flipY = (y: number) => maxY - y + minY;

    // 4) Mapear posiciones de nodos
    const mapNodes = new Map(graph.nodes.map((n) => [n.id, n]));
    res['children']?.forEach((c: any) => {
      const node = mapNodes.get(c.id);
      if (!node) return;
      node.x = c.x ?? 0;
      node.y = flipY(c.y ?? 0);
      node.width = c.width ?? node.width;
      node.height = c.height ?? node.height;
    });

    // 5) Alineaciones opcionales
    if (options.snapRootChildrenY) {
      const rootId = graph.nodes[0]?.id;
      if (rootId) {
        const childIds = graph.edges
          .filter((e) => e.source === rootId)
          .map((e) => e.target);
        const children = childIds
          .map((id) => mapNodes.get(id))
          .filter(Boolean) as any[];
        if (children.length > 1) {
          const avgCenterY =
            children.reduce(
              (acc, n) => acc + ((n.y ?? 0) + (n.height ?? 0) / 2),
              0
            ) / children.length;
          children.forEach(
            (n) => (n.y = Math.round(avgCenterY - (n.height ?? 0) / 2))
          );
        }
      }
    }
    if (options.snapChainSegmentsY) {
      const outDeg = new Map<string, number>();
      const inDeg = new Map<string, number>();
      graph.edges.forEach((e) => {
        outDeg.set(e.source, (outDeg.get(e.source) ?? 0) + 1);
        inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
      });
      graph.edges.forEach((e) => {
        if (
          (outDeg.get(e.source) ?? 0) === 1 &&
          (inDeg.get(e.target) ?? 0) === 1
        ) {
          const src = mapNodes.get(e.source);
          const tgt = mapNodes.get(e.target);
          if (src && tgt) {
            const srcCy = (src.y ?? 0) + (src.height ?? 0) / 2;
            tgt.y = Math.round(srcCy - (tgt.height ?? 0) / 2);
          }
        }
      });
    }

    // 6) Agrupar hijos por padre y contar hijos para reordenar y aplicar gap
    const childrenByParent = new Map<string, SchemaNode[]>();
    const childrenCountByNode = new Map<string, number>();
    for (const n of graph.nodes) childrenByParent.set(n.id, []);
    for (const e of graph.edges) {
      const child = mapNodes.get(e.target);
      if (!child) continue;
      childrenByParent.get(e.source)!.push(child);
      childrenCountByNode.set(
        e.source,
        (childrenCountByNode.get(e.source) ?? 0) + 1
      );
    }

    // ⭐ pinY (si se pasó en meta)
    const pinY: Record<string, number> =
      (graph.meta?.['pinY'] as Record<string, number> | undefined) ?? {};

    // (1) Reordenar hermanos por childOrder y aplicar gap dinámico legible
    for (const [parentId, childs] of childrenByParent.entries()) {
      if (!childs || childs.length <= 1) continue;

      // Orden estable por childOrder (y luego por y por si falta metadato)
      childs.sort((a, b) => {
        const ao = a.jsonMeta?.childOrder ?? Number.POSITIVE_INFINITY;
        const bo = b.jsonMeta?.childOrder ?? Number.POSITIVE_INFINITY;
        return ao - bo || (a.y ?? 0) - (b.y ?? 0);
      });

      // Gap dinámico en función de "ramificación" promedio
      let sumKids = 0;
      for (const c of childs) sumKids += childrenCountByNode.get(c.id) ?? 0;
      const avgKids = childs.length ? sumKids / childs.length : 0;
      const gap = Math.max(
        32,
        Math.min(80, 32 + Math.round(Math.min(4, Math.max(0, avgKids)) * 12))
      );

      // Si alguno está "fijado" (pinY), se respeta y se recalcula hacia arriba/abajo
      const fixedIdx = childs.findIndex((c) => pinY[c.id] != null);
      if (fixedIdx >= 0) {
        const fixed = childs[fixedIdx];
        const fixedTop = pinY[fixed.id]!;
        fixed.y = fixedTop;

        let cursorUp = fixedTop;
        for (let i = fixedIdx - 1; i >= 0; i--) {
          const n = childs[i];
          cursorUp -= (n.height ?? 0) + gap;
          n.y = cursorUp;
        }

        let cursorDown = (fixed.y ?? 0) + (fixed.height ?? 0) + gap;
        for (let i = fixedIdx + 1; i < childs.length; i++) {
          const n = childs[i];
          n.y = cursorDown;
          cursorDown += (n.height ?? 0) + gap;
        }
      } else {
        const avgCy =
          childs.reduce(
            (acc, n) => acc + ((n.y ?? 0) + (n.height ?? 0) / 2),
            0
          ) / childs.length;
        const totalH =
          childs.reduce((acc, n) => acc + (n.height ?? 0), 0) +
          gap * (childs.length - 1);
        let cursorY = Math.round(avgCy - totalH / 2);
        for (const n of childs) {
          n.y = cursorY;
          cursorY += (n.height ?? 0) + gap;
        }
      }
    }

    // (2) Alineación padre ↔ hijos
    const alignMode = options.layoutAlign ?? 'center';
    for (const [parentId, childs] of childrenByParent.entries()) {
      if (!childs || childs.length === 0) continue;
      const parent = mapNodes.get(parentId);
      if (!parent) continue;

      let targetCy: number;
      if (alignMode === 'firstChild') {
        const ordered = [...childs].sort((a, b) => {
          const ao = a.jsonMeta?.childOrder ?? Number.POSITIVE_INFINITY;
          const bo = b.jsonMeta?.childOrder ?? Number.POSITIVE_INFINITY;
          return ao - bo || (a.y ?? 0) - (b.y ?? 0);
        });
        const first = ordered[0];
        const firstCy = (first.y ?? 0) + (first.height ?? 0) / 2;
        targetCy = firstCy;
      } else {
        targetCy =
          childs.reduce(
            (acc, n) => acc + ((n.y ?? 0) + (n.height ?? 0) / 2),
            0
          ) / childs.length;
      }

      parent.y = Math.round(targetCy - (parent.height ?? 0) / 2);
    }

    // (3) Recalcular puntos de aristas en función del estilo
    const mapEdges = new Map(graph.edges.map((e) => [e.id, e]));
    for (const e of graph.edges) {
      const src = mapNodes.get(e.source);
      const tgt = mapNodes.get(e.target);
      if (!src || !tgt) {
        const me = mapEdges.get(e.id);
        if (me) me.points = [];
        continue;
      }
      const start = {
        x: (src.x ?? 0) + (src.width ?? 0),
        y: (src.y ?? 0) + (src.height ?? 0) / 2,
      };
      const end = {
        x: tgt.x ?? 0,
        y: (tgt.y ?? 0) + (tgt.height ?? 0) / 2,
      };

      if ((options.linkStyle ?? 'orthogonal') === 'orthogonal') {
        const midX = Math.round((start.x + end.x) / 2);
        e.points = [
          { x: start.x, y: start.y },
          { x: midX, y: start.y },
          { x: midX, y: end.y },
          { x: end.x, y: end.y },
        ];
      } else if (options.linkStyle === 'line') {
        e.points = [start, end];
      } else {
        const dxAbs = Math.abs(end.x - start.x);
        if (dxAbs < (options.straightThresholdDx ?? 160)) {
          e.points = [start, end];
        } else {
          const t = Math.max(20, Math.min(200, options.curveTension ?? 80));
          const dir = Math.sign(end.x - start.x) || 1;
          const dy = end.y - start.y;
          let c1x = start.x + dir * t,
            c1y = start.y;
          let c2x = end.x - dir * t,
            c2y = end.y;
          if (Math.abs(dy) < 1) {
            const bow = Math.max(8, Math.min(96, t * 0.5));
            c1y = start.y - bow;
            c2y = end.y + bow;
          }
          e.points = [start, { x: c1x, y: c1y }, { x: c2x, y: c2y }, end];
        }
      }
    }

    return { nodes: graph.nodes, edges: graph.edges, meta: graph.meta };
  }
}
