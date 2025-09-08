// path: projects/schema/src/lib/schema-layout.service.ts

import { Injectable } from '@angular/core';
import ELK from 'elkjs/lib/elk.bundled.js';
import { NormalizedGraph, SchemaOptions, DEFAULT_OPTIONS } from '../models';

@Injectable({ providedIn: 'root' })
export class SchemaLayoutService {
  private elk = new ELK();

  async layout(
    graph: NormalizedGraph,
    opts: Partial<SchemaOptions> = {}
  ): Promise<NormalizedGraph> {
    const options: SchemaOptions = { ...DEFAULT_OPTIONS, ...opts };

    // Dirección principal LTR (ya existía)
    const dir = options.layoutDirection ?? 'RIGHT';
    const placementStrategy = 'BRANDES_KOEPF';
    const fixedAlign =
      options.layoutAlign === 'firstChild' ? 'LEFTUP' : 'BALANCED';

    const elkGraph: any = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': dir, // 👈 LTR
        'elk.layered.nodePlacement.strategy': placementStrategy,
        'elk.layered.nodePlacement.bk.fixedAlignment': fixedAlign,
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

    const res = await this.elk.layout(elkGraph);

    // =======================
    // 🔧 NORMALIZACIÓN DE Y (flip a "arriba → abajo")
    // =======================

    // 1) Recolectar TODOS los Y: nodos + puntos de aristas
    const childYs: number[] = (res['children'] || []).map((c: any) => c.y ?? 0);

    const edgeYs: number[] = [];
    for (const ee of res['edges'] || []) {
      for (const s of ee.sections || []) {
        if (s.startPoint) edgeYs.push(s.startPoint.y ?? 0);
        for (const bp of s.bendPoints || []) edgeYs.push(bp.y ?? 0);
        if (s.endPoint) edgeYs.push(s.endPoint.y ?? 0);
      }
    }

    const allYs = [...childYs, ...edgeYs];
    const minY = allYs.length ? Math.min(...allYs) : 0;
    const maxY = allYs.length ? Math.max(...allYs) : 0;

    const flipY = (y: number) => maxY - y + minY;

    // 2) Mapear nodos con flip correcto
    const mapNodes = new Map(graph.nodes.map((n) => [n.id, n]));
    res['children']?.forEach((c: any) => {
      const node = mapNodes.get(c.id);
      if (node) {
        node.x = c.x ?? 0;
        node.y = flipY(c.y ?? 0); // 👈 mismo flip que usaremos en edges
        node.width = c.width ?? node.width;
        node.height = c.height ?? node.height;
      }
    });

    // 3) Mapear aristas con el MISMO flip
    const mapEdges = new Map(graph.edges.map((e) => [e.id, e]));
    res['edges']?.forEach((ee: any) => {
      const e = mapEdges.get(ee.id);
      if (e && ee.sections?.length) {
        const pts: Array<{ x: number; y: number }> = [];
        ee.sections.forEach((s: any) => {
          if (s.startPoint)
            pts.push({ x: s.startPoint.x, y: flipY(s.startPoint.y) });
          (s.bendPoints || []).forEach((bp: any) =>
            pts.push({ x: bp.x, y: flipY(bp.y) })
          );
          if (s.endPoint) pts.push({ x: s.endPoint.x, y: flipY(s.endPoint.y) });
        });

        // 👇 NUEVO: ajustar extremos al centro de los nodos
        const src = graph.nodes.find((n) => n.id === e.source);
        const tgt = graph.nodes.find((n) => n.id === e.target);
        if (src) {
          pts[0] = {
            x: (src.x ?? 0) + (src.width ?? 0), // borde derecho
            y: (src.y ?? 0) + (src.height ?? 0) / 2,
          };
        }
        if (tgt) {
          pts[pts.length - 1] = {
            x: tgt.x ?? 0, // borde izquierdo
            y: (tgt.y ?? 0) + (tgt.height ?? 0) / 2,
          };
        }

        e.points = pts;
      }
    });

    return { nodes: graph.nodes, edges: graph.edges, meta: graph.meta };
  }
}
