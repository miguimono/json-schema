// projects/schema/src/lib/components/schema/schema.component.ts
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  effect,
  signal,
  computed,
  inject,
  input,
  output,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  PositionsMap,
  SchemaEdge,
  SchemaGraph,
  SchemaNode,
  SchemaOptions,
  SchemaSize,
} from '../../models';

import { SchemaLayoutService } from '../../services/schema-layout.service';
import { JsonAdapterService } from '../../services/json-adapter.service';
import { SchemaCardComponent } from '../schema-card/scheme-card.component';
import { SchemaLinksComponent } from '../schema-links/schema-links.component';


type DrawableEdge = { id: string; d: string };

@Component({
  selector: 'schema',
  standalone: true,
  imports: [CommonModule, SchemaCardComponent, SchemaLinksComponent],
  template: `
    <div
      #wrapper
      class="schema-wrapper"
      (wheel)="onWheel($event)"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp($event)"
      (pointercancel)="onPointerUp($event)"
      (pointerleave)="onPointerUp($event)"
      (dblclick)="fitToContent()"
    >
      <div
        class="zoom-layer"
        [style.transform]="transform()"
        [style.transformOrigin]="'0 0'"
      >
        <div
          class="schema-inner"
          [style.width.px]="size().width"
          [style.height.px]="size().height"
        >
          <!-- Links en SVG (unificados) -->
          <svg
            class="schema-links"
            [attr.viewBox]="'0 0 ' + size().width + ' ' + size().height"
            preserveAspectRatio="xMinYMin meet"
          >
            <g
              schema-links
              [edges]="edges()"
              [positions]="positions()"
              [linkStyle]="options().linkStyle === 'curve' ? 'curve' : 'line'"
              [nodeWidth]="NODE_W"
              [nodeHeight]="NODE_H"
              [stroke]="linkStroke()"
              [strokeWidth]="linkStrokeWidth()"
              (linkClick)="linkClick.emit($event)"
            ></g>
          </svg>

          <!-- Cards en overlay HTML -->
          <div class="nodes-overlay">
            <div
              class="node"
              *ngFor="let n of nodes(); trackBy: trackNodeById"
              [style.transform]="
                'translate(' +
                (positions().get(n.id)?.x ?? 0) +
                'px,' +
                (positions().get(n.id)?.y ?? 0) +
                'px)'
              "
            >
              <schema-card
                [node]="n"
                [cardTemplate]="cardTemplate()"
                (cardClick)="nodeClick.emit($event)"
              >
              </schema-card>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .schema-wrapper {
        position: relative;
        width: 100%;
        height: 600px;
        overflow: hidden; /* pan propio; sin scrollbars */
        background: #f7f8fa;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        touch-action: none; /* permite pan/zoom pointer events */
        cursor: default;
      }
      .zoom-layer {
        position: absolute;
        inset: 0;
        cursor: grab;
      }
      .schema-inner {
        position: relative;
      }
      .schema-links {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        display: block;
      }
      .nodes-overlay {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .nodes-overlay .node {
        position: absolute;
        transform-origin: top left;
      }
      .nodes-overlay .card {
        pointer-events: auto;
      }
      .panning {
        cursor: grabbing !important;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaComponent implements AfterViewInit {
  readonly NODE_W = 220;
  readonly NODE_H = 84;

  // Inputs
  graph = input<SchemaGraph | null>(null);
  data = input<unknown | null>(null);
  // Personalización de links desde el consumidor
  linkStroke = input<string>('#98a1a9');
  linkStrokeWidth = input<number>(2);
  options = input<SchemaOptions>({
    gapX: 300,
    gapY: 140,
    padding: 24,
    linkStyle: 'curve',
    layout: 'tree',
    align: 'firstChild',
    jsonArrayPolicy: 'count',
    jsonAttrMax: 8,
    jsonStringMaxLen: 80,
    // MODO GENÉRICO por defecto: sin claves de dominio
    jsonTitleKeys: [],
    // Pan & Zoom defaults
    panZoomEnabled: true,
    zoomMin: 0.25,
    zoomMax: 2,
    zoomStep: 0.1,
    initialZoom: 'fit',
    fitPadding: 24,
    hideRootArrayCard: true,
    hideRootObjectCard: false,
  });
  cardTemplate = input<TemplateRef<any> | null>(null);

  // Outputs
  nodeClick = output<SchemaNode>();
  linkClick = output<SchemaEdge>();

  // Services
  private readonly layout = inject(SchemaLayoutService);
  private readonly jsonAdapter = inject(JsonAdapterService);

  // View refs
  @ViewChild('wrapper', { static: true })
  wrapperRef!: ElementRef<HTMLDivElement>;

  // State
  private _positions = signal<PositionsMap>(new Map());
  private _size = signal<SchemaSize>({ width: 800, height: 600 });
  private _graph = signal<SchemaGraph>({ nodes: [], edges: [] });

  positions = computed(() => this._positions());
  size = computed(() => this._size());
  nodes = computed(() => this._graph().nodes);
  edges = computed(() => this._graph().edges);

  // Pan & Zoom state
  private _zoom = signal(1);
  private _tx = signal(0);
  private _ty = signal(0);
  private fittedOnce = false;

  transform = computed(
    () => `translate(${this._tx()}px, ${this._ty()}px) scale(${this._zoom()})`
  );

  constructor() {
    // 1) Definir el graph efectivo (prioriza graph; si no, data JSON) + Poda anti-fantasmas
    effect(
      () => {
        const providedGraph = this.graph();
        const raw = this.data();

        if (providedGraph && providedGraph.nodes?.length) {
          this._graph.set(providedGraph);
        } else if (raw != null) {
          const opt = this.options();
          const g0 = this.jsonAdapter.buildGraphFromJson(raw, opt);
          const g = this.filterRootContainers(g0, opt);
          this._graph.set(g);
        } else {
          this._graph.set({ nodes: [], edges: [] });
        }

        // Al cambiar el graph, haremos fit on next layout
        this.fittedOnce = false;
      },
      { allowSignalWrites: true }
    );

    // 2) Calcular layout
    effect(
      () => {
        const g = this._graph();
        const opt = this.options();
        const res =
          opt.layout === 'level'
            ? this.layout.layoutLevel(g, opt, {
                w: this.NODE_W,
                h: this.NODE_H,
              })
            : this.layout.layoutTree(g, opt, {
                w: this.NODE_W,
                h: this.NODE_H,
              });
        this._positions.set(res.positions);
        this._size.set(res.size);
        // Si aún no hicimos fit y está habilitado, ajustamos
        queueMicrotask(() => this.tryAutoFit());
      },
      { allowSignalWrites: true }
    );
  }

  ngAfterViewInit(): void {
    this.tryAutoFit(); // por si layout ya estaba listo
  }

  // ===== PODA ANTI‑FANTASMAS =====
  /**
   * Elimina nodos vacíos (sin atributos, sin arrays y sin hijos).
   * Conserva nodos 'value' y cualquier nodo con hijos.
   */
  private pruneEmpty(g: SchemaGraph): SchemaGraph {
    const hasChild = new Map<string, boolean>();
    for (const n of g.nodes) hasChild.set(n.id, false);
    for (const e of g.edges) hasChild.set(e.sourceId, true);

    const keep = (n: SchemaNode) => {
      const kind = n.jsonMeta?.kind;
      if (kind === 'value') return true; // siempre conservar valores
      const attrs = n.jsonMeta?.attributes;
      const arrays = n.jsonMeta?.arrays;
      const hasAttrs = !!attrs && Object.keys(attrs).length > 0;
      const hasArrays = !!arrays && Object.keys(arrays).length > 0;
      const child = !!hasChild.get(n.id);
      return hasAttrs || hasArrays || child;
    };

    const keptNodes = g.nodes.filter(keep);
    const keptIds = new Set(keptNodes.map((n) => n.id));
    const keptEdges = g.edges.filter(
      (e) => keptIds.has(e.sourceId) && keptIds.has(e.targetId)
    );
    return { nodes: keptNodes, edges: keptEdges };
  }

  /** Elimina el nodo raíz contenedor si el JSON es [] o {} (configurable por opciones) */
  private filterRootContainers(
    g: SchemaGraph,
    opt: SchemaOptions
  ): SchemaGraph {
    // Un nodo "raíz contenedor" es el que tiene rank 0 y level json-array u json-object
    const isRootContainer = (n: SchemaNode) => {
      const isRootRank = (n.rank ?? 0) === 0;
      if (!isRootRank) return false;

      if (n.level === 'json-array' && (opt.hideRootArrayCard ?? true))
        return true;

      if (n.level === 'json-object' && (opt.hideRootObjectCard ?? false)) {
        // solo considera "vacío" si no tiene atributos ni arrays ni título útil
        const hasAttrs =
          !!n.jsonMeta?.attributes &&
          Object.keys(n.jsonMeta!.attributes!).length > 0;
        const hasArrays =
          !!n.jsonMeta?.arrays && Object.keys(n.jsonMeta!.arrays!).length > 0;
        const hasTitle = !!n.jsonMeta?.title;
        return !hasAttrs && !hasArrays && !hasTitle;
      }

      return false;
    };

    const removed = new Set<string>();
    for (const n of g.nodes) if (isRootContainer(n)) removed.add(n.id);
    if (removed.size === 0) return g;

    const nodes = g.nodes.filter((n) => !removed.has(n.id));
    const edges = g.edges.filter(
      (e) => !removed.has(e.sourceId) && !removed.has(e.targetId)
    );
    return { nodes, edges };
  }

  // ===== Pan & Zoom handlers =====

  private panning = false;
  private lastX = 0;
  private lastY = 0;
  private activePointerId: number | null = null;

  onWheel(ev: WheelEvent) {
    if (!this.options().panZoomEnabled) return;
    ev.preventDefault();

    const wrapper = this.wrapperRef.nativeElement;
    const rect = wrapper.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const py = ev.clientY - rect.top;

    const step = this.options().zoomStep ?? 0.1;
    const minZ = this.options().zoomMin ?? 0.25;
    const maxZ = this.options().zoomMax ?? 2;

    const z0 = this._zoom();
    const dir = (ev.deltaY || 0) > 0 ? -1 : 1; // rueda hacia abajo reduce, hacia arriba aumenta
    const z1 = this.clamp(z0 * (1 + dir * step), minZ, maxZ);

    // Zoom centrado en cursor: mantener el “mundo” bajo el cursor fijo.
    const tx0 = this._tx(),
      ty0 = this._ty();
    const worldX = (px - tx0) / z0;
    const worldY = (py - ty0) / z0;

    const tx1 = px - worldX * z1;
    const ty1 = py - worldY * z1;

    this._zoom.set(z1);
    this._tx.set(tx1);
    this._ty.set(ty1);
  }

  onPointerDown(ev: PointerEvent) {
    if (!this.options().panZoomEnabled) return;

    const target = ev.target as Element;

    // 1) No iniciar pan si haces click en una Card
    if (target.closest('.card')) return;

    // 2) No iniciar pan si haces click en una arista (path SVG)
    const tag = (target as Element).tagName?.toLowerCase?.() ?? '';
    if (tag === 'path' || target instanceof SVGPathElement) return;

    // 3) Iniciar pan
    this.panning = true;
    this.activePointerId = ev.pointerId;
    this.wrapperRef.nativeElement.classList.add('panning');
    this.lastX = ev.clientX;
    this.lastY = ev.clientY;
    (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
  }

  onPointerMove(ev: PointerEvent) {
    if (!this.panning || this.activePointerId !== ev.pointerId) return;
    const dx = ev.clientX - this.lastX;
    const dy = ev.clientY - this.lastY;
    this.lastX = ev.clientX;
    this.lastY = ev.clientY;
    this._tx.set(this._tx() + dx);
    this._ty.set(this._ty() + dy);
  }

  onPointerUp(ev: PointerEvent) {
    if (this.activePointerId !== null && ev.pointerId !== this.activePointerId)
      return;
    this.panning = false;
    this.activePointerId = null;
    this.wrapperRef.nativeElement.classList.remove('panning');
    (ev.currentTarget as Element).releasePointerCapture?.(ev.pointerId);
  }

  fitToContent() {
    const wrapper = this.wrapperRef.nativeElement;
    const rect = wrapper.getBoundingClientRect();
    const pad = this.options().fitPadding ?? 24;

    const contentW = Math.max(1, this.size().width);
    const contentH = Math.max(1, this.size().height);

    const scaleX = (rect.width - pad * 2) / contentW;
    const scaleY = (rect.height - pad * 2) / contentH;
    const minZ = this.options().zoomMin ?? 0.25;
    const maxZ = this.options().zoomMax ?? 2;
    const z = this.clamp(Math.min(scaleX, scaleY), minZ, maxZ);

    const tx = (rect.width - contentW * z) / 2;
    const ty = (rect.height - contentH * z) / 2;

    this._zoom.set(z);
    this._tx.set(tx);
    this._ty.set(ty);
  }

  private tryAutoFit() {
    if (this.fittedOnce) return;
    const opt = this.options();
    if (opt.initialZoom === 'fit' || opt.initialZoom == null) {
      this.fitToContent();
      this.fittedOnce = true;
    } else if (typeof opt.initialZoom === 'number') {
      const z = this.clamp(
        opt.initialZoom,
        opt.zoomMin ?? 0.25,
        opt.zoomMax ?? 2
      );
      this._zoom.set(z);
      // centra a ojo en 0,0 + padding
      const pad = opt.fitPadding ?? 24;
      this._tx.set(pad);
      this._ty.set(pad);
      this.fittedOnce = true;
    }
  }

  private clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
  }

  // Helpers existentes
  onEdgeClick = (edgeId: string) => {
    const e = this._graph().edges.find((x) => x.id === edgeId);
    if (e) this.linkClick.emit(e);
  };
  trackNodeById = (_: number, n: SchemaNode) => n.id;
  trackPathById = (_: number, it: DrawableEdge) => it.id;
}
