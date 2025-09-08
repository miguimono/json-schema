// ============================================
// projects/schema/src/lib/schema.component.ts
// v0.3.7-debug — logs detallados + forceMeasure() + clonación de nodos
// ============================================

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
import { CommonModule, NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import { SchemaCardComponent } from '../schema-card/schema-card.component';
import { SchemaLinksComponent } from '../schema-links/schema-links.component';

@Component({
  selector: 'schema',
  standalone: true,
  imports: [
    CommonModule,
    NgFor,
    NgIf,
    NgTemplateOutlet,
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
    >
      <div class="stage" [style.transform]="transform()">
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
        width: 4000px;
        height: 2000px;
        transform-origin: 0 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaComponent implements AfterViewInit, OnChanges {
  // Inputs
  data = input<any>();
  options = input<SchemaOptions>(DEFAULT_OPTIONS);
  linkStroke = input<string>(DEFAULT_OPTIONS.linkStroke!);
  linkStrokeWidth = input<number>(DEFAULT_OPTIONS.linkStrokeWidth!);
  cardTemplate = input<TemplateRef<any> | null>(null);

  // Outputs
  @Output() nodeClick = new EventEmitter<SchemaNode>();
  @Output() linkClick = new EventEmitter<SchemaEdge>();

  // State
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

  virtualWidth = 4000;
  virtualHeight = 2000;

  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  ngAfterViewInit(): void {
    this.compute();
    if (this.options().debug?.exposeOnWindow) {
      (window as any).schemaDebug = this;
      // útil para inspección manual en consola
      console.info('schemaDebug expuesto en window.schemaDebug');
    }
  }
  ngOnChanges(_: SimpleChanges): void {
    this.compute();
  }

  // ===== Pipeline =====
  private async compute(): Promise<void> {
    const opts = this.options();

    // 1) normalizar + layout inicial
    const normalized = this.adapter.normalize(this.data(), opts);
    let laid = await this.layoutService.layout(normalized, opts);
    this.graph.set(this.cloneGraph(laid));

    if (!opts.autoResizeCards) {
      this.fitToView();
      return;
    }

    // 2) medir → clonar nodos → relayout (hasta 2 pases)
    await this.nextFrame();
    const changed1 = this.measureAndCloneNodes({
      pass: 1,
      log: !!opts.debug?.measure,
    });
    if (changed1) {
      if (opts.debug?.layout)
        console.groupCollapsed('[layout] relayout pass #1');
      laid = await this.layoutService.layout(this.graph(), opts);
      this.graph.set(this.cloneGraph(laid));
      if (opts.debug?.layout) console.groupEnd();

      await this.nextFrame();
      const changed2 = this.measureAndCloneNodes({
        pass: 2,
        log: !!opts.debug?.measure,
      });
      if (changed2) {
        if (opts.debug?.layout)
          console.groupCollapsed('[layout] relayout pass #2');
        laid = await this.layoutService.layout(this.graph(), opts);
        this.graph.set(this.cloneGraph(laid));
        if (opts.debug?.layout) console.groupEnd();
      }
    }

    this.fitToView();
  }

  constructor(
    private adapter: JsonAdapterService,
    private layoutService: SchemaLayoutService
  ) {}

  /** Mide .schema-card y sustituye nodes por NUEVAS referencias. */
  private measureAndCloneNodes(opts: { pass: number; log: boolean }): boolean {
    const root = this.rootRef.nativeElement;
    const cards = Array.from(
      root.querySelectorAll<HTMLElement>('.schema-card')
    );
    const nodeMap = new Map(this.graph().nodes.map((n) => [n.id, n]));
    let changed = false;

    const rows: any[] = [];

    for (const el of cards) {
      const id = el.getAttribute('data-node-id') ?? '';
      const n = nodeMap.get(id);
      if (!n) continue;

      const sw = Math.ceil(el.scrollWidth);
      const sh = Math.ceil(el.scrollHeight);
      const cw = Math.ceil(el.clientWidth);
      const ch = Math.ceil(el.clientHeight);
      const ow = Math.ceil(el.offsetWidth);
      const oh = Math.ceil(el.offsetHeight);

      // límites
      let w = sw,
        h = sh;
      const maxW = this.options().maxCardWidth ?? null;
      const maxH = this.options().maxCardHeight ?? null;
      if (maxW && w > maxW) w = maxW;
      if (maxH && h > maxH) h = maxH;
      w = Math.max(140, w);
      h = Math.max(56, h);

      const beforeW = n.width ?? 0;
      const beforeH = n.height ?? 0;
      const changedThis = beforeW !== w || beforeH !== h;
      if (changedThis) changed = true;

      rows.push({
        pass: opts.pass,
        id,
        nodeW_before: beforeW,
        nodeH_before: beforeH,
        scrollW: sw,
        scrollH: sh,
        clientW: cw,
        clientH: ch,
        offsetW: ow,
        offsetH: oh,
        nodeW_after: w,
        nodeH_after: h,
        changed: changedThis,
      });
    }

    if (opts.log && rows.length) {
      console.groupCollapsed(
        `[measure] pass #${opts.pass} — ${
          rows.filter((r) => r.changed).length
        } cambios`
      );
      console.table(rows);
      console.groupEnd();
    }

    if (!changed) return false;

    // Clonar nodos con nuevos tamaños
    const newNodes = this.graph().nodes.map((n) => {
      const row = rows.find((r) => r.id === n.id && r.changed);
      return row
        ? { ...n, width: row.nodeW_after, height: row.nodeH_after }
        : { ...n };
    });
    this.graph.set({ ...this.graph(), nodes: newNodes });
    return true;
  }

  private cloneGraph(g: NormalizedGraph): NormalizedGraph {
    return {
      nodes: g.nodes.map((n) => ({ ...n })),
      edges: g.edges.map((e) => ({ ...e })),
      meta: g.meta ? { ...g.meta } : {},
    };
  }

  /** Fuerza una medición y relayout manual (útil desde consola). */
  public async forceMeasure() {
    await this.nextFrame();
    const changed = this.measureAndCloneNodes({ pass: 0, log: true });
    if (changed) {
      if (this.options().debug?.layout)
        console.groupCollapsed('[layout] relayout (forceMeasure)');
      const laid = await this.layoutService.layout(
        this.graph(),
        this.options()
      );
      this.graph.set(this.cloneGraph(laid));
      if (this.options().debug?.layout) console.groupEnd();
    } else {
      console.info('[forceMeasure] sin cambios de tamaño detectados');
    }
  }

  private nextFrame(): Promise<void> {
    return new Promise((res) => requestAnimationFrame(() => res()));
  }

  // ===== Viewport / encuadre =====
  private getViewportSize() {
    const rect = this.rootRef.nativeElement.getBoundingClientRect();
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
      const s2 = this.scale();
      this.tx.set(pad - (first.x ?? 0) * s2);
      this.ty.set(pad - (first.y ?? 0) * s2);
    }
  }

  // ===== Interacción =====
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
    const pad = 24,
      s = this.scale();
    this.tx.set(pad - (first.x ?? 0) * s);
    this.ty.set(pad - (first.y ?? 0) * s);
  }

  // API pública
  public zoomBy(factor: number, origin?: { x: number; y: number }) {
    const rect = this.rootRef?.nativeElement.getBoundingClientRect();
    if (!rect) return;
    const mouseX = origin?.x ?? rect.width / 2;
    const mouseY = origin?.y ?? rect.height / 2;

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
  public zoomIn() {
    this.zoomBy(1.1);
  }
  public zoomOut() {
    this.zoomBy(1 / 1.1);
  }
  public resetView() {
    this.onDblClick();
  }
}
