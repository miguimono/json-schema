// URL: projects/schema-ng16/src/lib/components/schema.component.ts

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  Input,
  signal,
  computed,
} from "@angular/core";
import { CommonModule, NgFor, NgIf } from "@angular/common";

import { JsonAdapterService } from "../services/json-adapter.service";
import { SchemaLayoutService } from "../services/schema-layout.service";

import {
  NormalizedGraph,
  SchemaEdge,
  SchemaNode,
  SchemaSettings,
  DEFAULT_SETTINGS,
  LinkStyle,
  LayoutAlign,
  LayoutDirection,
} from "../models";

import { SchemaCardComponent } from "./schema-card.component";
import { SchemaLinksComponent } from "./schema-links.component";

@Component({
  selector: "schema",
  standalone: true,
  imports: [CommonModule, NgFor, NgIf, SchemaCardComponent, SchemaLinksComponent],
  templateUrl: "./schema.component.html",
  styleUrls: ["./schema.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaComponent implements AfterViewInit, OnChanges, OnDestroy {
  // ===== Inputs (Angular 16 con alias, alimentan señales internas) =====
  private _data = signal<any>(null);
  @Input("data") set dataInput(v: any) {
    this._data.set(v);
  }
  data() {
    return this._data();
  }

  private _settings = signal<SchemaSettings>(DEFAULT_SETTINGS);
  @Input("settings") set settingsInput(v: SchemaSettings | null) {
    this._settings.set(v ?? DEFAULT_SETTINGS);
  }
  settings() {
    return this._settings();
  }

  private _cardTemplate = signal<TemplateRef<any> | null>(null);
  @Input("cardTemplate") set cardTemplateInput(tpl: TemplateRef<any> | null) {
    this._cardTemplate.set(tpl ?? null);
  }
  cardTemplate() {
    return this._cardTemplate();
  }

  // Overlays (mantienen compatibilidad con propiedades existentes)
  private _isLoading = signal<boolean>(false);
  @Input("isLoading") set isLoadingInput(v: boolean) {
    this._isLoading.set(!!v);
  }
  isLoading() {
    return this._isLoading();
  }

  private _isError = signal<boolean>(false);
  @Input("isError") set isErrorInput(v: boolean) {
    this._isError.set(!!v);
  }
  isError() {
    return this._isError();
  }

  private _emptyMessage = signal<string>("No hay datos para mostrar");
  @Input("emptyMessage") set emptyMessageInput(v: string) {
    this._emptyMessage.set(typeof v === "string" ? v : "No hay datos para mostrar");
  }
  emptyMessage() {
    return this._emptyMessage();
  }

  private _loadingMessage = signal<string>("Cargando…");
  @Input("loadingMessage") set loadingMessageInput(v: string) {
    this._loadingMessage.set(typeof v === "string" ? v : "Cargando…");
  }
  loadingMessage() {
    return this._loadingMessage();
  }

  private _errorMessage = signal<string>("Error al cargar el esquema");
  @Input("errorMessage") set errorMessageInput(v: string) {
    this._errorMessage.set(typeof v === "string" ? v : "Error al cargar el esquema");
  }
  errorMessage() {
    return this._errorMessage();
  }

  // Viewport (no son inputs; se derivan de settings)
  viewportHeight = signal<number>(800);
  minViewportHeight = signal<number>(480);
  showToolbar = signal<boolean>(true);

  // ===== Outputs =====
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
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private lastViewport: { w: number; h: number } | null = null;

  /** Último punto de interacción sobre la stage (coordenadas de pantalla relativas al root). */
  private lastPointerScreen: { x: number; y: number } | null = null;
  private wheelRaf: number | null = null;
  private pendingWheel: { deltaY: number; clientX: number; clientY: number } | null = null;

  transform = computed(() => `translate(${this.tx()}px, ${this.ty()}px) scale(${this.scale()})`);

  virtualWidth = 12000;
  virtualHeight = 6000;

  // ===== Toolbar overrides =====
  opt_linkStyle = signal<LinkStyle>("orthogonal");
  opt_layoutAlign = signal<LayoutAlign>("firstChild");
  opt_layoutDirection = signal<LayoutDirection>("RIGHT");

  // ===== Mensajes derivados (prioriza settings.messages si están definidos) =====
  isLoadingView = computed(() => this.settings().messages?.isLoading ?? this.isLoading());
  isErrorView = computed(() => this.settings().messages?.isError ?? this.isError());
  emptyMessageView = computed(() => this.settings().messages?.emptyMessage ?? this.emptyMessage());
  loadingMessageView = computed(() => this.settings().messages?.loadingMessage ?? this.loadingMessage());
  errorMessageView = computed(() => this.settings().messages?.errorMessage ?? this.errorMessage());

  // ===== Collapse/expand =====
  private childrenById = new Map<string, string[]>();
  private parentsById = new Map<string, string[]>();
  private collapsed = new Set<string>();
  private measureIdsToCheck: Set<string> | null = null;
  private lastDataRef: any | undefined;
  private lastSettingsRef: SchemaSettings | null | undefined;
  private hasComputedOnce = false;

  enableCollapse = computed<boolean>(() => {
    const b = this.baseSettings();
    return b.dataView?.enableCollapse ?? DEFAULT_SETTINGS.dataView.enableCollapse!;
  });

  // ===== Toolbar controls visibility =====
  toolbarShowLinkStyle = computed<boolean>(() => {
    const b = this.baseSettings();
    return b.viewport?.toolbarControls?.showLinkStyle ?? true;
  });
  toolbarShowLayoutAlign = computed<boolean>(() => {
    const b = this.baseSettings();
    return b.viewport?.toolbarControls?.showLayoutAlign ?? true;
  });
  toolbarShowLayoutDirection = computed<boolean>(() => {
    const b = this.baseSettings();
    return b.viewport?.toolbarControls?.showLayoutDirection ?? true;
  });

  constructor(private adapter: JsonAdapterService, private layoutService: SchemaLayoutService) {}

  // ===== Settings efectivos =====
  baseSettings = computed<SchemaSettings>(() => {
    const s = this.settings() ?? ({} as SchemaSettings);
    return {
      messages: { ...DEFAULT_SETTINGS.messages, ...s.messages },
      viewport: { ...DEFAULT_SETTINGS.viewport, ...s.viewport },
      colors: { ...DEFAULT_SETTINGS.colors, ...s.colors },
      layout: { ...DEFAULT_SETTINGS.layout, ...s.layout },
      dataView: { ...DEFAULT_SETTINGS.dataView, ...s.dataView },
    };
  });

  effectiveSettings = computed<SchemaSettings>(() => {
    const b = this.baseSettings();
    return {
      ...b,
      layout: {
        ...b.layout,
        linkStyle: this.opt_linkStyle(),
        layoutAlign: this.opt_layoutAlign(),
        layoutDirection: this.opt_layoutDirection(),
      },
    };
  });

  private recomputeFromSettings(): void {
    const b = this.baseSettings();
    this.viewportHeight.set(b.viewport?.height ?? DEFAULT_SETTINGS.viewport.height!);
    this.minViewportHeight.set(b.viewport?.minHeight ?? DEFAULT_SETTINGS.viewport.minHeight!);
    this.showToolbar.set(b.viewport?.showToolbar ?? DEFAULT_SETTINGS.viewport.showToolbar!);

    this.opt_linkStyle.set((b.layout?.linkStyle ?? DEFAULT_SETTINGS.layout.linkStyle) as LinkStyle);
    this.opt_layoutAlign.set((b.layout?.layoutAlign ?? DEFAULT_SETTINGS.layout.layoutAlign) as LayoutAlign);
    this.opt_layoutDirection.set(
      (b.layout?.layoutDirection ?? DEFAULT_SETTINGS.layout.layoutDirection) as LayoutDirection,
    );
  }

  // ===== Ciclo de vida =====
  private resizeObs?: ResizeObserver;

  ngAfterViewInit(): void {
    this.recomputeFromSettings();

    const rootEl = this.rootRef?.nativeElement;
    if (rootEl && "ResizeObserver" in window) {
      const r0 = rootEl.getBoundingClientRect();
      this.lastViewport = { w: r0.width, h: r0.height };

      this.resizeObs = new ResizeObserver(() => {
        const rect = rootEl.getBoundingClientRect();
        this.preserveCenterOnResize(rect.width, rect.height);
      });
      this.resizeObs.observe(rootEl);
    }

    this.compute();
  }

  ngOnChanges(_: SimpleChanges): void {
    this.recomputeFromSettings();
    this.compute();
  }

  ngOnDestroy(): void {
    if (this.resizeObs) {
      try {
        this.resizeObs.disconnect();
      } catch {}
    }
  }

  // ===== Pipeline principal =====
  private async compute(): Promise<void> {
    if (this.isLoadingView()) return;

    if (this.hasComputedOnce && this.data() === this.lastDataRef && this.settings() === this.lastSettingsRef) {
      return;
    }

    const s = this.effectiveSettings();
    const normalized = this.adapter.normalize(this.data(), s);
    this.ensurePinMeta(normalized, s);
    this.fullGraph.set(this.cloneGraph(normalized));

    this.buildIndices();
    if (!this.enableCollapse()) this.collapsed.clear();

    const visible = this.buildVisibleGraphFromCollapsed();

    let laid = await this.layoutService.layout(visible, s);
    this.graph.set(this.cloneGraph(laid));

    if (s.dataView?.autoResizeCards ?? DEFAULT_SETTINGS.dataView.autoResizeCards) {
      const maxPasses = 6;
      this.measureIdsToCheck = null; // primera pasada: medir todo
      for (let pass = 1; pass <= maxPasses; pass++) {
        await this.nextFrame();
        const changed = this.measureAndApply(pass);
        if (!changed) break;
        laid = await this.layoutService.layout(this.graph(), s);
        this.graph.set(this.cloneGraph(laid));
      }
    }

    this.updateVirtualSizeFromGraph(laid);
    this.fitToViewByBounds(); // asegura minScale y encuadre base
    this.centerOnFirstNodeOrFit(); // centra como doble clic

    this.lastDataRef = this.data();
    this.lastSettingsRef = this.settings();
    this.hasComputedOnce = true;
  }

  private async relayoutVisible(anchorId?: string, anchorScreen?: { x: number; y: number }): Promise<void> {
    const s = this.effectiveSettings();

    const visible = this.buildVisibleGraphFromCollapsed();
    let laid = await this.layoutService.layout(visible, s);
    this.graph.set(this.cloneGraph(laid));

    if (s.dataView?.autoResizeCards ?? DEFAULT_SETTINGS.dataView.autoResizeCards) {
      const maxPasses = 4;
      this.measureIdsToCheck = null; // primera pasada: medir todo
      for (let pass = 1; pass <= maxPasses; pass++) {
        await this.nextFrame();
        const changed = this.measureAndApply(pass);
        if (!changed) break;
        laid = await this.layoutService.layout(this.graph(), s);
        this.graph.set(this.cloneGraph(laid));
      }
    }

    this.updateVirtualSizeFromGraph(laid);
    await this.animateToGraph(laid, 260, anchorId, anchorScreen);
  }

  async onCardToggle(n: SchemaNode): Promise<void> {
    if (!this.enableCollapse() || !n?.id) return;

    const anchorBefore = this.getNodeScreenCenter(n);

    if (this.collapsed.has(n.id)) this.collapsed.delete(n.id);
    else this.collapsed.add(n.id);

    await this.relayoutVisible(n.id, anchorBefore);
  }

  /** Devuelve si el nodo tiene hijos (para pintar botón de colapso). */
  hasChildren = (id: string): boolean => (this.childrenById.get(id)?.length ?? 0) > 0;

  /** Devuelve si el nodo está colapsado (estado visual en la card). */
  isNodeCollapsed = (id: string): boolean => this.collapsed.has(id);

  // --- Animación de transición entre grafos (requerido por relayoutVisible) ---
  private async animateToGraph(
    target: NormalizedGraph,
    durationMs = 260,
    anchorId?: string,
    anchorScreen?: { x: number; y: number },
  ): Promise<void> {
    const start = this.cloneGraph(this.graph());

    const startNodeById = new Map(start.nodes.map((n) => [n.id, n]));
    const startEdgeById = new Map(start.edges.map((e) => [e.id, e]));

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

      const frame: NormalizedGraph = { nodes: [], edges: [], meta: { ...(target.meta ?? {}) } };

      for (const endNode of target.nodes) {
        const sNode = startNodeById.get(endNode.id) ?? endNode;
        const xn = lerp(sNode.x ?? 0, endNode.x ?? 0, t);
        const yn = lerp(sNode.y ?? 0, endNode.y ?? 0, t);
        const wn = lerp(sNode.width ?? 0, endNode.width ?? 0, t);
        const hn = lerp(sNode.height ?? 0, endNode.height ?? 0, t);
        frame.nodes.push({
          ...endNode,
          x: Math.round(xn),
          y: Math.round(yn),
          width: Math.round(wn),
          height: Math.round(hn),
        });
      }

      for (const endEdge of target.edges) {
        const sEdge = startEdgeById.get(endEdge.id) ?? endEdge;
        const { aa, bb, len } = alignPoints(sEdge.points, endEdge.points);
        const pts = new Array(len)
          .fill(0)
          .map((_, i) => ({ x: lerp(aa[i].x, bb[i].x, t), y: lerp(aa[i].y, bb[i].y, t) }));
        frame.edges.push({ ...endEdge, points: pts });
      }

      this.graph.set(frame);

      if (anchorId && anchorScreen) this.applyAnchorAfterLayout(anchorId, anchorScreen);

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

  // ===== Interacción (solo en .stage) =====
  onWheel(e: WheelEvent) {
    e.preventDefault();
    this.pendingWheel = { deltaY: e.deltaY, clientX: e.clientX, clientY: e.clientY };
    if (this.wheelRaf !== null) return;
    this.wheelRaf = requestAnimationFrame(() => {
      const ev = this.pendingWheel;
      this.pendingWheel = null;
      this.wheelRaf = null;
      if (!ev) return;

      const rect = this.rootRef.nativeElement.getBoundingClientRect();
      const mouseX = ev.clientX - rect.left;
      const mouseY = ev.clientY - rect.top;
      this.lastPointerScreen = { x: mouseX, y: mouseY };

      const oldScale = this.scale();
      const factor = 1 + (-ev.deltaY > 0 ? 0.08 : -0.08);
      const newScale = Math.max(this.minScale(), Math.min(this.maxScale(), oldScale * factor));

      const worldX = (mouseX - this.tx()) / oldScale;
      const worldY = (mouseY - this.ty()) / oldScale;
      this.tx.set(mouseX - worldX * newScale);
      this.ty.set(mouseY - worldY * newScale);
      this.scale.set(newScale);
    });
  }

  onPointerDown(e: PointerEvent) {
    e.preventDefault();

    this.dragging = true;
    const el = e.target as HTMLElement;
    if (el && el.closest && el.closest(".collapse-btn")) {
      this.dragging = false;
      return;
    }

    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {}

    const rect = this.rootRef.nativeElement.getBoundingClientRect();
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.lastPointerScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  onPointerMove(e: PointerEvent) {
    const rect = this.rootRef.nativeElement.getBoundingClientRect();
    this.lastPointerScreen = { x: e.clientX - rect.left, y: e.clientY - rect.top };

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

  onPointerLeave() {
    this.dragging = false;
    this.lastPointerScreen = null;
  }

  onDblClick() {
    this.centerOnFirstNodeOrFit();
  }

  // ===== Toolbar actions =====
  zoomIn() {
    this.applyZoom(1.15);
  }

  zoomOut() {
    this.applyZoom(1 / 1.15);
  }

  resetView() {
    this.centerOnFirstNodeOrFit();
  }

  setLinkStyle(v: string) {
    const ok = v === "orthogonal" || v === "curve" || v === "line";
    this.opt_linkStyle.set(ok ? (v as LinkStyle) : "orthogonal");
    this.relayoutVisible();
  }

  setLayoutAlign(v: string) {
    const ok = v === "firstChild" || v === "center";
    this.opt_layoutAlign.set(ok ? (v as LayoutAlign) : "center");
    this.relayoutVisible();
  }

  setLayoutDirection(v: string) {
    const ok = v === "RIGHT" || v === "DOWN";
    this.opt_layoutDirection.set(ok ? (v as LayoutDirection) : "RIGHT");
    this.relayoutVisible();
  }

  /* ========================================================================
   * Helpers
   * ===================================================================== */

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

  private ensurePinMeta(g: NormalizedGraph, s: SchemaSettings): void {
    if (!g.meta) g.meta = {};
    const dir = s.layout?.layoutDirection ?? DEFAULT_SETTINGS.layout.layoutDirection;
    const key = dir === "RIGHT" ? "pinY" : "pinX";
    if (!g.meta[key]) g.meta[key] = {};
  }

  private updateVirtualSizeFromGraph(g: NormalizedGraph): void {
    const pad = 200;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (const n of g.nodes) {
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const w = n.width ?? 0;
      const h = n.height ?? 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      this.virtualWidth = 12000;
      this.virtualHeight = 6000;
      return;
    }

    const neededW = Math.max(1, Math.ceil(maxX - Math.min(0, minX)) + pad);
    const neededH = Math.max(1, Math.ceil(maxY - Math.min(0, minY)) + pad);

    this.virtualWidth = Math.max(neededW, 2000);
    this.virtualHeight = Math.max(neededH, 1200);
  }

  private buildIndices(): void {
    this.childrenById.clear();
    this.parentsById.clear();
    const g = this.fullGraph();

    for (const n of g.nodes) {
      this.childrenById.set(n.id, []);
      this.parentsById.set(n.id, []);
    }
    for (const e of g.edges) {
      const ch = this.childrenById.get(e.source);
      if (ch) ch.push(e.target);

      const pr = this.parentsById.get(e.target);
      if (pr) pr.push(e.source);
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

  private measureAndApply(pass: number): boolean {
    const s = this.effectiveSettings();
    const extraW = s.dataView?.paddingWidthPx ?? 0;
    const extraH = s.dataView?.paddingHeightPx ?? 0;
    const maxW = s.dataView?.maxCardWidth ?? Infinity;
    const maxH = s.dataView?.maxCardHeight ?? Infinity;

    const root = this.rootRef.nativeElement;
    const cards = Array.from(root.querySelectorAll<HTMLElement>(".schema-card"));

    const visMap = new Map(this.graph().nodes.map((n) => [n.id, n]));
    const fullMap = new Map(this.fullGraph().nodes.map((n) => [n.id, n]));

    let changed = false;
    const idsToMeasure = pass === 1 ? null : this.measureIdsToCheck;
    const nextChanged = new Set<string>();

    const measures: Array<{ id: string; w: number; h: number }> = [];

    for (const el of cards) {
      const id = el.getAttribute("data-node-id") ?? undefined;
      if (!id) continue;
      if (idsToMeasure && !idsToMeasure.has(id)) continue;

      const node = visMap.get(id);
      if (!node) continue;

      const prevW = el.style.width;
      const prevH = el.style.height;

      el.style.width = "auto";
      el.style.height = "auto";

      const wIntrinsic = Math.ceil(el.scrollWidth);
      const hIntrinsic = Math.ceil(el.scrollHeight);

      el.style.width = prevW;
      el.style.height = prevH;

      const targetW = Math.min(wIntrinsic + extraW, maxW);
      const targetH = Math.min(hIntrinsic + extraH, maxH);
      measures.push({ id, w: targetW, h: targetH });
    }

    for (const m of measures) {
      const node = visMap.get(m.id);
      if (!node) continue;
      if ((node.width ?? 0) !== m.w || (node.height ?? 0) !== m.h) {
        node.width = m.w;
        node.height = m.h;
        changed = true;
        nextChanged.add(m.id);

        const full = fullMap.get(m.id);
        if (full) {
          full.width = m.w;
          full.height = m.h;
        }
      }
    }

    this.measureIdsToCheck = nextChanged.size ? nextChanged : null;
    return changed;
  }

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
      const nx = n.x ?? 0;
      const ny = n.y ?? 0;
      const nw = n.width ?? 0;
      const nh = n.height ?? 0;
      minX = Math.min(minX, nx);
      minY = Math.min(minY, ny);
      maxX = Math.max(maxX, nx + nw);
      maxY = Math.max(maxY, ny + nh);
    }
    return { minX, minY, maxX, maxY };
  }

  private computeScaleToFit(pad = 24) {
    const { w, h } = this.getViewportSize();
    const { minX, minY, maxX, maxY } = this.getGraphBounds();
    const gw = Math.max(1, maxX - minX);
    const gh = Math.max(1, maxY - minY);

    const sx = (w - pad) / gw;
    const sy = (h - pad) / gh;
    const fit = Math.max(0.05, Math.min(sx, sy));

    return { fit, minX, minY, maxX, maxY, w, h };
  }

  private fitToViewByBounds() {
    const { fit, minX, minY, maxX, maxY, w, h } = this.computeScaleToFit(24);
    this.minScale.set(Math.min(fit, 1));
    this.scale.set(Math.max(this.scale(), this.minScale()));

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const s = this.scale();
    this.tx.set(w / 2 - cx * s);
    this.ty.set(h / 2 - cy * s);
  }

  /** Zoom anclado al último punto de interacción sobre la stage; si no hay, usa el centro del viewport. */
  private applyZoom(factor: number) {
    const rect = this.rootRef.nativeElement.getBoundingClientRect();
    const anchor = this.lastPointerScreen ?? { x: rect.width / 2, y: rect.height / 2 };

    const oldScale = this.scale();
    const newScale = Math.max(this.minScale(), Math.min(this.maxScale(), oldScale * factor));

    const worldX = (anchor.x - this.tx()) / oldScale;
    const worldY = (anchor.y - this.ty()) / oldScale;
    this.tx.set(anchor.x - worldX * newScale);
    this.ty.set(anchor.y - worldY * newScale);
    this.scale.set(newScale);
  }

  private preserveCenterOnResize(newW: number, newH: number) {
    if (!this.lastViewport) {
      this.lastViewport = { w: newW, h: newH };
      return;
    }
    const oldW = this.lastViewport.w;
    const oldH = this.lastViewport.h;

    const s = this.scale();
    const worldCx = (oldW / 2 - this.tx()) / s;
    const worldCy = (oldH / 2 - this.ty()) / s;

    this.tx.set(newW / 2 - worldCx * s);
    this.ty.set(newH / 2 - worldCy * s);

    this.lastViewport = { w: newW, h: newH };
  }

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
    this.centerOnNodeAtScreen(n, targetScreen);
  }

  private getFirstVisibleNode(): SchemaNode | null {
    const list = this.nodes();
    return list.length ? list[0] : null;
  }

  private centerOnNode(n: SchemaNode): void {
    const rect = this.rootRef.nativeElement.getBoundingClientRect();
    const viewportCx = rect.width / 2;
    const viewportCy = rect.height / 2;

    const s = this.scale();
    const nodeCx = (n.x ?? 0) + (n.width ?? 0) / 2;
    const nodeCy = (n.y ?? 0) + (n.height ?? 0) / 2;

    this.tx.set(viewportCx - nodeCx * s);
    this.ty.set(viewportCy - nodeCy * s);
  }

  /** Centra un nodo de forma que su centro quede en una posición de pantalla dada (x,y). */
  private centerOnNodeAtScreen(n: SchemaNode, screen: { x: number; y: number }): void {
    const s = this.scale();
    const nodeCx = (n.x ?? 0) + (n.width ?? 0) / 2;
    const nodeCy = (n.y ?? 0) + (n.height ?? 0) / 2;
    this.tx.set(screen.x - nodeCx * s);
    this.ty.set(screen.y - nodeCy * s);
  }

  private centerOnFirstNodeOrFit(): void {
    const first = this.getFirstVisibleNode();
    if (first) this.centerOnNode(first);
    else this.fitToViewByBounds();
  }

  trackByNodeId = (_: number, n: SchemaNode) => n?.id;
}
