// projects/schema/src/lib/services/schema-layout.service.ts
// =======================================================
// SchemaLayoutService
// - Calcula posiciones (x,y,width,height) y puntos de aristas.
// - Respeta orden del JSON (jsonMeta.childOrder).
// - Evita solapes entre hermanos y entre nodos de la misma capa.
// - Soporta "pinY" para fijar verticalmente ciertos nodos.
// - Usa SchemaSettings (DEFAULT_SETTINGS) en vez de SchemaOptions/DEFAULT_OPTIONS.
// =======================================================

import { Injectable } from '@angular/core';
import ELK from 'elkjs/lib/elk.bundled.js';
import {
  NormalizedGraph,
  SchemaSettings,
  DEFAULT_SETTINGS,
  SchemaNode,
} from '../models';

@Injectable({ providedIn: 'root' })
export class SchemaLayoutService {
  private elk = new ELK();

  /**
   * Calcula posiciones (x,y,width,height) de nodos y puntos de aristas.
   *
   * Reglas clave:
   * - ELK con `'elk.considerModelOrder' = true` para no reordenar hermanos.
   * - Reorden de hermanos estrictamente por `jsonMeta.childOrder` (orden del JSON).
   * - Respeta múltiples `pinY` por grupo (sin invertir orden).
   * - Paso anti-solape por CAPA (profundidad) para nodos de padres distintos.
   * - "Snaps" opcionales no mueven nodos pineados.
   *
   * @param graph Grafo normalizado (nodos+aristas).
   * @param opts  Settings parciales; se combinan con {@link DEFAULT_SETTINGS} por sección.
   */
  async layout(
    graph: NormalizedGraph,
    opts: Partial<SchemaSettings> = {}
  ): Promise<NormalizedGraph> {
    // ===== Deep-merge ligero por secciones =====
    const settings: Required<SchemaSettings> = {
      colors: { ...DEFAULT_SETTINGS.colors, ...(opts.colors ?? {}) },
      layout: { ...DEFAULT_SETTINGS.layout, ...(opts.layout ?? {}) },
      dataView: { ...DEFAULT_SETTINGS.dataView, ...(opts.dataView ?? {}) },
      messages: { ...DEFAULT_SETTINGS.messages, ...(opts.messages ?? {}) },
      viewport: { ...DEFAULT_SETTINGS.viewport, ...(opts.viewport ?? {}) },
      debug: { ...DEFAULT_SETTINGS.debug, ...(opts.debug ?? {}) },
    };

    const dir = settings.layout.layoutDirection;

    // ---------- 1) Preparación de entrada ELK ----------
    const elkGraph: any = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.direction': dir,
        // Mantener el orden del modelo (orden del JSON en siblings)
        'elk.considerModelOrder': 'true',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.layered.nodePlacement.bk.fixedAlignment':
          settings.layout.layoutAlign === 'firstChild' ? 'LEFTUP' : 'BALANCED',
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

    // ---------- 2) Layout ELK ----------
    const res = await this.elk.layout(elkGraph);

    // ---------- 3) Flip Y a coordenadas "pantalla" ----------
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

    // ---------- 4) Mapear nodos ----------
    const mapNodes = new Map(graph.nodes.map((n) => [n.id, n]));
    res['children']?.forEach((c: any) => {
      const node = mapNodes.get(c.id);
      if (!node) return;
      node.x = c.x ?? 0;
      node.y = flipY(c.y ?? 0);
      node.width = c.width ?? node.width;
      node.height = c.height ?? node.height;
    });

    // ---------- 5) Índices de hijos por padre ----------
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

    // ---------- 6) Pines verticales ----------
    const pinY: Record<string, number> =
      (graph.meta?.['pinY'] as Record<string, number> | undefined) ?? {};

    // ---------- 7) "Snaps" opcionales (no mueven pineados) ----------
    if (settings.layout.snapRootChildrenY) {
      const rootId = graph.nodes[0]?.id;
      if (rootId) {
        const childIds = graph.edges
          .filter((e) => e.source === rootId)
          .map((e) => e.target);
        const children = childIds
          .map((id) => mapNodes.get(id))
          .filter(Boolean) as SchemaNode[];
        if (children.length > 1) {
          const avgCenterY =
            children.reduce(
              (acc, n) => acc + ((n.y ?? 0) + (n.height ?? 0) / 2),
              0
            ) / children.length;
          for (const n of children) {
            if (pinY[n.id!] != null) continue; // no tocar si está pineado
            n.y = Math.round(avgCenterY - (n.height ?? 0) / 2);
          }
        }
      }
    }
    if (settings.layout.snapChainSegmentsY) {
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
            if (pinY[tgt.id!] != null) return; // no tocar si está pineado
            const srcCy = (src.y ?? 0) + (src.height ?? 0) / 2;
            tgt.y = Math.round(srcCy - (tgt.height ?? 0) / 2);
          }
        }
      });
    }

    // ---------- 8) Orden y espaciamiento dentro de CADA grupo de hermanos ----------
    for (const [, childs] of childrenByParent.entries()) {
      if (!childs || childs.length <= 1) continue;

      // Orden del JSON (childOrder ascendente)
      childs.sort((a, b) => {
        const ao = a.jsonMeta?.childOrder ?? Number.POSITIVE_INFINITY;
        const bo = b.jsonMeta?.childOrder ?? Number.POSITIVE_INFINITY;
        return ao - bo;
      });

      // Gap dinámico similar al original
      let sumKids = 0;
      for (const c of childs) sumKids += childrenCountByNode.get(c.id) ?? 0;
      const avgKids = childs.length ? sumKids / childs.length : 0;
      const gap = Math.max(
        32,
        Math.min(80, 32 + Math.round(Math.min(4, Math.max(0, avgKids)) * 12))
      );

      // Posicionamiento: sin inversiones y sin solape.
      // - Pineados: preferencia pinY, pero si rompe orden, se desplaza.
      // - No pineados: se encajan respetando el cursor.
      let cursor = Number.NEGATIVE_INFINITY;
      for (let i = 0; i < childs.length; i++) {
        const n = childs[i];
        const prefTop = pinY[n.id!] != null ? pinY[n.id!]! : n.y ?? 0;
        const top = Math.max(prefTop, cursor);
        n.y = Math.round(top);
        cursor = top + (n.height ?? 0) + gap;
      }
    }

    // ---------- 9) Alineación padre ↔ hijos (no altera orden de hermanos) ----------
    const alignMode = settings.layout.layoutAlign;
    for (const [parentId, childs] of childrenByParent.entries()) {
      if (!childs || childs.length === 0) continue;
      const parent = mapNodes.get(parentId);
      if (!parent) continue;

      let targetCy: number;
      if (alignMode === 'firstChild') {
        const first = [...childs].sort((a, b) => {
          const ao = a.jsonMeta?.childOrder ?? Number.POSITIVE_INFINITY;
          const bo = b.jsonMeta?.childOrder ?? Number.POSITIVE_INFINITY;
          return ao - bo;
        })[0];
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

    // ---------- 10) Anti-solape GLOBAL por CAPA (profundidad) ----------
    // Evita que nodos de padres distintos (pero misma profundidad) se pisen.
    const depth = new Map<string, number>();
    // BFS desde el root para calcular profundidad
    const rootId = graph.nodes[0]?.id;
    if (rootId) {
      depth.set(rootId, 0);
      const adj = new Map<string, string[]>();
      for (const n of graph.nodes) adj.set(n.id, []);
      for (const e of graph.edges) adj.get(e.source)!.push(e.target);

      const q: string[] = [rootId];
      while (q.length) {
        const u = q.shift()!;
        const du = depth.get(u)!;
        for (const v of adj.get(u) || []) {
          if (!depth.has(v)) {
            depth.set(v, du + 1);
            q.push(v);
          }
        }
      }
    }

    // Agrupar por profundidad
    const byDepth = new Map<number, SchemaNode[]>();
    for (const n of graph.nodes) {
      const d = depth.get(n.id) ?? 0;
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d)!.push(n);
    }

    // Empaquetado por capa con gap mínimo global (suave, conserva orden por y)
    const LAYER_GAP = 24; // px
    for (const [, arr] of byDepth.entries()) {
      arr.sort((a, b) => (a.y ?? 0) - (b.y ?? 0)); // conservamos orden visual actual
      let cursor = Number.NEGATIVE_INFINITY;
      for (const n of arr) {
        const top = Math.max(n.y ?? 0, cursor);
        if (top !== (n.y ?? 0)) n.y = Math.round(top);
        cursor = (n.y ?? 0) + (n.height ?? 0) + LAYER_GAP;
      }
    }

    // ---------- 11) Puntos de aristas ----------
    for (const e of graph.edges) {
      const src = mapNodes.get(e.source);
      const tgt = mapNodes.get(e.target);
      if (!src || !tgt) {
        e.points = [];
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

      if (settings.layout.linkStyle === 'orthogonal') {
        const midX = Math.round((start.x + end.x) / 2);
        e.points = [
          { x: start.x, y: start.y },
          { x: midX, y: start.y },
          { x: midX, y: end.y },
          { x: end.x, y: end.y },
        ];
      } else if (settings.layout.linkStyle === 'line') {
        e.points = [start, end];
      } else {
        const dxAbs = Math.abs(end.x - start.x);
        if (dxAbs < (settings.layout.straightThresholdDx ?? 160)) {
          e.points = [start, end];
        } else {
          const t = Math.max(
            20,
            Math.min(200, settings.layout.curveTension ?? 80)
          );
          const dirSign = Math.sign(end.x - start.x) || 1;
          const dy = end.y - start.y;
          let c1x = start.x + dirSign * t,
            c1y = start.y;
          let c2x = end.x - dirSign * t,
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
