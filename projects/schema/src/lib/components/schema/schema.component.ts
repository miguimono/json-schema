import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  OnChanges,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  input,
  signal,
  computed,
} from '@angular/core';
import { JsonAdapterService } from '../../services/json-adapter.service';
import { SchemaLayoutService } from '../../services/schema-layout.service';
import {
  DEFAULT_OPTIONS,
  NormalizedGraph,
  SchemaEdge,
  SchemaNode,
  SchemaOptions,
} from '../../models';
import { CommonModule, NgFor } from '@angular/common';
import { SchemaCardComponent } from '../schema-card/schema-card.component';
import { SchemaLinksComponent } from '../schema-links/schema-links.component';

@Component({
  selector: 'schema',
  standalone: true,
  imports: [CommonModule, NgFor, SchemaCardComponent, SchemaLinksComponent],
  template: `
    <div
      class="schema-root"
      #root
      (wheel)="onWheel($event)"
      (mousedown)="onPointerDown($event)"
      (mousemove)="onPointerMove($event)"
      (mouseup)="onPointerUp()"
      (mouseleave)="onPointerUp()"
      (dblclick)="onDblClick()"
    >
      <div class="overlay loading" *ngIf="isLoading()">
        <div class="loading-banner">
          <div class="shimmer"></div>
          <span class="msg">{{ loadingMessage() }}</span>
        </div>
      </div>

      <div class="overlay empty" *ngIf="!isLoading() && data() == null">
        <div class="empty-banner">{{ emptyMessage() }}</div>
      </div>

      <div class="overlay error" *ngIf="!isLoading() && isError()">
        <div class="error-banner">
          {{ errorMessage() }}
        </div>
      </div>

      <div
        class="stage"
        [style.transform]="transform()"
        *ngIf="!isLoading() && !isError()"
      >
        <schema-links
          [edges]="edges()"
          [linkStroke]="linkStroke()"
          [linkStrokeWidth]="linkStrokeWidth()"
          [options]="options()"
          (linkClick)="linkClick.emit($event)"
          [width]="virtualWidth"
          [height]="virtualHeight"
        ></schema-links>

        <ng-container *ngFor="let n of nodes()">
          <schema-card
            [node]="n"
            [options]="options()"
            [cardTemplate]="cardTemplate()"
            (nodeClick)="nodeClick.emit($event)"
          ></schema-card>
        </ng-container>
      </div>
    </div>
  `,
  styles: [
    `
      .schema-root {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #f7f9fb;
        border-radius: 8px;
      }
      .stage {
        position: absolute;
        left: 0;
        top: 0;
        width: 12000px; /* amplio para cards largas */
        height: 6000px;
        transform-origin: 0 0;
      }
      /* ===== Overlays ===== */
      .overlay {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        z-index: 10; /* por encima del stage */
        pointer-events: none; /* no bloquear scroll/zoom, solo visual */
      }
      .loading-banner,
      .empty-banner,
      .error-banner {
        pointer-events: auto;
        border-radius: 10px;
        padding: 16px 20px;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
        font-weight: 600;
      }

      /* Loading */
      .loading .loading-banner {
        width: min(720px, 90%);
        background: #eee;
        position: relative;
        overflow: hidden;
        color: #374151;
      }
      .loading .msg {
        position: relative;
        z-index: 1;
      }
      .loading .shimmer {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          to right,
          #e0e0e0 8%,
          #f0f0f0 18%,
          #e0e0e0 33%
        );
        background-size: 1000px 100%;
        animation: shimmer 3s infinite linear;
        opacity: 0.9;
      }
      @keyframes shimmer {
        0% {
          background-position: -1000px 0;
        }
        100% {
          background-position: 1000px 0;
        }
      }

      /* Empty */
      .empty .empty-banner {
        background: #ffffff;
        border: 1px dashed #cbd5e1;
        color: #475569;
      }

      /* Error */
      .error .error-banner {
        background: #fff1f2;
        border: 1px solid #fecdd3;
        color: #b91c1c;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaComponent implements AfterViewInit, OnChanges {
  // ===========================
  // Inputs
  // ===========================

  data = input<any>();
  options = input<SchemaOptions>(DEFAULT_OPTIONS);
  linkStroke = input<string>(DEFAULT_OPTIONS.linkStroke!);
  linkStrokeWidth = input<number>(DEFAULT_OPTIONS.linkStrokeWidth!);
  cardTemplate = input<TemplateRef<any> | null>(null);
  isLoading = input<boolean>(false);
  isError = input<boolean>(false);
  emptyMessage = input<string>('No hay datos para mostrar');
  loadingMessage = input<string>('Cargando…');
  errorMessage = input<string>('Error al cargar el esquema');

  // ===========================
  // Outputs
  // ===========================
  @Output() nodeClick = new EventEmitter<SchemaNode>();
  @Output() linkClick = new EventEmitter<SchemaEdge>();

  // ===========================
  // Estado
  // ===========================
  private graph = signal<NormalizedGraph>({ nodes: [], edges: [] });
  nodes = computed(() => this.graph().nodes);
  edges = computed(() => this.graph().edges);

  @ViewChild('root', { static: true }) rootRef!: ElementRef<HTMLElement>;

  private scale = signal(1);
  private minScale = signal(0.2);
  private maxScale = signal(3);
  private tx = signal(0);
  private ty = signal(0);
  transform = computed(
    () => `translate(${this.tx()}px, ${this.ty()}px) scale(${this.scale()})`
  );

  virtualWidth = 12000;
  virtualHeight = 6000;

  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(
    private adapter: JsonAdapterService,
    private layoutService: SchemaLayoutService
  ) {}

  // ===========================
  // Ciclo de vida
  // ===========================
  ngAfterViewInit(): void {
    this.compute();
  }
  ngOnChanges(_: SimpleChanges): void {
    this.compute();
  }

  // ===========================
  // Helpers internos
  // ===========================
  private cloneGraph(g: NormalizedGraph): NormalizedGraph {
    return {
      nodes: g.nodes.map((n) => ({ ...n })),
      edges: g.edges.map((e) => ({ ...e })),
      meta: { ...(g.meta ?? {}) },
    };
  }
  private nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  // ===========================
  // Pipeline principal
  // ===========================
  private async compute(): Promise<void> {
    if (this.isLoading()) return;
    console.log('SchemaComponent: compute()', this.isLoading());
    const opts = this.options();
    const dbg = !!opts.debug?.measure;

    // 1) normalizar + primer layout
    const normalized = this.adapter.normalize(this.data(), opts);
    let laid = await this.layoutService.layout(normalized, opts);
    this.graph.set(this.cloneGraph(laid));

    if (!opts.autoResizeCards) {
      this.fitToView();
      return;
    }

    // 2) medir → relayout hasta estabilizar
    const maxPasses = 6;
    for (let pass = 1; pass <= maxPasses; pass++) {
      await this.nextFrame();
      const changed = this.measureAndApply(pass, dbg);
      if (dbg) {
        console.log(`[measure] pass #${pass} — changed:`, changed);
      }
      if (!changed) break;

      laid = await this.layoutService.layout(this.graph(), opts);
      if (opts.debug?.layout) console.log(`[layout] relayout pass #${pass}`);
      this.graph.set(this.cloneGraph(laid));
    }

    // 3) ajuste de encuadre
    this.fitToView();

    // debug opcional
    if (opts.debug?.exposeOnWindow) {
      (window as any).schemaDebug = {
        get graph() {
          return structuredClone(laid);
        },
        options: opts,
      };
      console.log('schemaDebug expuesto en window.schemaDebug');
    }
  }

  /** Mide .schema-card y aplica cambio de width/height con colchón extra. */
  private measureAndApply(pass: number, log = false): boolean {
    const opts = this.options();
    const extraW = opts.measureExtraWidthPx ?? 0;
    const extraH = opts.measureExtraHeightPx ?? 0;

    const root = this.rootRef.nativeElement;
    const cards = Array.from(
      root.querySelectorAll<HTMLElement>('.schema-card')
    );

    const map = new Map(this.graph().nodes.map((n) => [n.id, n]));
    let changed = false;

    const rows: any[] = [];

    for (const el of cards) {
      const id = el.getAttribute('data-node-id') ?? undefined;
      const node = (id ? map.get(id) : undefined) ?? null;
      if (!node) continue;

      // scrollWidth/scrollHeight ya incluyen padding y borde
      const w = Math.ceil(el.scrollWidth + extraW);
      const h = Math.ceil(el.scrollHeight + extraH);

      // respetar maxCardWidth/Height si están definidos
      const maxW = this.options().maxCardWidth ?? Infinity;
      const maxH = this.options().maxCardHeight ?? Infinity;
      const cw = Math.min(w, maxW);
      const ch = Math.min(h, maxH);

      if ((node.width ?? 0) !== cw || (node.height ?? 0) !== ch) {
        node.width = cw;
        node.height = ch;
        changed = true;
      }

      if (log) {
        rows.push({
          pass,
          id: node.id,
          scrollW: el.scrollWidth,
          scrollH: el.scrollHeight,
          extraW,
          extraH,
          setW: cw,
          setH: ch,
        });
      }
    }

    if (log && rows.length) console.table(rows);
    return changed;
  }

  // ===========================
  // Viewport / encuadre
  // ===========================
  private getViewportSize() {
    const el = this.rootRef.nativeElement;
    const rect = el.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }
  private getGraphBounds() {
    const ns = this.nodes();
    if (!ns.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const n of ns) {
      minX = Math.min(minX, n.x ?? 0);
      minY = Math.min(minY, n.y ?? 0);
      maxX = Math.max(maxX, (n.x ?? 0) + (n.width ?? 0));
      maxY = Math.max(maxY, (n.y ?? 0) + (n.height ?? 0));
    }
    return { minX, minY, maxX, maxY };
  }
  private fitToView() {
    const { w, h } = this.getViewportSize();
    const { minX, minY, maxX, maxY } = this.getGraphBounds();
    const gw = Math.max(1, maxX - minX);
    const gh = Math.max(1, maxY - minY);
    const pad = 24;

    const sx = (w - pad) / gw;
    const sy = (h - pad) / gh;
    const s = Math.max(0.05, Math.min(sx, sy));

    this.minScale.set(Math.min(s, 1));
    this.scale.set(Math.max(this.scale(), this.minScale()));

    const first = this.nodes()[0];
    if (first) {
      const targetX = pad - (first.x ?? 0) * this.scale();
      const targetY = pad - (first.y ?? 0) * this.scale();
      this.tx.set(targetX);
      this.ty.set(targetY);
    }
  }

  // ===========================
  // Interacción (zoom/pan/centrado)
  // ===========================
  onWheel(e: WheelEvent) {
    e.preventDefault();
    const root = this.rootRef.nativeElement;
    const rect = root.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const oldScale = this.scale();
    const factor = 1 + (-e.deltaY > 0 ? 0.08 : -0.08);
    const newScale = Math.max(
      this.minScale(),
      Math.min(this.maxScale(), oldScale * factor)
    );

    const worldX = (mouseX - this.tx()) / oldScale;
    const worldY = (mouseY - this.ty()) / oldScale;
    this.tx.set(mouseX - worldX * newScale);
    this.ty.set(mouseY - worldY * newScale);
    this.scale.set(newScale);
  }
  onPointerDown(e: MouseEvent) {
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }
  onPointerMove(e: MouseEvent) {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.tx.set(this.tx() + dx);
    this.ty.set(this.ty() + dy);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }
  onPointerUp() {
    this.dragging = false;
  }
  onDblClick() {
    const first = this.nodes()[0];
    if (!first) return;
    const pad = 24;
    const s = this.scale();
    const targetX = pad - (first.x ?? 0) * s;
    const targetY = pad - (first.y ?? 0) * s;
    this.tx.set(targetX);
    this.ty.set(targetY);
  }

  // API para toolbar externo (zoom/reset)
  zoomIn() {
    this.applyZoom(1.15);
  }
  zoomOut() {
    this.applyZoom(1 / 1.15);
  }
  resetView() {
    this.fitToView();
  }

  private applyZoom(factor: number) {
    const root = this.rootRef.nativeElement;
    const rect = root.getBoundingClientRect();
    const mouseX = rect.width / 2;
    const mouseY = rect.height / 2;

    const oldScale = this.scale();
    const newScale = Math.max(
      this.minScale(),
      Math.min(this.maxScale(), oldScale * factor)
    );

    const worldX = (mouseX - this.tx()) / oldScale;
    const worldY = (mouseY - this.ty()) / oldScale;
    this.tx.set(mouseX - worldX * newScale);
    this.ty.set(mouseY - worldY * newScale);
    this.scale.set(newScale);
  }
}
