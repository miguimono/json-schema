// projects/schema/src/lib/components/schema.component.ts
// ----------------------------------------------------
// Versión sin SchemaOptions: usa SchemaSettings + DEFAULT_SETTINGS.
// - enableCollapse: settings.dataView.enableCollapse (false por defecto).
// - Orden estable de JSON, anti-solapes por capa y pinY conservado (lo hace SchemaLayoutService).
// - Pipeline: normalize → indices → (subgrafo visible) → layout → medir/relayout → fit-to-view.
// - Toolbar (linkStyle/layoutAlign) sobreescribe settings.layout sin mutarlo.
//
// Requisitos colaterales:
// - JsonAdapterService.normalize debe aceptar Partial<SchemaSettings> o mapear settings→options internamente.
// - SchemaLinksComponent y SchemaCardComponent deben aceptar `settings` (no `options`).

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
} from "@angular/core";
import { CommonModule, NgFor, NgIf } from "@angular/common";

import { JsonAdapterService } from "../services/json-adapter.service";
import { SchemaLayoutService } from "../services/schema-layout.service";

import { NormalizedGraph, SchemaEdge, SchemaNode, SchemaSettings, DEFAULT_SETTINGS } from "../models";

import { SchemaCardComponent } from "./schema-card.component";
import { SchemaLinksComponent } from "./schema-links.component";

