// projects/schema/src/lib/components/schema.component.ts
// ----------------------------------------------------
// Cambios principales para colapso/expansión:
// - Nuevo flag de settings: dataView.enableCollapse (por defecto false).
// - Cuando está desactivado: se muestra TODO el grafo y NO hay botones (idéntico a antes).
// - Cuando está activado: todo se ve inicialmente igual, pero aparece un botón en cada card
//   con hijos; al colapsar un nodo, se ocultan TODOS sus descendientes. Al expandir, vuelven.
// - La visibilidad depende de que NINGÚN ancestro esté colapsado.
//
// Métodos nuevos:
// - buildIndices(): construye childrenById/parentsById sobre el grafo completo.
// - isVisibleNodeByCollapsedAncestors(id): true si ningún ancestro está en `collapsed`.
// - buildVisibleGraphFromCollapsed(): devuelve subgrafo filtrado por colapsos.
// - onCardToggle(n): alterna estado en Set `collapsed` y relanza layout del subgrafo visible.
// - isNodeCollapsed(id): expone al hijo el estado de colapso (para girar el ícono).
//
// NOTA: El pipeline de layout/measure/relayout se mantiene.
//       Si enableCollapse=false, no se filtra nada (grafo=fullGraph).

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

/**
 * Orquestador principal del render del grafo a partir de un JSON arbitrario.
 *
 * ### Responsabilidades
 * - Normaliza el JSON → grafo con {@link JsonAdapterService}.
 * - Calcula posiciones y puntos de aristas con {@link SchemaLayoutService}.
 * - Renderiza **cards** (`SchemaCardComponent`) y **links** (`SchemaLinksComponent`).
 * - Gestiona **pan/zoom**, auto-resize de cards y encuadre del grafo.
 * - Opcional: **colapso/expansión por card** cuando `settings.dataView.enableCollapse = true`.
 *   - Al colapsar un nodo, se ocultan sus **descendientes** (no el propio nodo).
 *   - La visibilidad depende de que **ningún ancestro** esté colapsado.
 *
 * ### Entradas principales
 * - `data`: JSON de origen (requerido).
 * - `settings`: {@link SchemaSettings} para configurar apariencia y comportamiento.
 * - `options`: {@link SchemaOptions} (back-compat; se fusiona con `settings` y `DEFAULT_OPTIONS`).
 * - `cardTemplate`: Template personalizado para el contenido de la card.
 *
 * ### Salidas
 * - `nodeClick(SchemaNode)`: click en una card.
 * - `linkClick(SchemaEdge)`: click en una arista.
 *
 * ### Estados/Overlays
 * - `isLoading / isError` (o `settings.messages.isLoading / isError`) controlan overlays.
 * - Mensajes personalizables: `emptyMessage`, `loadingMessage`, `errorMessage`.
 *
 * ### Viewport / Interacción
 * - Pan con mouse drag en el stage.
 * - Zoom con rueda del mouse (centrado bajo el cursor).
 * - Doble click: **centra el nodo raíz** en el viewport.
 * - Toolbar opcional: zoom+/zoom−/centrar y selectores de estilo de link y alineación.
 */
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

  /**
   * JSON de entrada a visualizar. Puede ser cualquier estructura válida.
   * @required
   */
  data = input<any>(); // único obligatorio

  /**
   * Settings organizados por secciones (recomendado).
   * Se fusionan internamente para producir `effectiveOptions`.
   */
  settings = input<SchemaSettings | null>(null);

  /**
   * Back-compat: opciones planas (anteriores a settings).
   * Se fusionan con `DEFAULT_OPTIONS` y `settings`.
   */
  options = input<SchemaOptions>(DEFAULT_OPTIONS);

  /**
   * Template de card custom (opcional). Recibe el nodo como `$implicit`.
   */
  cardTemplate = input<TemplateRef<any> | null>(null);

  // Mensajes/estados (pueden venir por settings.messages también)

  /** Indica estado de carga (overlay). */
  isLoading = input<boolean>(false);
  /** Indica estado de error (overlay). */
  isError = input<boolean>(false);
  /** Mensaje de estado vacío. */
  emptyMessage = input<string>('No hay datos para mostrar');
  /** Mensaje de carga. */
  loadingMessage = input<string>('Cargando…');
  /** Mensaje de error. */
  errorMessage = input<string>('Error al cargar el esquema');

  // Viewport (pueden venir por settings.viewport)

  /** Altura del viewport del esquema. */
  viewportHeight = signal<number>(800);
  /** Altura mínima del viewport. */
  minViewportHeight = signal<number>(480);
  /** Muestra/oculta toolbar integrada. */
  showToolbar = signal<boolean>(true);

  // ===== Outputs =====

  /**
   * Emitido cuando el usuario hace click en una card (nodo).
   */
  @Output() nodeClick = new EventEmitter<SchemaNode>();

  /**
   * Emitido cuando el usuario hace click en una arista.
   */
  @Output() linkClick = new EventEmitter<SchemaEdge>();

  // ===== Estado: full graph y visible graph =====

  /**
   * Grafo **completo** normalizado (sin filtrado por colapsos).
   */
  private fullGraph = signal<NormalizedGraph>({ nodes: [], edges: [] });

  /**
   * Grafo **visible** (filtrado por colapsos si aplica).
   */
  private graph = signal<NormalizedGraph>({ nodes: [], edges: [] });

  /** Nodos visibles (memoizado). */
  nodes = computed(() => this.graph().nodes);
  /** Aristas visibles (memoizado). */
  edges = computed(() => this.graph().edges);

  /** Referencia al elemento raíz para medir viewport y stage. */
  @ViewChild('root', { static: true }) rootRef!: ElementRef<HTMLElement>;

  // ===== Pan/zoom =====

  /** Escala actual (zoom). */
  private scale = signal(1);
  /** Escala mínima permitida (ajustada por fitToView). */
  private minScale = signal(0.2);
  /** Escala máxima permitida. */
  private maxScale = signal(3);
  /** Traslación X del stage. */
  private tx = signal(0);
  /** Traslación Y del stage. */
  private ty = signal(0);

  /** Transform CSS aplicada al stage. */
  transform = computed(
    () => `translate(${this.tx()}px, ${this.ty()}px) scale(${this.scale()})`
  );

  /** Tamaño virtual del canvas (coherente con SchemaLinks). */
  virtualWidth = 12000;
  /** Tamaño virtual del canvas (coherente con SchemaLinks). */
  virtualHeight = 6000;

  /** Flag de arrastre en curso. */
  private dragging = false;
  /** Última posición X del mouse durante drag. */
  private lastX = 0;
  /** Última posición Y del mouse durante drag. */
  private lastY = 0;

  // Controles de toolbar (valores actuales)

  /** Estilo de link actual para el selector de toolbar. */
  opt_linkStyle = signal<'orthogonal' | 'curve' | 'line'>('orthogonal');
  /** Alineación padre ↔ hijos actual para el selector de toolbar. */
  opt_layoutAlign = signal<'firstChild' | 'center'>('center');

  // ======= Derivados (no escribimos sobre inputs) =======

  /** Vista: estado de carga (prioriza settings.messages.isLoading). */
  isLoadingView = computed(
    () => this.settings()?.messages?.isLoading ?? this.isLoading()
  );
  /** Vista: estado de error (prioriza settings.messages.isError). */
  isErrorView = computed(
    () => this.settings()?.messages?.isError ?? this.isError()
  );
  /** Vista: mensaje vacío (prioriza settings.messages.emptyMessage). */
  emptyMessageView = computed(
    () => this.settings()?.messages?.emptyMessage ?? this.emptyMessage()
  );
  /** Vista: mensaje de carga (prioriza settings.messages.loadingMessage). */
  loadingMessageView = computed(
    () => this.settings()?.messages?.loadingMessage ?? this.loadingMessage()
  );
  /** Vista: mensaje de error (prioriza settings.messages.errorMessage). */
  errorMessageView = computed(
    () => this.settings()?.messages?.errorMessage ?? this.errorMessage()
  );

  // ===== Colapso/expansión =====

  /**
   * Índices hijos por id (sobre el **grafo completo**).
   * @example childrenById.get(parentId) => string[] de ids hijos
   */
  private childrenById = new Map<string, string[]>();

  /**
   * Índices padres por id (sobre el **grafo completo**).
   * @example parentsById.get(childId) => string[] de ids padres
   */
  private parentsById = new Map<string, string[]>();

  /**
   * Conjunto de ids de nodos **colapsados**.
   * - Un nodo colapsado **oculta sus descendientes** en el subgrafo visible.
   */
  private collapsed = new Set<string>();

  /**
   * Flag derivado: si está habilitado el colapso por card.
   * (proxy de `settings.dataView.enableCollapse`)
   */
  enableCollapse = computed<boolean>(
    () => !!this.settings()?.dataView?.enableCollapse
  );

  constructor(
    private adapter: JsonAdapterService,
    private layoutService: SchemaLayoutService
  ) {}

  // ===== Merge de settings → options + UI =====

  /**
   * Recalcula parámetros de viewport y sincroniza controles de toolbar
   * en base a `settings` y a las opciones efectivas.
   */
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

  /**
   * Opciones efectivas resultantes del merge:
   * - `DEFAULT_OPTIONS` + `options()` + `settings.colors/layout/dataView/debug`
   * - Además respeta selectores de toolbar (linkStyle/layoutAlign).
   */
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
      showColorNull:
        s.colors?.showColorNull ??
        flat.showColorNull ??
        DEFAULT_OPTIONS.showColorNull,
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

  /** Inicializa settings efectivos y dispara el pipeline de cómputo. */
  ngAfterViewInit(): void {
    this.recomputeEffectiveSettings();
    this.compute();
  }

  /** Reacciona a cambios en inputs para recomputar settings y grafo. */
  ngOnChanges(_: SimpleChanges): void {
    this.recomputeEffectiveSettings();
    this.compute();
  }

  // ===== Internos =====

  /**
   * Clona un grafo (nodos/aristas/meta) para evitar mutaciones por referencia.
   */
  private cloneGraph(g: NormalizedGraph): NormalizedGraph {
    return {
      nodes: g.nodes.map((n) => ({ ...n })),
      edges: g.edges.map((e) => ({ ...e })),
      meta: { ...(g.meta ?? {}) },
    };
  }

  /**
   * Espera al próximo frame de animación (requestAnimationFrame).
   */
  private nextFrame(): Promise<void> {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }

  /**
   * Reconstruye índices hijos/padres sobre el grafo completo para soportar colapso.
   * - `childrenById`: parentId → [childId...]
   * - `parentsById`:  childId → [parentId...]
   */
  private buildIndices(): void {
    this.childrenById.clear();
    this.parentsById.clear();
    const g = this.fullGraph();
    for (const n of g.nodes) {
      this.childrenById.set(n.id, []);
      this.parentsById.set(n.id, []);
    }
    for (const e of g.edges) {
      this.childrenById.get(e.source)?.push(e.target);
      this.parentsById.get(e.target)?.push(e.source);
    }
  }

  /**
   * Determina si un nodo es visible según colapsos:
   * - Es visible si **ningún ancestro** está en `collapsed`.
   */
  private isVisibleNodeByCollapsedAncestors(id: string): boolean {
    if (!this.enableCollapse()) return true; // sin colapso, todo visible
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

  /**
   * Construye el **subgrafo visible** filtrado por colapsos.
   * - Si `enableCollapse=false`, retorna el grafo completo.
   */
  private buildVisibleGraphFromCollapsed(): NormalizedGraph {
    const full = this.fullGraph();
    if (!this.enableCollapse()) return this.cloneGraph(full);

    const visibleNodeSet = new Set<string>();
    for (const n of full.nodes) {
      if (this.isVisibleNodeByCollapsedAncestors(n.id))
        visibleNodeSet.add(n.id);
    }
    const nodes = full.nodes.filter((n) => visibleNodeSet.has(n.id));
    const edges = full.edges.filter(
      (e) => visibleNodeSet.has(e.source) && visibleNodeSet.has(e.target)
    );
    return { nodes, edges, meta: full.meta };
  }

  // ===== Toggle de colapso con anclaje de posición =====

  /**
   * Alterna colapso/expansión de un nodo:
   * - Ancla temporalmente la posición de pantalla del nodo clicado.
   * - Recalcula el subgrafo visible y su layout (con medición si está activa).
   * - **Anima** desde el estado actual al estado final manteniendo el anclaje.
   *
   * @param n Nodo objetivo del toggle.
   */
  async onCardToggle(n: SchemaNode): Promise<void> {
    if (!this.enableCollapse() || !n?.id) return;

    // 1) Posición en pantalla ANTES (anclaje)
    const anchorBefore = this.getNodeScreenCenter(n);

    // 2) Alternar colapso
    if (this.collapsed.has(n.id)) this.collapsed.delete(n.id);
    else this.collapsed.add(n.id);

    // 3) Recalcular subgrafo visible + layout final (sin tocar aún this.graph)
    const opts = this.effectiveOptions();
    const dbgMeasure = !!opts.debug?.measure;

    const visible = this.buildVisibleGraphFromCollapsed();
    let laid = await this.layoutService.layout(visible, opts);

    if (opts.autoResizeCards) {
      const maxPasses = 4;
      for (let pass = 1; pass <= maxPasses; pass++) {
        await this.nextFrame();
        // medimos sobre el estado ACTUAL en pantalla para afinar tamaños
        // (esto no cambia todavía laid; solo da medidas para el siguiente layout)
        const changed = this.measureAndApply(pass, dbgMeasure);
        if (!changed) break;
        laid = await this.layoutService.layout(visible, opts);
      }
    }

    // 4) Animación suave hacia el layout final, anclando el nodo clicado
    await this.animateToGraph(laid, 260, n.id, anchorBefore);
  }

  /**
   * Indica si un nodo tiene hijos en el grafo completo (no filtrado).
   * @param id Id del nodo a consultar.
   */
  hasChildren = (id: string): boolean =>
    (this.childrenById.get(id)?.length ?? 0) > 0;

  /**
   * Indica si un nodo está actualmente marcado como **colapsado**.
   * @param id Id del nodo.
   */
  isNodeCollapsed = (id: string): boolean => this.collapsed.has(id);

  // ===== Pipeline principal =====

  /**
   * Pipeline principal de render:
   * 1) Normaliza el JSON → grafo completo.
   * 2) Construye índices hijos/padres.
   * 3) Limpia colapsados si `enableCollapse=false`.
   * 4) Construye subgrafo visible (filtrado si aplica).
   * 5) Ejecuta layout inicial y pinta.
   * 6) Si `autoResizeCards=true`, mide DOM y hace relayout hasta estabilizar.
   * 7) Encuadra el grafo al viewport (fit-to-view).
   * 8) (Opcional) expone `schemaDebug` si `debug.exposeOnWindow=true`.
   */
  private async compute(): Promise<void> {
    if (this.isLoadingView()) return;

    const opts = this.effectiveOptions();
    const dbgMeasure = !!opts.debug?.measure;

    // 1) Normalizar grafo completo
    const normalized = this.adapter.normalize(this.data(), opts);
    this.fullGraph.set(this.cloneGraph(normalized));

    // 2) Índices (para colapso)
    this.buildIndices();

    // 3) Reset de colapsados si enableCollapse=false (asegura back-compat)
    if (!this.enableCollapse()) this.collapsed.clear();

    // 4) Subgrafo visible (filtrado por colapsos si aplica)
    const visible = this.buildVisibleGraphFromCollapsed();

    // 5) Layout inicial
    let laid = await this.layoutService.layout(visible, opts);
    this.graph.set(this.cloneGraph(laid));

    if (!opts.autoResizeCards) {
      this.fitToView();
      return;
    }

    // 6) Medir DOM → relayout hasta estabilizar (máx. 6 pasadas)
    const maxPasses = 6;
    for (let pass = 1; pass <= maxPasses; pass++) {
      await this.nextFrame();
      const changed = this.measureAndApply(pass, dbgMeasure);
      if (!changed) break;
      if (opts.debug?.layout) console.log(`[schema] relayout pass #${pass}`);
      laid = await this.layoutService.layout(this.graph(), opts);
      this.graph.set(this.cloneGraph(laid));
    }

    // 7) Encuadre
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

  /**
   * Recalcula layout del **subgrafo visible** y **anima** hacia él.
   * @param anchorId (Opcional) Id de nodo a **anclar** en pantalla.
   * @param anchorScreen (Opcional) Posición de pantalla objetivo a mantener durante la animación.
   */
  private async relayoutVisible(
    anchorId?: string,
    anchorScreen?: { x: number; y: number }
  ): Promise<void> {
    const opts = this.effectiveOptions();
    const dbgMeasure = !!opts.debug?.measure;

    const visible = this.buildVisibleGraphFromCollapsed();
    let laid = await this.layoutService.layout(visible, opts);

    if (opts.autoResizeCards) {
      const maxPasses = 4;
      for (let pass = 1; pass <= maxPasses; pass++) {
        await this.nextFrame();
        const changed = this.measureAndApply(pass, dbgMeasure);
        if (!changed) break;
        laid = await this.layoutService.layout(visible, opts);
      }
    }

    await this.animateToGraph(laid, 260, anchorId, anchorScreen);
  }

  /**
   * Mide dimensiones reales de `.schema-card` en DOM y las copia a los nodos visibles.
   * @param _pass Número de pasada (informativo para logging).
   * @param _log Si `true`, habilita algunos logs de medición.
   * @returns `true` si hubo cambios en width/height de algún nodo (requiere relayout).
   */
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

  /**
   * Devuelve tamaño actual del viewport (cliente) del componente.
   */
  private getViewportSize() {
    const el = this.rootRef.nativeElement;
    const rect = el.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }

  /**
   * Calcula bounds (minX/minY/maxX/maxY) del grafo visible.
   */
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

  /**
   * Ajusta zoom y traslación para **encuadrar** el grafo visible dentro del viewport.
   * - Define `minScale` para no permitir hacer zoom-out más allá del encuadre.
   * - Posiciona el **nodo raíz** cerca del padding superior/izquierdo.
   */
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

  /**
   * Zoom con rueda del mouse, centrado bajo el cursor.
   * @param e WheelEvent del navegador.
   */
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

  /**
   * Inicia arrastre para pan del stage (excepto si se clickea el botón de colapso).
   */
  onPointerDown(e: MouseEvent) {
    this.dragging = true;
    const el = e.target as HTMLElement;
    // Evita iniciar drag al clickear el botón de colapso
    if (el && el.closest && el.closest('.collapse-btn')) {
      this.dragging = false;
      return;
    }
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  /**
   * Continúa arrastre para pan del stage.
   */
  onPointerMove(e: MouseEvent) {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.tx.set(this.tx() + dx);
    this.ty.set(this.ty() + dy);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  /**
   * Finaliza arrastre (mouse up o mouse leave).
   */
  onPointerUp() {
    this.dragging = false;
  }

  /**
   * Doble click: centra el **nodo raíz** en el **centro** del viewport actual.
   */
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

  /** Zoom-in (toolbar). */
  zoomIn() {
    this.applyZoom(1.15);
  }
  /** Zoom-out (toolbar). */
  zoomOut() {
    this.applyZoom(1 / 1.15);
  }
  /** Re-encuadra el grafo al viewport (toolbar). */
  resetView() {
    this.fitToView();
  }

  /**
   * Aplica un factor de zoom relativo, manteniendo el centro del viewport.
   * @param factor Factor multiplicativo (>1 acerca, <1 aleja).
   */
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

  /**
   * Establece el estilo de enlace actual (selector de toolbar) y relayout.
   * @param v 'orthogonal' | 'curve' | 'line'
   */
  setLinkStyle(v: string) {
    const ok = v === 'orthogonal' || v === 'curve' || v === 'line';
    this.opt_linkStyle.set(ok ? (v as any) : 'orthogonal');
    this.relayoutVisible();
  }

  /**
   * Establece la alineación padre ↔ hijos (selector de toolbar) y relayout.
   * @param v 'firstChild' | 'center'
   */
  setLayoutAlign(v: string) {
    const ok = v === 'firstChild' || v === 'center';
    this.opt_layoutAlign.set(ok ? (v as any) : 'center');
    this.relayoutVisible();
  }

  // ===== Helpers de anclaje de posición =====

  /**
   * Obtiene un nodo visible por id.
   */
  private getNodeById(id: string | undefined): SchemaNode | undefined {
    if (!id) return undefined;
    return this.graph().nodes.find((n) => n.id === id);
  }

  /**
   * Calcula el centro de un nodo en **coordenadas de pantalla** (tras transform).
   */
  private getNodeScreenCenter(n: SchemaNode): { x: number; y: number } {
    const s = this.scale();
    const cx = (n.x ?? 0) + (n.width ?? 0) / 2;
    const cy = (n.y ?? 0) + (n.height ?? 0) / 2;
    return { x: cx * s + this.tx(), y: cy * s + this.ty() };
  }

  /**
   * Ajusta `tx/ty` para que el `nodeId` quede con su centro en `targetScreen`.
   */
  private applyAnchorAfterLayout(
    nodeId: string,
    targetScreen: { x: number; y: number }
  ) {
    const n = this.getNodeById(nodeId);
    if (!n) return;
    const s = this.scale();
    const cx = (n.x ?? 0) + (n.width ?? 0) / 2;
    const cy = (n.y ?? 0) + (n.height ?? 0) / 2;
    this.tx.set(targetScreen.x - cx * s);
    this.ty.set(targetScreen.y - cy * s);
  }

  /**
   * **Anima** del grafo actual → `target` en `durationMs` ms.
   * - Interpola NODOS (x/y/width/height).
   * - Interpola ARISTAS (alineando longitud de listas de puntos).
   * - Si `anchorId` + `anchorScreen`, mantiene ese nodo anclado en pantalla.
   *
   * @param target Grafo destino (con posiciones y puntos finales).
   * @param durationMs Duración de la animación (ms).
   * @param anchorId (Opcional) Id de nodo a anclar.
   * @param anchorScreen (Opcional) Posición de pantalla para mantener anclada.
   */
  private async animateToGraph(
    target: NormalizedGraph,
    durationMs = 260,
    anchorId?: string,
    anchorScreen?: { x: number; y: number }
  ): Promise<void> {
    const start = this.cloneGraph(this.graph());

    // Índices por id
    const startNodeById = new Map(start.nodes.map((n) => [n.id, n]));
    const endNodeById = new Map(target.nodes.map((n) => [n.id, n]));
    const startEdgeById = new Map(start.edges.map((e) => [e.id, e]));
    const endEdgeById = new Map(target.edges.map((e) => [e.id, e]));

    // Funciones de ayuda
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const easeInOut = (t: number) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const alignPoints = (
      a: Array<{ x: number; y: number }> = [],
      b: Array<{ x: number; y: number }> = []
    ) => {
      const aa = a.length ? [...a] : [];
      const bb = b.length ? [...b] : [];
      const len = Math.max(aa.length, bb.length, 2);
      while (aa.length < len) aa.push(aa[aa.length - 1] ?? { x: 0, y: 0 });
      while (bb.length < len) bb.push(bb[bb.length - 1] ?? { x: 0, y: 0 });
      return { aa, bb, len };
    };

    // Ticker
    const t0 = performance.now();
    const run = (resolve: () => void) => {
      const now = performance.now();
      const raw = Math.min(1, (now - t0) / Math.max(1, durationMs));
      const t = easeInOut(raw);

      // Construimos un frame parcial
      const frame: NormalizedGraph = {
        nodes: [],
        edges: [],
        meta: { ...(target.meta ?? {}) },
      };

      // Interpolar NODOS (los que existan en destino; si alguno desaparece, simplemente ya no se pinta)
      for (const endNode of target.nodes) {
        const s = startNodeById.get(endNode.id) ?? endNode; // si no existía antes, “nace” desde su destino (sin ghosting)
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

      // Interpolar ARISTAS (por id)
      for (const endEdge of target.edges) {
        const s = startEdgeById.get(endEdge.id) ?? endEdge;
        const { aa, bb, len } = alignPoints(s.points, endEdge.points);
        const pts = new Array(len).fill(0).map((_, i) => ({
          x: lerp(aa[i].x, bb[i].x, t),
          y: lerp(aa[i].y, bb[i].y, t),
        }));
        frame.edges.push({ ...endEdge, points: pts });
      }

      // Pintar frame
      this.graph.set(frame);

      // Re-anclar viewport si aplica
      if (anchorId && anchorScreen) {
        this.applyAnchorAfterLayout(anchorId, anchorScreen);
      }

      if (raw < 1) {
        requestAnimationFrame(() => run(resolve));
      } else {
        // Al final, fijamos exactamente el grafo destino (evita redondeos acumulados)
        this.graph.set(this.cloneGraph(target));
        if (anchorId && anchorScreen) {
          this.applyAnchorAfterLayout(anchorId, anchorScreen);
        }
        resolve();
      }
    };

    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => run(resolve))
    );
  }
}
