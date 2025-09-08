// ============================================
// projects/schema/src/lib/schema-layout.service.ts
// ============================================
// Calcula posiciones de nodos y ruta de aristas usando ELK (layered) y adapta
// los puntos para el render (incluye flip de coordenadas Y y anclaje en bordes).
// Reglas clave:
//  - Dirección principal controlada por `options.layoutDirection` (default "RIGHT").
//  - Enlaces con routing ORTHOGONAL desde ELK.
//  - Flip Y consistente usando el rango de Y de nodos y aristas.
//  - Anclar enlaces en borde derecho (source) → borde izquierdo (target).
//  - Si `linkStyle === "orthogonal"`, se reconstruye una polilínea Manhattan
//    limpia de 4 puntos: (sx,sy) → (midX,sy) → (midX,ey) → (ex,ey).
// No modifica la lógica de layout, añade documentación JSDoc y comentarios.
// ============================================

import { Injectable } from '@angular/core';
import ELK from 'elkjs/lib/elk.bundled.js';
import { NormalizedGraph, SchemaOptions, DEFAULT_OPTIONS } from '../models';

@Injectable({ providedIn: 'root' })
export class SchemaLayoutService {
  /** Instancia de ELK para cálculo de layout. */
  private elk = new ELK();

  /**
   * Ejecuta el layout sobre el grafo normalizado y devuelve un nuevo grafo con
   * coordenadas (x,y), tamaño (w,h) y puntos de aristas listos para render.
   *
   * Pipeline:
   *  1) Construcción del grafo ELK con opciones (layered, direction, spacing, etc.).
   *  2) Llamada a `elk.layout`.
   *  3) Flip de coordenadas Y usando min/max globales (nodos + aristas).
   *  4) Mapeo de nodos y aristas al modelo interno:
   *     - Nodos: x,y,width,height.
   *     - Aristas: start/bends/end con flip aplicado.
   *     - Anclaje en bordes (source:right-center, target:left-center).
   *     - Para linkStyle 'orthogonal': reconstrucción Manhattan de 4 puntos.
   *
   * @param graph Grafo normalizado (sin posiciones).
   * @param opts  Subconjunto de SchemaOptions que sobrescribe DEFAULT_OPTIONS.
   * @returns     Grafo con posiciones y puntos calculados.
   */
  async layout(
    graph: NormalizedGraph,
    opts: Partial<SchemaOptions> = {}
  ): Promise<NormalizedGraph> {
    const options: SchemaOptions = { ...DEFAULT_OPTIONS, ...opts };
    const dir = options.layoutDirection ?? 'RIGHT';

    // ---- 1) Grafo de ELK y opciones de layout
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

    // ---- 2) Ejecutar ELK
    const res = await this.elk.layout(elkGraph);

    // ---- 3) Flip Y usando TODOS los Y (nodos + aristas) para mantener coherencia global
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

    // ---- 4) Mapear nodos: asignar posiciones y tamaños
    const mapNodes = new Map(graph.nodes.map((n) => [n.id, n]));
    res['children']?.forEach((c: any) => {
      const node = mapNodes.get(c.id);
      if (!node) return;
      node.x = c.x ?? 0;
      node.y = flipY(c.y ?? 0);
      node.width = c.width ?? node.width;
      node.height = c.height ?? node.height;
    });

    // ---- 5) Mapear aristas: puntos con flip, anclaje y saneo según estilo
    const mapEdges = new Map(graph.edges.map((e) => [e.id, e]));
    res['edges']?.forEach((ee: any) => {
      const e = mapEdges.get(ee.id);
      if (!e || !ee.sections?.length) return;

      // 5.1) Recolectar puntos (start + bends + end) con flip aplicado
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

      // 5.2) Anclar extremos al BORDE (RIGHT→LEFT) de las cards
      const src = mapNodes.get(e.source);
      const tgt = mapNodes.get(e.target);
      if (src) {
        const xStart = (src.x ?? 0) + (src.width ?? 0); // borde derecho (centerY)
        const yStart = (src.y ?? 0) + (src.height ?? 0) / 2;
        pts[0] = { x: xStart, y: yStart };
      }
      if (tgt) {
        const xEnd = tgt.x ?? 0; // borde izquierdo (centerY)
        const yEnd = (tgt.y ?? 0) + (tgt.height ?? 0) / 2;
        pts[pts.length - 1] = { x: xEnd, y: yEnd };
      }

      // 5.3) Si es orthogonal, reconstruir polilínea Manhattan limpia (H→V→H)
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

        // Eje vertical intermedio centrado que evita puntas y diagonales
        const midX = Math.round((sx + ex) / 2);

        pts = [
          { x: sx, y: sy }, // tramo inicial horizontal desde el source
          { x: midX, y: sy }, // codo 1 (H→V)
          { x: midX, y: ey }, // tramo vertical
          { x: ex, y: ey }, // tramo final horizontal al target
        ];
      }

      e.points = pts;
    });

    // ---- Resultado final con posiciones y rutas listas para pintar
    return { nodes: graph.nodes, edges: graph.edges, meta: graph.meta };
  }
}
