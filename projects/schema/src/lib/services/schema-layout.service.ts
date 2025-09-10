import { Injectable } from "@angular/core";
import ELK from "elkjs/lib/elk.bundled.js";
import { NormalizedGraph, SchemaOptions, DEFAULT_OPTIONS } from "../models";

@Injectable({ providedIn: "root" })
export class SchemaLayoutService {
  private elk = new ELK();

  /**
   * Calcula posiciones de nodos y puntos de aristas.
   * - ELK layered + routing ORTHOGONAL.
   * - Flip Y para coords coherentes en SVG/DOM.
   * - Anclaje: source → borde derecho; target → borde izquierdo (centros Y).
   * - "Orthogonal": reconstruye a 4 puntos H→V→H limpios.
   */
  async layout(graph: NormalizedGraph, opts: Partial<SchemaOptions> = {}): Promise<NormalizedGraph> {
    const options: SchemaOptions = { ...DEFAULT_OPTIONS, ...opts };
    const dir = options.layoutDirection ?? "RIGHT";

    const elkGraph: any = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": dir,
        "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
        "elk.layered.nodePlacement.bk.fixedAlignment": options.layoutAlign === "firstChild" ? "LEFTUP" : "BALANCED",
        "elk.layered.spacing.nodeNodeBetweenLayers": "64",
        "elk.spacing.nodeNode": "32",
        "elk.edgeRouting": "ORTHOGONAL",
        "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
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

    // Flip Y
    const childYs: number[] = (res["children"] || []).map((c: any) => c.y ?? 0);
    const edgeYs: number[] = [];
    for (const ee of res["edges"] || []) {
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

    // Mapear nodos
    const mapNodes = new Map(graph.nodes.map((n) => [n.id, n]));
    res["children"]?.forEach((c: any) => {
      const node = mapNodes.get(c.id);
      if (!node) return;
      node.x = c.x ?? 0;
      node.y = flipY(c.y ?? 0);
      node.width = c.width ?? node.width;
      node.height = c.height ?? node.height;
    });

    // Alinear hijos del root (opcional)
    if (options.snapRootChildrenY) {
      const rootId = graph.nodes[0]?.id;
      if (rootId) {
        const childIds = graph.edges.filter((e) => e.source === rootId).map((e) => e.target);
        const children = childIds.map((id) => mapNodes.get(id)).filter(Boolean) as any[];
        if (children.length > 1) {
          const avgCenterY = children.reduce((acc, n) => acc + ((n.y ?? 0) + (n.height ?? 0) / 2), 0) / children.length;
          children.forEach((n) => (n.y = Math.round(avgCenterY - (n.height ?? 0) / 2)));
        }
      }
    }

    // Alinear cadenas 1→1 (opcional)
    if (options.snapChainSegmentsY) {
      const outDeg = new Map<string, number>();
      const inDeg = new Map<string, number>();
      graph.edges.forEach((e) => {
        outDeg.set(e.source, (outDeg.get(e.source) ?? 0) + 1);
        inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
      });
      graph.edges.forEach((e) => {
        if ((outDeg.get(e.source) ?? 0) === 1 && (inDeg.get(e.target) ?? 0) === 1) {
          const src = mapNodes.get(e.source);
          const tgt = mapNodes.get(e.target);
          if (src && tgt) {
            const srcCy = (src.y ?? 0) + (src.height ?? 0) / 2;
            tgt.y = Math.round(srcCy - (tgt.height ?? 0) / 2);
          }
        }
      });
    }

    // Mapear aristas con puntos limpios
    const mapEdges = new Map(graph.edges.map((e) => [e.id, e]));
    res["edges"]?.forEach((ee: any) => {
      const e = mapEdges.get(ee.id);
      if (!e || !ee.sections?.length) return;

      let pts: Array<{ x: number; y: number }> = [];
      ee.sections.forEach((s: any) => {
        if (s.startPoint) pts.push({ x: s.startPoint.x, y: flipY(s.startPoint.y) });
        (s.bendPoints || []).forEach((bp: any) => pts.push({ x: bp.x, y: flipY(bp.y) }));
        if (s.endPoint) pts.push({ x: s.endPoint.x, y: flipY(s.endPoint.y) });
      });
      if (pts.length < 2) {
        e.points = pts;
        return;
      }

      const src = mapNodes.get(e.source);
      const tgt = mapNodes.get(e.target);
      if (src) {
        pts[0] = {
          x: (src.x ?? 0) + (src.width ?? 0),
          y: (src.y ?? 0) + (src.height ?? 0) / 2,
        };
      }
      if (tgt) {
        pts[pts.length - 1] = {
          x: tgt.x ?? 0,
          y: (tgt.y ?? 0) + (tgt.height ?? 0) / 2,
        };
      }

      if ((options.linkStyle ?? "orthogonal") === "orthogonal" && pts.length >= 2) {
        const start = pts[0],
          end = pts[pts.length - 1];
        const midX = Math.round((start.x + end.x) / 2);
        pts = [
          { x: start.x, y: start.y },
          { x: midX, y: start.y },
          { x: midX, y: end.y },
          { x: end.x, y: end.y },
        ];
      }

      e.points = pts;
    });

    return { nodes: graph.nodes, edges: graph.edges, meta: graph.meta };
  }
}
