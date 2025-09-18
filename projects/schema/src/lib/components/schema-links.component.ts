// projects/schema/src/lib/components/schema-links.component.ts
// ==========================================================
// SchemaLinksComponent (sin SchemaOptions)
// - Migrado a SchemaSettings + DEFAULT_SETTINGS.
// - Aplana settings relevantes con un computed `view`.
// - Mantiene API pública salvo el reemplazo de `options` → `settings`.
// ==========================================================

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  input,
} from '@angular/core';
import { SchemaEdge, SchemaSettings, DEFAULT_SETTINGS } from '../models';

/**
 * Componente responsable de renderizar **todas las aristas** (links) del grafo en un único SVG.
 *
 * ### Responsabilidades
 * - Dibuja paths SVG a partir de `SchemaEdge.points` calculados por el layout.
 * - Aplica estilos (color/grosor) según `settings.colors` y forma/curvas según `settings.layout`.
 * - Gestiona el **click** sobre una arista y lo expone vía el `Output` `linkClick`.
 *
 * ### Notas de renderizado
 * - El `<svg>` está en **posición absoluta** y cubre el **escenario virtual** (width/height).
 * - Las aristas se renderizan **debajo de las cards** (z-index: 0). Las cards tienen z-index > 0.
 * - El atributo `d` de cada `<path>` lo genera {@link pathFor} en base a:
 *   - `linkStyle` = `orthogonal | curve | line`
 *   - Umbral `straightThresholdDx` y `curveTension` para curvas.
 *
 * ### Performance
 * - `ChangeDetectionStrategy.OnPush`.
 * - Uso de `@for (track e.id)` para minimizar diffs en DOM.
 */
@Component({
  selector: 'schema-links',
  standalone: true,
  template: `
    <svg class="schema-links" [attr.width]="width" [attr.height]="height">
      <g>
        @for (e of edges(); track e.id) {
        <path
          [attr.d]="pathFor(e)"
          [attr.stroke]="view().linkStroke"
          [attr.stroke-width]="view().linkStrokeWidth"
          fill="none"
          (click)="onLinkClick(e, $event)"
        ></path>
        }
      </g>
    </svg>
  `,
  styles: [
    `
      .schema-links {
        position: absolute;
        left: 0;
        top: 0;
        pointer-events: auto;
        overflow: visible;
        z-index: 0; /* debajo de las cards */
      }
      path {
        cursor: pointer;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaLinksComponent {
  // ===== Entradas (signals + @Input) =====

  /**
   * Lista de aristas a dibujar. Deben traer sus `points` ya calculados por el layout.
   * @required
   */
  edges = input.required<SchemaEdge[]>();

  /**
   * Settings efectivos (mergeados por el contenedor).
   * Se usan `colors` (stroke, width) y `layout` (estilo y parámetros de curvas).
   * @default DEFAULT_SETTINGS
   */
  settings = input<SchemaSettings>(DEFAULT_SETTINGS);

  /**
   * Ancho del lienzo virtual en el que se proyectan las aristas.
   * @default 4000
   * @remarks Debe ser coherente con el "stage" del contenedor.
   */
  @Input() width = 4000;

  /**
   * Alto del lienzo virtual en el que se proyectan las aristas.
   * @default 2000
   * @remarks Debe ser coherente con el "stage" del contenedor.
   */
  @Input() height = 2000;

  // ===== Salidas =====

  /**
   * Evento emitido al hacer click sobre una arista.
   * @event
   */
  @Output() linkClick = new EventEmitter<SchemaEdge>();

  // ===== Vista aplanada para el template / path builder =====
  /**
   * `view`: computed con las propiedades planas que usa el SVG/path,
   * derivadas de `settings`.
   */
  view = computed(() => {
    const s = this.settings() ?? DEFAULT_SETTINGS;
    return {
      // colores
      linkStroke: s.colors?.linkStroke ?? '#019df4',
      linkStrokeWidth: s.colors?.linkStrokeWidth ?? 2,

      // layout
      linkStyle:
        s.layout?.linkStyle ??
        ('orthogonal' as 'orthogonal' | 'curve' | 'line'),
      curveTension: s.layout?.curveTension ?? 80,
      straightThresholdDx: s.layout?.straightThresholdDx ?? 160,
    };
  });

  // ===== API interna =====

  /**
   * Construye el atributo `d` del `<path>` SVG para una arista.
   *
   * @param e Arista con `points` pre-calculados (start/bends/end).
   * @returns Cadena `d` de SVG. Si no hay puntos, retorna `''`.
   *
   * ### Reglas
   * - **curve**:
   *    - Si `dx < straightThresholdDx` → línea recta (evita curvas “raras” en distancias cortas).
   *    - Si no, curva cúbica con controles laterales separados por `curveTension`.
   *    - Si es casi horizontal (`|dy| < 1`) añade una ligera “panza” vertical para legibilidad.
   * - **line**: `M a.x,a.y L b.x,b.y`
   * - **orthogonal**: segmentos L con codo intermedio:
   *    `M start  L midX,startY  L midX,endY  L end`
   */
  pathFor(e: SchemaEdge): string {
    const pts = e.points ?? [];
    const { linkStyle, curveTension, straightThresholdDx } = this.view();
    if (pts.length === 0) return '';

    if (linkStyle === 'curve') {
      const a = pts[0];
      const b = pts[pts.length - 1];
      const dxAbs = Math.abs(b.x - a.x);
      if (dxAbs < straightThresholdDx) return `M ${a.x},${a.y} L ${b.x},${b.y}`;

      const t = Math.max(20, Math.min(200, curveTension));
      const dir = Math.sign(b.x - a.x) || 1;
      const dy = b.y - a.y;

      let c1x = a.x + dir * t,
        c1y = a.y;
      let c2x = b.x - dir * t,
        c2y = b.y;

      if (Math.abs(dy) < 1) {
        const bow = Math.max(8, Math.min(96, t * 0.5));
        c1y = a.y - bow;
        c2y = b.y + bow;
      }

      return `M ${a.x},${a.y} C ${c1x},${c1y} ${c2x},${c2y} ${b.x},${b.y}`;
    }

    if (linkStyle === 'line') {
      const a = pts[0];
      const b = pts[pts.length - 1];
      return `M ${a.x},${a.y} L ${b.x},${b.y}`;
    }

    // 'orthogonal' (por defecto) o fallback:
    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
    const [first, ...rest] = pts;
    return `M ${first.x},${first.y} ${rest
      .map((p) => `L ${p.x},${p.y}`)
      .join(' ')}`;
  }

  /**
   * Click handler para una arista.
   * - Detiene la propagación para no interferir con eventos del stage.
   * - Emite `linkClick` con la arista clicada.
   */
  onLinkClick(e: SchemaEdge, ev: MouseEvent) {
    ev.stopPropagation();
    this.linkClick.emit(e);
  }
}
