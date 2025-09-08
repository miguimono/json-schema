// ============================================
// projects/schema/src/lib/schema.component.ts
// ============================================
// Visor del esquema: orquesta normalización → layout → render de cards y links,
// y provee interacción (pan/zoom/fit). Este archivo incluye documentación JSDoc
// de entradas, salidas y métodos públicos/privados. No modifica la lógica.
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
  // ===========================
  // Inputs
  // ===========================

  /** JSON (o sub-árbol) a graficar. */
  data = input<any>();

  /** Opciones de configuración del grafo/render. */
  options = input<SchemaOptions>(DEFAULT_OPTIONS);

  /** Color del trazo de los enlaces (SVG stroke). */
  linkStroke = input<string>(DEFAULT_OPTIONS.linkStroke!);

  /** Grosor del trazo de los enlaces (SVG stroke-width). */
  linkStrokeWidth = input<number>(DEFAULT_OPTIONS.linkStrokeWidth!);

  /**
   * Template opcional para personalizar el contenido de cada card.
   * Si es `null`, se usa el template por defecto de la librería.
   */
  cardTemplate = input<TemplateRef<any> | null>(null);

  // ===========================
  // Outputs
  // ===========================

  /** Evento de click sobre un nodo (card). */
  @Output() nodeClick = new EventEmitter<SchemaNode>();

  /** Evento de click sobre un enlace (path). */
  @Output() linkClick = new EventEmitter<SchemaEdge>();

  // ===========================
  // Estado interno (signals)
  // ===========================

  /** Grafo normalizado y con layout aplicado. */
  private graph = signal<NormalizedGraph>({ nodes: [], edges: [] });

  /** Lista reactiva de nodos (derivada). */
  nodes = computed(() => this.graph().nodes);

  /** Lista reactiva de aristas (derivada). */
  edges = computed(() => this.graph().edges);

  /** Referencia al contenedor raíz para medir viewport y escuchar interacción. */
  @ViewChild('root', { static: true }) rootRef!: ElementRef<HTMLElement>;

  /** Escala de zoom actual. */
  private scale = signal(1);

  /**
   * Escala mínima permitida. Se recalcula tras layout/medición para que el grafo
   * completo entre en el viewport (fitToView).
   */
  private minScale = signal(0.2);

  /** Escala máxima permitida para zoom-in. */
  private maxScale = signal(3);

  /** Traslación X (pan) en píxeles. */
  private tx = signal(0);

  /** Traslación Y (pan) en píxeles. */
  private ty = signal(0);

  /** Transform CSS aplicado a la “stage”: translate(tx,ty) scale(s). */
  transform = computed(
    () => `translate(${this.tx()}px, ${this.ty()}px) scale(${this.scale()})`
  );

  /** Dimensiones del lienzo virtual donde se dibuja el SVG y las cards. */
  virtualWidth = 4000;
  virtualHeight = 2000;

  /** Estado de drag para pan. */
  private dragging = false;

  /** Última posición del puntero (para calcular deltas de pan). */
  private lastX = 0;
  private lastY = 0;

  constructor(
    private adapter: JsonAdapterService,
    private layoutService: SchemaLayoutService
  ) {}

  // ===========================
  // Ciclo de vida
  // ===========================

  /** Inicializa el cómputo del grafo tras montar la vista. */
  ngAfterViewInit(): void {
    this.compute();
  }

  /** Recalcula el grafo cuando cambian inputs (data/options/etc.). */
  ngOnChanges(_: SimpleChanges): void {
    this.compute();
  }

  // ===========================
  // Pipeline principal
  // ===========================

  /**
   * Normaliza los datos, ejecuta el layout, actualiza el grafo y ajusta la vista.
   * 1) `JsonAdapterService.normalize` → grafo base
   * 2) `SchemaLayoutService.layout` → posiciones (x,y,w,h) y puntos de aristas
   * 3) Medición real de cards en DOM → si cambian tamaños, relayout
   * 4) `fitToView()` para encajar todo en el viewport
   */
  private async compute(): Promise<void> {
    const normalized = this.adapter.normalize(this.data(), this.options());
    let laid = await this.layoutService.layout(normalized, this.options());
    this.graph.set(laid);

    // Medición de cards y realayout si hay cambios de tamaño
    await queueMicrotask(async () => {
      const root = this.rootRef.nativeElement;
      const cards = Array.from(
        root.querySelectorAll<HTMLElement>('.schema-card')
      );
      let changed = false;

      // mapa por id (referencia útil si se enlaza __nodeId en el futuro)
      const nodeMap = new Map(this.graph().nodes.map((n) => [n.id, n]));

      for (const el of cards) {
        // Nota: hoy no se setea __nodeId en el DOM; se usa la coincidencia por posición.
        const rect = el.getBoundingClientRect();
        const match = this.graph().nodes.find(
          (n) =>
            Math.abs((n.x ?? 0) - (el.offsetLeft ?? 0)) < 2 &&
            Math.abs((n.y ?? 0) - (el.offsetTop ?? 0)) < 2
        );
        if (!match) continue;

        const w = Math.ceil(el.scrollWidth);
        const h = Math.ceil(el.scrollHeight);
        if ((match.width ?? 0) !== w || (match.height ?? 0) !== h) {
          match.width = w;
          match.height = h;
          changed = true;
        }
      }

      if (changed) {
        laid = await this.layoutService.layout(
          { ...this.graph() },
          this.options()
        );
        this.graph.set(laid);
      }

      // Ajustar zoom mínimo y centrar con padding
      this.fitToView();
    });
  }

  // ===========================
  // Cálculos de viewport / encuadre
  // ===========================

  /** Devuelve el tamaño visible (px) del contenedor raíz. */
  private getViewportSize() {
    const el = this.rootRef.nativeElement;
    const rect = el.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }

  /** Calcula el bounding-box del grafo considerando posición y tamaño de cada nodo. */
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
   * Ajusta `minScale` y centra el grafo en el viewport con un padding fijo.
   * No fuerza zoom > 1; respeta el zoom actual si ya es mayor al mínimo requerido.
   */
  private fitToView() {
    const { w, h } = this.getViewportSize();
    const { minX, minY, maxX, maxY } = this.getGraphBounds();
    const gw = Math.max(1, maxX - minX);
    const gh = Math.max(1, maxY - minY);
    const pad = 24;

    // escala mínima necesaria para encajar el grafo
    const sx = (w - pad) / gw;
    const sy = (h - pad) / gh;
    const s = Math.max(0.05, Math.min(sx, sy));

    this.minScale.set(Math.min(s, 1)); // no forzar a > 1
    this.scale.set(Math.max(this.scale(), this.minScale())); // mantener zoom >= min

    // centrar “primer nodo” con padding (anclaje a la izquierda)
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

  /**
   * Zoom con rueda del mouse, centrado en el cursor del usuario.
   * @param e WheelEvent
   */
  onWheel(e: WheelEvent) {
    e.preventDefault();
    const root = this.rootRef.nativeElement;
    const rect = root.getBoundingClientRect();
    const mouseX = e.clientX - rect.left; // coords relativas al root
    const mouseY = e.clientY - rect.top;

    const oldScale = this.scale();
    const delta = -e.deltaY;
    const factor = 1 + (delta > 0 ? 0.08 : -0.08);
    const newScale = Math.max(
      this.minScale(),
      Math.min(this.maxScale(), oldScale * factor)
    );

    // Convertir punto pantalla → mundo, y mantenerlo estable tras el zoom
    const worldX = (mouseX - this.tx()) / oldScale;
    const worldY = (mouseY - this.ty()) / oldScale;
    this.tx.set(mouseX - worldX * newScale);
    this.ty.set(mouseY - worldY * newScale);
    this.scale.set(newScale);
  }

  /**
   * Inicia el drag para pan.
   * @param e MouseEvent
   */
  onPointerDown(e: MouseEvent) {
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  /**
   * Actualiza la traslación (pan) durante el drag.
   * @param e MouseEvent
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

  /** Finaliza el drag para pan. */
  onPointerUp() {
    this.dragging = false;
  }

  /**
   * Doble click: reposiciona la vista para alinear el primer nodo con padding.
   * Mantiene el zoom actual.
   */
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
  /**
   * Aplica un zoom relativo manteniendo estable un punto de origen en pantalla.
   * @param factor >1 para zoom in, <1 para zoom out
   * @param origin punto {x,y} en coords relativas al root; por defecto, centro del viewport
   */
  public zoomBy(factor: number, origin?: { x: number; y: number }) {
    const root = this.rootRef?.nativeElement;
    if (!root) return;

    const rect = root.getBoundingClientRect();
    const mouseX = origin?.x ?? rect.width / 2;
    const mouseY = origin?.y ?? rect.height / 2;

    const oldScale = this.scale();
    const newScale = Math.max(
      this.minScale(),
      Math.min(this.maxScale(), oldScale * factor)
    );

    // Mantener fijo el punto de origen (pantalla → mundo → pantalla)
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
