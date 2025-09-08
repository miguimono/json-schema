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
    const dir = options.layoutDirection ?? 'RIGHT';

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

    const res = await this.elk.layout(elkGraph);

    // ---- Flip Y con TODOS los Y (nodos + aristas)
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

    // ---- Mapear nodos
    const mapNodes = new Map(graph.nodes.map((n) => [n.id, n]));
    res['children']?.forEach((c: any) => {
      const node = mapNodes.get(c.id);
      if (!node) return;
      node.x = c.x ?? 0;
      node.y = flipY(c.y ?? 0);
      node.width = c.width ?? node.width;
      node.height = c.height ?? node.height;
    });

    // ---- Mapear aristas
    const mapEdges = new Map(graph.edges.map((e) => [e.id, e]));
    res['edges']?.forEach((ee: any) => {
      const e = mapEdges.get(ee.id);
      if (!e || !ee.sections?.length) return;

      // 1) pts = start + bends + end (ya con flip)
      let pts: Array<{ x: number; y: number }> = [];
      ee.sections.forEach((s: any) => {
        if (s.startPoint)
          pts.push({ x: s.startPoint.x, y: flipY(s.startPoint.y) });
        (s.bendPoints || []).forEach((bp: any) =>
          pts.push({ x: bp.x, y: flipY(bp.y) })
        );
        if (s.endPoint) pts.push({ x: s.endPoint.x, y: flipY(s.endPoint.y) });
      });
      if (pts.length < 2) {
        e.points = pts;
        return;
      }

      // 2) Ajustar extremos al BORDE (RIGHT→LEFT)
      const src = mapNodes.get(e.source);
      const tgt = mapNodes.get(e.target);
      if (src) {
        const xStart = (src.x ?? 0) + (src.width ?? 0); // borde derecho
        const yStart = (src.y ?? 0) + (src.height ?? 0) / 2;
        pts[0] = { x: xStart, y: yStart };
      }
      if (tgt) {
        const xEnd = tgt.x ?? 0; // borde izquierdo
        const yEnd = (tgt.y ?? 0) + (tgt.height ?? 0) / 2;
        pts[pts.length - 1] = { x: xEnd, y: yEnd };
      }

      // 3) Si es orthogonal, garantizar segmentos 90° en los extremos
      if (
        (options.linkStyle ?? 'orthogonal') === 'orthogonal' &&
        pts.length >= 2
      ) {
        const start = pts[0];
        const end = pts[pts.length - 1];
        const sx = start.x,
          sy = start.y;
        const ex = end.x,
          ey = end.y;

        // eje intermedio centrado: evita puntas y diagonales
        const midX = Math.round((sx + ex) / 2);

        pts = [
          { x: sx, y: sy }, // sale horizontal desde el source
          { x: midX, y: sy }, // codo 1 (horizontal -> vertical)
          { x: midX, y: ey }, // tramo vertical
          { x: ex, y: ey }, // tramo final horizontal hacia el target
        ];
      }

      e.points = pts;
    });

    return { nodes: graph.nodes, edges: graph.edges, meta: graph.meta };
  }
}
