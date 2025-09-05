// path: projects/schema/src/lib/schema-layout.service.ts

import { Injectable } from "@angular/core";
import ELK from "elkjs/lib/elk.bundled.js";
import { NormalizedGraph, SchemaOptions, DEFAULT_OPTIONS } from "../models";

@Injectable({ providedIn: "root" })
export class SchemaLayoutService {
  private elk = new ELK();

  async layout(graph: NormalizedGraph, opts: Partial<SchemaOptions> = {}): Promise<NormalizedGraph> {
    const options: SchemaOptions = { ...DEFAULT_OPTIONS, ...opts };

    const elkGraph: any = {
      id: "root",
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.layered.spacing.nodeNodeBetweenLayers": "48",
        "elk.spacing.nodeNode": "32",
        "elk.layered.nodePlacement.bk.fixedAlignment": "BALANCED",
        "elk.edgeRouting": "POLYLINE",
      },
      children: graph.nodes.map((n) => ({
        id: n.id,
        width: n.width ?? options.defaultNodeSize!.width,
        height: n.height ?? options.defaultNodeSize!.height,
        labels: [{ text: n.label }],
      })),
      edges: graph.edges.map((e) => ({
        id: e.id,
        sources: [e.source],
        targets: [e.target],
      })),
    };

    const res = await this.elk.layout(elkGraph);

    // Nota TS: en algunos tipos de ELK, las props vienen por signatura de índice → usar bracket access
    const mapNodes = new Map(graph.nodes.map((n) => [n.id, n]));
    res["children"]?.forEach((c: any) => {
      const node = mapNodes.get(c.id);
      if (node) {
        node.x = c.x ?? 0;
        node.y = c.y ?? 0;
        node.width = c.width ?? options.defaultNodeSize!.width;
        node.height = c.height ?? options.defaultNodeSize!.height;
      }
    });

    const mapEdges = new Map(graph.edges.map((e) => [e.id, e]));
    res["edges"]?.forEach((ee: any) => {
      const e = mapEdges.get(ee.id);
      if (e && ee.sections?.length) {
        const pts: Array<{ x: number; y: number }> = [];
        ee.sections.forEach((s: any) => {
          if (s.startPoint) pts.push({ x: s.startPoint.x, y: s.startPoint.y });
          (s.bendPoints || []).forEach((bp: any) => pts.push({ x: bp.x, y: bp.y }));
          if (s.endPoint) pts.push({ x: s.endPoint.x, y: s.endPoint.y });
        });
        e.points = pts;
      }
    });

    return { nodes: graph.nodes, edges: graph.edges, meta: graph.meta };
  }
}