@Component({
  selector: "schema",
  standalone: true,
  imports: [CommonModule, NgFor, NgIf, SchemaCardComponent, SchemaLinksComponent],
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
      <!-- ===== Toolbar (opcional) ===== -->
      <div class="schema-toolbar" *ngIf="showToolbar() && !isLoadingView() && !isErrorView()">
        <div class="left">
          <button type="button" (click)="zoomOut()" title="Zoom out">−</button>
          <button type="button" (click)="zoomIn()" title="Zoom in">+</button>
          <button type="button" (click)="resetView()" title="Centrar">⤾</button>
        </div>

        <div class="right">
          <label>
            Enlaces:
            <select #ls [value]="opt_linkStyle()" (change)="setLinkStyle(ls.value)">
              <option value="curve">Curvo</option>
              <option value="orthogonal">Ortogonal</option>
              <option value="line">Lineal</option>
            </select>
          </label>

          <label>
            Alineación:
            <select #la [value]="opt_layoutAlign()" (change)="setLayoutAlign(la.value)">
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
      <div class="stage" [style.transform]="transform()" *ngIf="!isLoadingView() && !isErrorView()">
        <schema-links
          [edges]="edges()"
          [settings]="effectiveSettings()"
          (linkClick)="linkClick.emit($event)"
          [width]="virtualWidth"
          [height]="virtualHeight"
        ></schema-links>

        <ng-container *ngFor="let n of nodes()">
          <schema-card
            [node]="n"
            [settings]="effectiveSettings()"
            [cardTemplate]="cardTemplate()"
            [hasChildren]="hasChildren(n.id)"
            [showCollapseControls]="enableCollapse()"
            [isCollapsed]="isNodeCollapsed(n.id)"
            (toggleRequest)="onCardToggle($event)"
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
        background: linear-gradient(to right, #e0e0e0 8%, #f0f0f0 18%, #e0e0e0 33%);
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
  // ===== Inputs =====

  /** JSON de entrada a visualizar. */
  data = input<any>();

  /**
   * Settings por secciones. Se fusionan con DEFAULT_SETTINGS y con las
   * sobreescrituras de la toolbar (linkStyle/layoutAlign).
   */
  settings = input<SchemaSettings | null>(null);

  /** Template de card custom (opcional). Recibe el nodo como `$implicit`. */
  cardTemplate = input<TemplateRef<any> | null>(null);

  // Estados/overlays (pueden venir por settings.messages también)
  isLoading = input<boolean>(false);
  isError = input<boolean>(false);
  emptyMessage = input<string>("No hay datos para mostrar");
  loadingMessage = input<string>("Cargando…");
  errorMessage = input<string>("Error al cargar el esquema");

  // Viewport (pueden venir por settings.viewport)
  viewportHeight = signal<number>(800);
  minViewportHeight = signal<number>(480);
  showToolbar = signal<boolean>(true);

  // ===== Salidas =====
  @Output() nodeClick = new EventEmitter<SchemaNode>();
  @Output() linkClick = new EventEmitter<SchemaEdge>();

  // ===== Estado de grafo =====
  private fullGraph = signal<NormalizedGraph>({ nodes: [], edges: [] });
  private graph = signal<NormalizedGraph>({ nodes: [], edges: [] });

  nodes = computed(() => this.graph().nodes);
  edges = computed(() => this.graph().edges);

  @ViewChild("root", { static: true }) rootRef!: ElementRef<HTMLElement>;

  // ===== Pan/zoom =====
  private scale = signal(1);
  private minScale = signal(0.2);
  private maxScale = signal(3);
  private tx = signal(0);
  private ty = signal(0);

  transform = computed(() => `translate(${this.tx()}px, ${this.ty()}px) scale(${this.scale()})`);

  virtualWidth = 12000;
  virtualHeight = 6000;

  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  // ===== Toolbar (overrides de layout visual) =====
  opt_linkStyle = signal<"orthogonal" | "curve" | "line">("orthogonal");
  opt_layoutAlign = signal<"firstChild" | "center">("center");

  // ===== Vista derivada (mensajes) =====
  isLoadingView = computed(() => this.settings()?.messages?.isLoading ?? this.isLoading());
  isErrorView = computed(() => this.settings()?.messages?.isError ?? this.isError());
  emptyMessageView = computed(() => this.settings()?.messages?.emptyMessage ?? this.emptyMessage());
  loadingMessageView = computed(() => this.settings()?.messages?.loadingMessage ?? this.loadingMessage());
  errorMessageView = computed(() => this.settings()?.messages?.errorMessage ?? this.errorMessage());

  // ===== Colapso/expansión =====
  private childrenById = new Map<string, string[]>();
  private parentsById = new Map<string, string[]>();
  private collapsed = new Set<string>();

  /** Flag derivado: `settings.dataView.enableCollapse`. */
  enableCollapse = computed<boolean>(() => !!this.settings()?.dataView?.enableCollapse);

  constructor(
    private adapter: JsonAdapterService,
    private layoutService: SchemaLayoutService,
  ) {}

  // ===== Merge a settings efectivos =====

  //  settings base (sin overrides de toolbar)
  baseSettings = computed<SchemaSettings>(() => {
    const s = this.settings() ?? {};
    return {
      messages: { ...DEFAULT_SETTINGS.messages, ...s.messages },
      viewport: { ...DEFAULT_SETTINGS.viewport, ...s.viewport },
      debug: { ...DEFAULT_SETTINGS.debug, ...s.debug },
      colors: { ...DEFAULT_SETTINGS.colors, ...s.colors },
      layout: { ...DEFAULT_SETTINGS.layout, ...s.layout },
      dataView: { ...DEFAULT_SETTINGS.dataView, ...s.dataView },
    };
  });

  /**
   * Settings efectivos:
   * - DEFAULT_SETTINGS
   * - + settings() (usuario)
   * - + overrides de toolbar: layout.linkStyle y layout.layoutAlign
   */
  effectiveSettings = computed<SchemaSettings>(() => {
    const b = this.baseSettings();
    return {
      ...b,
      layout: {
        ...b.layout,
        linkStyle: this.opt_linkStyle(), // override en runtime
        layoutAlign: this.opt_layoutAlign(), // override en runtime
      },
    };
  });

  /** Relee viewport y toolbar desde los settings efectivos. */
  private recomputeFromSettings(): void {
    const b = this.baseSettings();

    // viewport
    this.viewportHeight.set(b.viewport?.height ?? DEFAULT_SETTINGS.viewport!.height!);
    this.minViewportHeight.set(b.viewport?.minHeight ?? DEFAULT_SETTINGS.viewport!.minHeight!);
    this.showToolbar.set(b.viewport?.showToolbar ?? DEFAULT_SETTINGS.viewport!.showToolbar!);

    // selectors: toman el valor por defecto real (o el del usuario), NO lo pisamos
    this.opt_linkStyle.set((b.layout?.linkStyle ?? DEFAULT_SETTINGS.layout!.linkStyle!) as any);
    this.opt_layoutAlign.set((b.layout?.layoutAlign ?? DEFAULT_SETTINGS.layout!.layoutAlign!) as any);
  }

  // ===== Ciclo de vida =====
  ngAfterViewInit(): void {
    this.recomputeFromSettings();
    this.compute();
  }

  ngOnChanges(_: SimpleChanges): void {
    this.recomputeFromSettings();
    this.compute();
  }

  // ===== Utilitarios =====
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

  // ===== Índices hijos/padres =====
  private buildIndices(): void {
    this.childrenById.clear();
    this.parentsById.clear();
    const g = this.fullGraph();
    for (const n of g.nodes) {
      this.childrenById.set(n.id, []);
      this.parentsById.set(n.id, []);
    }
    for (const e of g.edges) {
      this.childrenById.get(e.source)!.push(e.target);
      this.parentsById.get(e.target)!.push(e.source);
    }
  }

  private isVisibleNodeByCollapsedAncestors(id: string): boolean {
    if (!this.enableCollapse()) return true;
    const stack = [...(this.parentsById.get(id) ?? [])];
    const seen = new Set<string>();
    while (stack.length) {
      const p = stack.pop()!;
      if (seen.has(p)) continue;
      seen.add(p);
      if (this.collapsed.has(p)) return false;
      const pp = this.parentsById.get(p);
      if (pp && pp.length) stack.push(...pp);
    }
    return true;
  }

  private buildVisibleGraphFromCollapsed(): NormalizedGraph {
    const full = this.fullGraph();
    if (!this.enableCollapse()) return this.cloneGraph(full);

    const visibleNodeSet = new Set<string>();
    for (const n of full.nodes) {
      if (this.isVisibleNodeByCollapsedAncestors(n.id)) visibleNodeSet.add(n.id);
    }
    const nodes = full.nodes.filter((n) => visibleNodeSet.has(n.id));
    const edges = full.edges.filter((e) => visibleNodeSet.has(e.source) && visibleNodeSet.has(e.target));
    return { nodes, edges, meta: full.meta };
  }

  // ===== Toggle de colapso =====
  async onCardToggle(n: SchemaNode): Promise<void> {
    if (!this.enableCollapse() || !n?.id) return;

    const anchorBefore = this.getNodeScreenCenter(n);

    if (this.collapsed.has(n.id)) this.collapsed.delete(n.id);
    else this.collapsed.add(n.id);

    await this.relayoutVisible(n.id, anchorBefore);
  }

  hasChildren = (id: string): boolean => (this.childrenById.get(id)?.length ?? 0) > 0;
  isNodeCollapsed = (id: string): boolean => this.collapsed.has(id);

  // ===== Pipeline principal =====
  private async compute(): Promise<void> {
    if (this.isLoadingView()) return;

    const s = this.effectiveSettings();

    // 1) Normalizar grafo completo (adapter debe aceptar settings o mapearlos)
    const normalized = this.adapter.normalize(this.data(), s);
    this.ensurePinMeta(normalized, s);
    this.fullGraph.set(this.cloneGraph(normalized));

    // 2) Índices
    this.buildIndices();

    // 3) Reset colapsados si no hay feature
    if (!this.enableCollapse()) this.collapsed.clear();

    // 4) Subgrafo visible
    const visible = this.buildVisibleGraphFromCollapsed();

    // 5) Layout inicial
    let laid = await this.layoutService.layout(visible, s);
    this.graph.set(this.cloneGraph(laid));

    // 6) Medición y relayout (si está activo)
    if (s.dataView?.autoResizeCards ?? DEFAULT_SETTINGS.dataView!.autoResizeCards!) {
      const maxPasses = 6;
      for (let pass = 1; pass <= maxPasses; pass++) {
        await this.nextFrame();
        const changed = this.measureAndApply(pass, !!s.debug?.measure);
        if (!changed) break;
        if (s.debug?.layout) console.log(`[schema] relayout pass #${pass}`);
        laid = await this.layoutService.layout(this.graph(), s);
        this.graph.set(this.cloneGraph(laid));
      }
    }

    // 7) Encuadre
    this.fitToView();

    // 8) Debug
    if (s.debug?.exposeOnWindow) {
      (window as any).schemaDebug = {
        get graph() {
          return structuredClone(laid);
        },
        settings: s,
      };
      // eslint-disable-next-line no-console
      console.log("schemaDebug disponible en window.schemaDebug");
    }
  }

  private async relayoutVisible(anchorId?: string, anchorScreen?: { x: number; y: number }): Promise<void> {
    const s = this.effectiveSettings();
    const visible = this.buildVisibleGraphFromCollapsed();
    this.ensurePinMeta(visible, s);
    let laid = await this.layoutService.layout(visible, s);

    if (s.dataView?.autoResizeCards ?? DEFAULT_SETTINGS.dataView!.autoResizeCards!) {
      const maxPasses = 4;
      for (let pass = 1; pass <= maxPasses; pass++) {
        await this.nextFrame();
        const changed = this.measureAndApply(pass, !!s.debug?.measure);
        if (!changed) break;
        laid = await this.layoutService.layout(visible, s);
      }
    }

    await this.animateToGraph(laid, 260, anchorId, anchorScreen);
  }

  // ===== Medición DOM =====
  private measureAndApply(_pass: number, _log = false): boolean {
    const s = this.effectiveSettings();
    const extraW = s.dataView?.measureExtraWidthPx ?? 0;
    const extraH = s.dataView?.measureExtraHeightPx ?? 0;
    const maxW = s.dataView?.maxCardWidth ?? Infinity;
    const maxH = s.dataView?.maxCardHeight ?? Infinity;

    const root = this.rootRef.nativeElement;
    const cards = Array.from(root.querySelectorAll<HTMLElement>(".schema-card"));

    const map = new Map(this.graph().nodes.map((n) => [n.id, n]));
    let changed = false;

    for (const el of cards) {
      const id = el.getAttribute("data-node-id") ?? undefined;
      const node = (id ? map.get(id) : undefined) ?? null;
      if (!node) continue;

      const w = Math.ceil(el.scrollWidth + extraW);
      const h = Math.ceil(el.scrollHeight + extraH);

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

  // ===== Interacción (zoom/pan/centro) =====
  onWheel(e: WheelEvent) {
    e.preventDefault();
    const rect = this.rootRef.nativeElement.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const oldScale = this.scale();
    const factor = 1 + (-e.deltaY > 0 ? 0.08 : -0.08);
    const newScale = Math.max(this.minScale(), Math.min(this.maxScale(), oldScale * factor));

    const worldX = (mouseX - this.tx()) / oldScale;
    const worldY = (mouseY - this.ty()) / oldScale;
    this.tx.set(mouseX - worldX * newScale);
    this.ty.set(mouseY - worldY * newScale);
    this.scale.set(newScale);
  }

  onPointerDown(e: MouseEvent) {
    this.dragging = true;
    const el = e.target as HTMLElement;
    if (el && el.closest && el.closest(".collapse-btn")) {
      this.dragging = false;
      return;
    }
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
    const root = this.nodes()[0];
    if (!root) return;
    const rect = this.rootRef.nativeElement.getBoundingClientRect();
    const viewportCx = rect.width / 2;
    const viewportCy = rect.height / 2;

    const s = this.scale();
    const nodeCx = (root.x ?? 0) + (root.width ?? 0) / 2;
    const nodeCy = (root.y ?? 0) + (root.height ?? 0) / 2;

    this.tx.set(viewportCx - nodeCx * s);
    this.ty.set(viewportCy - nodeCy * s);
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
    const newScale = Math.max(this.minScale(), Math.min(this.maxScale(), oldScale * factor));

    const worldX = (mouseX - this.tx()) / oldScale;
    const worldY = (mouseY - this.ty()) / oldScale;
    this.tx.set(mouseX - worldX * newScale);
    this.ty.set(mouseY - worldY * newScale);
    this.scale.set(newScale);
  }

  setLinkStyle(v: string) {
    const ok = v === "orthogonal" || v === "curve" || v === "line";
    this.opt_linkStyle.set(ok ? (v as any) : "orthogonal");
    this.relayoutVisible();
  }
  setLayoutAlign(v: string) {
    const ok = v === "firstChild" || v === "center";
    this.opt_layoutAlign.set(ok ? (v as any) : "center");
    this.relayoutVisible();
  }

  // ===== Anclaje =====
  private getNodeById(id: string | undefined): SchemaNode | undefined {
    if (!id) return undefined;
    return this.graph().nodes.find((n) => n.id === id);
  }

  private getNodeScreenCenter(n: SchemaNode): { x: number; y: number } {
    const s = this.scale();
    const cx = (n.x ?? 0) + (n.width ?? 0) / 2;
    const cy = (n.y ?? 0) + (n.height ?? 0) / 2;
    return { x: cx * s + this.tx(), y: cy * s + this.ty() };
  }

  private applyAnchorAfterLayout(nodeId: string, targetScreen: { x: number; y: number }) {
    const n = this.getNodeById(nodeId);
    if (!n) return;
    const s = this.scale();
    const cx = (n.x ?? 0) + (n.width ?? 0) / 2;
    const cy = (n.y ?? 0) + (n.height ?? 0) / 2;
    this.tx.set(targetScreen.x - cx * s);
    this.ty.set(targetScreen.y - cy * s);
  }

  private async animateToGraph(
    target: NormalizedGraph,
    durationMs = 260,
    anchorId?: string,
    anchorScreen?: { x: number; y: number },
  ): Promise<void> {
    const start = this.cloneGraph(this.graph());

    const startNodeById = new Map(start.nodes.map((n) => [n.id, n]));
    const endNodeById = new Map(target.nodes.map((n) => [n.id, n]));
    const startEdgeById = new Map(start.edges.map((e) => [e.id, e]));
    const endEdgeById = new Map(target.edges.map((e) => [e.id, e]));

    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    const alignPoints = (a: Array<{ x: number; y: number }> = [], b: Array<{ x: number; y: number }> = []) => {
      const aa = a.length ? [...a] : [];
      const bb = b.length ? [...b] : [];
      const len = Math.max(aa.length, bb.length, 2);
      while (aa.length < len) aa.push(aa[aa.length - 1] ?? { x: 0, y: 0 });
      while (bb.length < len) bb.push(bb[bb.length - 1] ?? { x: 0, y: 0 });
      return { aa, bb, len };
    };

    const t0 = performance.now();
    const run = (resolve: () => void) => {
      const now = performance.now();
      const raw = Math.min(1, (now - t0) / Math.max(1, durationMs));
      const t = easeInOut(raw);

      const frame: NormalizedGraph = {
        nodes: [],
        edges: [],
        meta: { ...(target.meta ?? {}) },
      };

      // nodos visibles en destino
      for (const endNode of target.nodes) {
        const s = startNodeById.get(endNode.id) ?? endNode;
        const xn = lerp(s.x ?? 0, endNode.x ?? 0, t);
        const yn = lerp(s.y ?? 0, endNode.y ?? 0, t);
        const wn = lerp(s.width ?? 0, endNode.width ?? 0, t);
        const hn = lerp(s.height ?? 0, endNode.height ?? 0, t);
        frame.nodes.push({
          ...endNode,
          x: Math.round(xn),
          y: Math.round(yn),
          width: Math.round(wn),
          height: Math.round(hn),
        });
      }

      // aristas
      for (const endEdge of target.edges) {
        const s = startEdgeById.get(endEdge.id) ?? endEdge;
        const { aa, bb, len } = alignPoints(s.points, endEdge.points);
        const pts = new Array(len).fill(0).map((_, i) => ({
          x: lerp(aa[i].x, bb[i].x, t),
          y: lerp(aa[i].y, bb[i].y, t),
        }));
        frame.edges.push({ ...endEdge, points: pts });
      }

      this.graph.set(frame);

      if (anchorId && anchorScreen) {
        this.applyAnchorAfterLayout(anchorId, anchorScreen);
      }

      if (raw < 1) {
        requestAnimationFrame(() => run(resolve));
      } else {
        this.graph.set(this.cloneGraph(target));
        if (anchorId && anchorScreen) this.applyAnchorAfterLayout(anchorId, anchorScreen);
        resolve();
      }
    };

    await new Promise<void>((resolve) => requestAnimationFrame(() => run(resolve)));
  }
  /** Asegura que existan los mapas de pin en meta según la dirección del layout. */
  private ensurePinMeta(g: NormalizedGraph, s: SchemaSettings): void {
    if (!g.meta) g.meta = {};
    const dir = s.layout?.layoutDirection ?? DEFAULT_SETTINGS.layout.layoutDirection;
    const key = dir === "RIGHT" ? "pinY" : "pinX";
    if (!g.meta[key]) g.meta[key] = {};
  }
}
