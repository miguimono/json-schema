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
  withSchemaDefaults,
} from '../../models';

import { SchemaLayoutService } from '../../services/schema-layout.service';
import { JsonAdapterService } from '../../services/json-adapter.service';
import { SchemaCardComponent } from '../schema-card/schema-card.component';
import { SchemaLinksComponent } from '../schema-links/schema-links.component';

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
          <!-- Links en SVG -->
          <svg
            class="schema-links"
            [attr.viewBox]="'0 0 ' + size().width + ' ' + size().height"
            preserveAspectRatio="xMinYMin meet"
          >
            <g
              schema-links
              [edges]="edges()"
              [positions]="positions()"
              [linkStyle]="options().linkStyle || 'orthogonal'"
              [nodeWidth]="NODE_W"
              [nodeHeight]="NODE_H"
              [nodeSizes]="nodeSizeMap()"
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
                [showTitle]="options().showNodeTitle !== false"
                (sizeChange)="onCardSize($event)"
                (cardClick)="nodeClick.emit($event)"
              ></schema-card>
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
        touch-action: none; /* permite pan/zoom con pointer events */
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
  /** Tamaño por defecto de card (fallback mientras se miden alturas reales) */
  readonly NODE_W = 220;
  readonly NODE_H = 84;

  // Inputs
  graph = input<SchemaGraph | null>(null);
  data = input<unknown | null>(null);
  options = input<SchemaOptions>({
    gapX: 300,
    gapY: 140,
    padding: 24,
    linkStyle: 'orthogonal',
    layout: 'tree',
    align: 'firstChild',
    jsonArrayPolicy: 'count',
    jsonAttrMax: 8,
    jsonStringMaxLen: 80,
    jsonTitleKeys: [],
    // Pan & Zoom
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

  // Personalización de links desde el consumidor
  linkStroke = input<string>('#98a1a9');
  linkStrokeWidth = input<number>(2);

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
  private _nodeSizeMap = signal<
    Record<string, { width: number; height: number }>
  >({});

  positions = computed(() => this._positions());
  size = computed(() => this._size());
  nodes = computed(() => this._graph().nodes);
  edges = computed(() => this._graph().edges);
  nodeSizeMap = computed(() => this._nodeSizeMap());

  // Pan & Zoom state
  private _zoom = signal(1);
  private _tx = signal(0);
  private _ty = signal(0);
  private fittedOnce = false;

  transform = computed(
    () => `translate(${this._tx()}px, ${this._ty()}px) scale(${this._zoom()})`
  );

  constructor() {
    // 1) Definir el grafo efectivo (prioriza graph; si no, data JSON)
    effect(
      () => {
        const provided = this.graph();
        const raw = this.data();
        const cfg = withSchemaDefaults(this.options());

        if (provided && provided.nodes?.length) {
          this._graph.set(provided);
        } else if (raw != null) {
          const g = this.jsonAdapter.buildGraphFromJson(raw, cfg);
          this._graph.set(this.filterRootContainers(g, cfg));
        } else {
          this._graph.set({ nodes: [], edges: [] });
        }

        // Al cambiar el graph fuente: reset de medidas por nodo y forzar fit en siguiente layout
        this._nodeSizeMap.set({});
        this.fittedOnce = false;
      },
      { allowSignalWrites: true }
    );

    // 2) Calcular layout (usa medidas reales si ya existen en cada node.size)
    effect(
      () => {
        const g = this._graph();
        const cfg = withSchemaDefaults(this.options());
        const { positions, size } = this.layout.calculateLayout(g, cfg, {
          width: this.NODE_W,
          height: this.NODE_H,
        });
        this._positions.set(positions);
        this._size.set(size);

        // Ajuste inicial (fit) la primera vez que tenemos layout
        queueMicrotask(() => this.tryAutoFit());
      },
      { allowSignalWrites: true }
    );
  }

  ngAfterViewInit(): void {
    this.tryAutoFit();
  }

  // ===== Ocultar raíz contenedora (según opciones) =====
  private filterRootContainers(
    g: SchemaGraph,
    opt: SchemaOptions
  ): SchemaGraph {
    const hideArray = opt.hideRootArrayCard ?? true;
    const hideObject = opt.hideRootObjectCard ?? false;

    const rootCandidates = g.nodes.filter((n) => n.jsonMeta.depth === 0);
    if (rootCandidates.length !== 1) return g;

    const root = rootCandidates[0];
    const isArrayRoot = root.type === 'json-array';
    const isObjectRoot =
      root.type === 'json-object' || root.type === 'json-root';

    let shouldHide = false;
    if (isArrayRoot && hideArray) shouldHide = true;
    if (isObjectRoot && hideObject) {
      const attrs = root.jsonMeta.attributes ?? {};
      const hasAttrs = Object.keys(attrs).length > 0;
      const hasChildren = (root.jsonMeta.children ?? []).length > 0;
      const hasTitle = !!root.jsonMeta.title;
      if (!hasAttrs && !hasChildren && !hasTitle) shouldHide = true;
    }

    if (!shouldHide) return g;

    const removedId = root.id;
    const nodes = g.nodes.filter((n) => n.id !== removedId);
    const edges = g.edges.filter(
      (e) => e.sourceId !== removedId && e.targetId !== removedId
    );
    return { nodes, edges, meta: g.meta };
  }

  // ===== Recibir medidas reales de cada card (P0.1 anti-solapes) =====
  onCardSize(e: { id: string; width: number; height: number }) {
    // 1) guardar tamaño por id (para links)
    const map = { ...this._nodeSizeMap() };
    map[e.id] = { width: e.width, height: e.height };
    this._nodeSizeMap.set(map);

    // 2) actualizar node.size en el grafo para que el layout use medidas reales
    const g = this._graph();
    const idx = g.nodes.findIndex((n) => n.id === e.id);
    if (idx >= 0) {
      const updatedNode: SchemaNode = {
        ...g.nodes[idx],
        size: { width: e.width, height: e.height },
      };
      const newNodes = g.nodes.slice();
      newNodes[idx] = updatedNode;
      this._graph.set({ ...g, nodes: newNodes });
    }
    // El effect de layout reaccionará y recalculará posiciones
  }

  // ===== Pan & Zoom =====
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
    const dir = (ev.deltaY || 0) > 0 ? -1 : 1; // rueda abajo reduce, arriba aumenta
    const z1 = this.clamp(z0 * (1 + dir * step), minZ, maxZ);

    // Zoom centrado en cursor
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

    // No iniciar pan si haces click en una Card o en un path SVG (arista)
    if (target.closest('.card')) return;
    const tag = (target as Element).tagName?.toLowerCase?.() ?? '';
    if (tag === 'path' || target instanceof SVGPathElement) return;

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
      const pad = opt.fitPadding ?? 24;
      this._tx.set(pad);
      this._ty.set(pad);
      this.fittedOnce = true;
    }
  }

  private clamp(n: number, a: number, b: number) {
    return Math.max(a, Math.min(b, n));
  }

  // Trackers
  trackNodeById = (_: number, n: SchemaNode) => n.id;
}
