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
import { JsonAdapterService } from '../services/json-adapter.service';
import { SchemaLayoutService } from '../services/schema-layout.service';
import {
  DEFAULT_OPTIONS,
  NormalizedGraph,
  SchemaEdge,
  SchemaNode,
  SchemaOptions,
  SchemaSettings,
} from '../models';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { SchemaCardComponent } from './schema-card.component';
import { SchemaLinksComponent } from './schema-links.component';

@Component({
  selector: 'schema',
  standalone: true,
  imports: [
    CommonModule,
    NgFor,
    NgIf,
    SchemaCardComponent,
    SchemaLinksComponent,
  ],
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
      [style.height.px]="viewportHeight()"
      [style.minHeight.px]="minViewportHeight()"
    >
      <!-- ===== Toolbar integrada (opcional) ===== -->
      <div
        class="schema-toolbar"
        *ngIf="showToolbar() && !isLoadingView() && !isErrorView()"
      >
        <div class="left">
          <button type="button" (click)="zoomOut()" title="Zoom out">−</button>
          <button type="button" (click)="zoomIn()" title="Zoom in">+</button>
          <button type="button" (click)="resetView()" title="Centrar">⤾</button>
        </div>

        <div class="right">
          <label>
            Enlaces:
            <select
              #ls
              [value]="opt_linkStyle()"
              (change)="setLinkStyle(ls.value)"
            >
              <option value="orthogonal">Ortogonal</option>
              <option value="curve">Curvo</option>
              <option value="line">Lineal</option>
            </select>
          </label>

          <label>
            Alineación:
            <select
              #la
              [value]="opt_layoutAlign()"
              (change)="setLayoutAlign(la.value)"
            >
              <option value="firstChild">Superior</option>
              <option value="center">Centrado</option>
            </select>
          </label>
        </div>
      </div>

      <!-- ===== Overlays ===== -->
      <div class="overlay loading" *ngIf="isLoadingView()">
        <div class="loading-banner">
          <div class="shimmer"></div>
          <span class="msg">{{ loadingMessageView() }}</span>
        </div>
      </div>

      <div class="overlay empty" *ngIf="!isLoadingView() && data() == null">
        <div class="empty-banner">{{ emptyMessageView() }}</div>
      </div>

      <div class="overlay error" *ngIf="!isLoadingView() && isErrorView()">
        <div class="error-banner">
          {{ errorMessageView() }}
        </div>
      </div>

      <!-- ===== Stage ===== -->
      <div
        class="stage"
        [style.transform]="transform()"
        *ngIf="!isLoadingView() && !isErrorView()"
      >
        <schema-links
          [edges]="edges()"
          [options]="effectiveOptions()"
          (linkClick)="linkClick.emit($event)"
          [width]="virtualWidth"
          [height]="virtualHeight"
        ></schema-links>

        <ng-container *ngFor="let n of nodes()">
          <schema-card
            [node]="n"
            [options]="effectiveOptions()"
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
        overflow: hidden;
        background: #f7f9fb;
        border-radius: 8px;
      }
      .schema-toolbar {
        position: absolute;
        inset: 12px 12px auto 12px;
        z-index: 20;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid rgba(0, 0, 0, 0.06);
        border-radius: 10px;
        padding: 6px 10px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      }
      .schema-toolbar button {
        min-width: 32px;
        height: 32px;
        border-radius: 8px;
        border: 1px solid rgba(0, 0, 0, 0.12);
        background: #f7f9fb;
        font-weight: 600;
        line-height: 1;
        cursor: pointer;
      }
      .schema-toolbar select {
        height: 28px;
        border-radius: 6px;
        border: 1px solid rgba(0, 0, 0, 0.12);
        background: #f9fafb;
        padding: 0 6px;
        cursor: pointer;
      }
      .schema-toolbar .left,
      .schema-toolbar .right {
        display: inline-flex;
        gap: 8px;
        align-items: center;
      }

      .stage {
        position: absolute;
        left: 0;
        top: 0;
        width: 12000px;
        height: 6000px;
        transform-origin: 0 0;
      }
      /* Overlays */
      .overlay {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        z-index: 10;
        pointer-events: none;
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
      .empty .empty-banner {
        background: #ffffff;
        border: 1px dashed #cbd5e1;
        color: #475569;
      }
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
  // ===== Inputs mínimos =====
  data = input<any>(); // único obligatorio

  /** Nuevo: settings organizados por secciones (recomendado). */
  settings = input<SchemaSettings | null>(null);

  /** Back-compat: opciones planas de antes (opcional). */
  options = input<SchemaOptions>(DEFAULT_OPTIONS);

  /** Template de card custom (opcional). */
  cardTemplate = input<TemplateRef<any> | null>(null);

  // Mensajes/estados (pueden venir por settings.messages también)
  isLoading = input<boolean>(false);
  isError = input<boolean>(false);
  emptyMessage = input<string>('No hay datos para mostrar');
  loadingMessage = input<string>('Cargando…');
  errorMessage = input<string>('Error al cargar el esquema');

  // Viewport (pueden venir por settings.viewport)
  viewportHeight = signal<number>(800);
  minViewportHeight = signal<number>(480);
  showToolbar = signal<boolean>(true);

  // ===== Outputs =====
  @Output() nodeClick = new EventEmitter<SchemaNode>();
  @Output() linkClick = new EventEmitter<SchemaEdge>();

  // ===== Estado =====
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

  // Controles de toolbar (valores actuales)
  opt_linkStyle = signal<'orthogonal' | 'curve' | 'line'>('orthogonal');
  opt_layoutAlign = signal<'firstChild' | 'center'>('center');

  // ======= Derivados (no escribimos sobre inputs) =======
  isLoadingView = computed(
    () => this.settings()?.messages?.isLoading ?? this.isLoading()
  );
  isErrorView = computed(
    () => this.settings()?.messages?.isError ?? this.isError()
  );
  emptyMessageView = computed(
    () => this.settings()?.messages?.emptyMessage ?? this.emptyMessage()
  );
  loadingMessageView = computed(
    () => this.settings()?.messages?.loadingMessage ?? this.loadingMessage()
  );
  errorMessageView = computed(
    () => this.settings()?.messages?.errorMessage ?? this.errorMessage()
  );

  constructor(
    private adapter: JsonAdapterService,
    private layoutService: SchemaLayoutService
  ) {}

  // ===== Merge de settings → options + UI =====
  private recomputeEffectiveSettings(): void {
    const s = this.settings() ?? {};
    // viewport únicamente (no tocamos inputs de mensajes)
    if (s.viewport) {
      this.viewportHeight.set(s.viewport.height ?? 800);
      this.minViewportHeight.set(s.viewport.minHeight ?? 480);
      this.showToolbar.set(s.viewport.showToolbar ?? true);
    } else {
      this.viewportHeight.set(800);
      this.minViewportHeight.set(480);
      this.showToolbar.set(true);
    }
    // toolbar selectors
    const base = this.effectiveOptions();
    this.opt_linkStyle.set(base.linkStyle ?? 'orthogonal');
    this.opt_layoutAlign.set(base.layoutAlign ?? 'center');
  }

  /** Combina DEFAULT_OPTIONS + options (back-compat) + settings.{colors,layout,dataView,debug} */
  effectiveOptions = computed<SchemaOptions>(() => {
    const flat = this.options() ?? DEFAULT_OPTIONS;
    const s = this.settings() ?? {};
    const merged: SchemaOptions = {
      ...DEFAULT_OPTIONS,
      ...flat,
      // colors
      linkStroke:
        s.colors?.linkStroke ?? flat.linkStroke ?? DEFAULT_OPTIONS.linkStroke,
      linkStrokeWidth:
        s.colors?.linkStrokeWidth ??
        flat.linkStrokeWidth ??
        DEFAULT_OPTIONS.linkStrokeWidth,
      accentByKey:
        s.colors?.accentByKey ??
        flat.accentByKey ??
        DEFAULT_OPTIONS.accentByKey,
      accentFill:
        s.colors?.accentFill ?? flat.accentFill ?? DEFAULT_OPTIONS.accentFill,
      accentInverse:
        s.colors?.accentInverse ??
        flat.accentInverse ??
        DEFAULT_OPTIONS.accentInverse,
      showColorTrue:
        s.colors?.showColorTrue ??
        flat.showColorTrue ??
        DEFAULT_OPTIONS.showColorTrue,
      showColorFalse:
        s.colors?.showColorFalse ??
        flat.showColorFalse ??
        DEFAULT_OPTIONS.showColorFalse,
      // layout vis
      layoutDirection:
        s.layout?.layoutDirection ??
        flat.layoutDirection ??
        DEFAULT_OPTIONS.layoutDirection,
      layoutAlign: s.layout?.layoutAlign ?? this.opt_layoutAlign(),
      linkStyle: s.layout?.linkStyle ?? this.opt_linkStyle(),
      curveTension:
        s.layout?.curveTension ??
        flat.curveTension ??
        DEFAULT_OPTIONS.curveTension,
      straightThresholdDx:
        s.layout?.straightThresholdDx ??
        flat.straightThresholdDx ??
        DEFAULT_OPTIONS.straightThresholdDx,
      snapRootChildrenY:
        s.layout?.snapRootChildrenY ??
        flat.snapRootChildrenY ??
        DEFAULT_OPTIONS.snapRootChildrenY,
      snapChainSegmentsY:
        s.layout?.snapChainSegmentsY ??
        flat.snapChainSegmentsY ??
        DEFAULT_OPTIONS.snapChainSegmentsY,
      // dataview
      titleKeyPriority:
        s.dataView?.titleKeyPriority ??
        flat.titleKeyPriority ??
        DEFAULT_OPTIONS.titleKeyPriority,
      hiddenKeysGlobal:
        s.dataView?.hiddenKeysGlobal ??
        flat.hiddenKeysGlobal ??
        DEFAULT_OPTIONS.hiddenKeysGlobal,
      titleMode:
        s.dataView?.titleMode ?? flat.titleMode ?? DEFAULT_OPTIONS.titleMode,
      previewMaxKeys:
        s.dataView?.previewMaxKeys ??
        flat.previewMaxKeys ??
        DEFAULT_OPTIONS.previewMaxKeys,
      treatScalarArraysAsAttribute:
        s.dataView?.treatScalarArraysAsAttribute ??
        flat.treatScalarArraysAsAttribute ??
        DEFAULT_OPTIONS.treatScalarArraysAsAttribute,
      collapseArrayContainers:
        s.dataView?.collapseArrayContainers ??
        flat.collapseArrayContainers ??
        DEFAULT_OPTIONS.collapseArrayContainers,
      collapseSingleChildWrappers:
        s.dataView?.collapseSingleChildWrappers ??
        flat.collapseSingleChildWrappers ??
        DEFAULT_OPTIONS.collapseSingleChildWrappers,
      maxDepth:
        s.dataView?.maxDepth ?? flat.maxDepth ?? DEFAULT_OPTIONS.maxDepth,
      defaultNodeSize:
        s.dataView?.defaultNodeSize ??
        flat.defaultNodeSize ??
        DEFAULT_OPTIONS.defaultNodeSize,
      noWrapKeys:
        s.dataView?.noWrapKeys ?? flat.noWrapKeys ?? DEFAULT_OPTIONS.noWrapKeys,
      maxCardWidth:
        s.dataView?.maxCardWidth ??
        flat.maxCardWidth ??
        DEFAULT_OPTIONS.maxCardWidth,
      maxCardHeight:
        s.dataView?.maxCardHeight ??
        flat.maxCardHeight ??
        DEFAULT_OPTIONS.maxCardHeight,
      autoResizeCards:
        s.dataView?.autoResizeCards ??
        flat.autoResizeCards ??
        DEFAULT_OPTIONS.autoResizeCards,
      measureExtraWidthPx:
        s.dataView?.measureExtraWidthPx ??
        flat.measureExtraWidthPx ??
        DEFAULT_OPTIONS.measureExtraWidthPx,
      measureExtraHeightPx:
        s.dataView?.measureExtraHeightPx ??
        flat.measureExtraHeightPx ??
        DEFAULT_OPTIONS.measureExtraHeightPx,
      // debug
      debug: {
        measure:
          s.debug?.measure ??
          flat.debug?.measure ??
          DEFAULT_OPTIONS.debug?.measure,
        layout:
          s.debug?.layout ??
          flat.debug?.layout ??
          DEFAULT_OPTIONS.debug?.layout,
        paintBounds:
          s.debug?.paintBounds ??
          flat.debug?.paintBounds ??
          DEFAULT_OPTIONS.debug?.paintBounds,
        exposeOnWindow:
          s.debug?.exposeOnWindow ??
          flat.debug?.exposeOnWindow ??
          DEFAULT_OPTIONS.debug?.exposeOnWindow,
      },
    };
    return merged;
  });

  // ===== Ciclo de vida =====
  ngAfterViewInit(): void {
    this.recomputeEffectiveSettings();
    this.compute();
  }
  ngOnChanges(_: SimpleChanges): void {
    this.recomputeEffectiveSettings();
    this.compute();
  }

  // ===== Internos =====
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

  // ===== Pipeline principal =====
  private async compute(): Promise<void> {
    if (this.isLoadingView()) return;

    const opts = this.effectiveOptions();
    const dbgMeasure = !!opts.debug?.measure;

    // 1) Normalizar + primer layout
    const normalized = this.adapter.normalize(this.data(), opts);
    let laid = await this.layoutService.layout(normalized, opts);
    this.graph.set(this.cloneGraph(laid));

    if (!opts.autoResizeCards) {
      this.fitToView();
      return;
    }

    // 2) Medir DOM → relayout hasta estabilizar (máx. 6 pasadas)
    const maxPasses = 6;
    for (let pass = 1; pass <= maxPasses; pass++) {
      await this.nextFrame();
      const changed = this.measureAndApply(pass, dbgMeasure);
      if (!changed) break;
      if (opts.debug?.layout) console.log(`[schema] relayout pass #${pass}`);
      laid = await this.layoutService.layout(this.graph(), opts);
      this.graph.set(this.cloneGraph(laid));
    }

    // 3) Encuadre
    this.fitToView();

    if (opts.debug?.exposeOnWindow) {
      (window as any).schemaDebug = {
        get graph() {
          return structuredClone(laid);
        },
        options: opts,
      };
      // eslint-disable-next-line no-console
      console.log('schemaDebug disponible en window.schemaDebug');
    }
  }

  /** Mide .schema-card y aplica width/height con colchón extra. */
  private measureAndApply(_pass: number, _log = false): boolean {
    const opts = this.effectiveOptions();
    const extraW = opts.measureExtraWidthPx ?? 0;
    const extraH = opts.measureExtraHeightPx ?? 0;

    const root = this.rootRef.nativeElement;
    const cards = Array.from(
      root.querySelectorAll<HTMLElement>('.schema-card')
    );

    const map = new Map(this.graph().nodes.map((n) => [n.id, n]));
    let changed = false;

    for (const el of cards) {
      const id = el.getAttribute('data-node-id') ?? undefined;
      const node = (id ? map.get(id) : undefined) ?? null;
      if (!node) continue;

      const w = Math.ceil(el.scrollWidth + extraW);
      const h = Math.ceil(el.scrollHeight + extraH);

      const maxW = opts.maxCardWidth ?? Infinity;
      const maxH = opts.maxCardHeight ?? Infinity;
      const cw = Math.min(w, maxW);
      const ch = Math.min(h, maxH);

      if ((node.width ?? 0) !== cw || (node.height ?? 0) !== ch) {
        node.width = cw;
        node.height = ch;
        changed = true;
      }
    }
    return changed;
  }

  // ===== Viewport / encuadre =====
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

  // ===== Interacción (zoom/pan/centrado) =====
  onWheel(e: WheelEvent) {
    e.preventDefault();
    const rect = this.rootRef.nativeElement.getBoundingClientRect();
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
    const rect = this.rootRef.nativeElement.getBoundingClientRect();
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

  // Toolbar: selectores
  setLinkStyle(v: string) {
    const ok = v === 'orthogonal' || v === 'curve' || v === 'line';
    this.opt_linkStyle.set(ok ? (v as any) : 'orthogonal');
    this.compute();
  }
  setLayoutAlign(v: string) {
    const ok = v === 'firstChild' || v === 'center';
    this.opt_layoutAlign.set(ok ? (v as any) : 'center');
    this.compute();
  }
}
