// projects/schema/src/lib/components/schema-links.component.ts
// URL: projects/schema/src/lib/components/schema-links.component.ts

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
 * Renderiza todas las aristas del grafo en un único SVG.
 *
 * - Usa `SchemaEdge.points` (calculados por el layout) y decide la forma final
 *   según `settings.layout.linkStyle` y parámetros de curva.
 * - Emite `linkClick` al hacer click sobre una arista.
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
  /** Aristas a dibujar (con `points` calculados por el layout). */
  edges = input.required<SchemaEdge[]>();

  /** Settings efectivos (colors/layout). Si no vienen, usa DEFAULT_SETTINGS. */
  settings = input<SchemaSettings>(DEFAULT_SETTINGS);

  /** Ancho del lienzo virtual (coherente con el "stage" del contenedor). */
  @Input() width = 4000;

  /** Alto del lienzo virtual (coherente con el "stage" del contenedor). */
  @Input() height = 2000;

  /** Click sobre una arista. */
  @Output() linkClick = new EventEmitter<SchemaEdge>();

  /**
   * Vista aplanada para el template/path, con defaults consistentes.
   * No usamos `!`; siempre hay fallback a DEFAULT_SETTINGS.
   */
  view = computed(() => {
    const s = this.settings() ?? DEFAULT_SETTINGS;
    const colors = s.colors ?? DEFAULT_SETTINGS.colors;
    const layout = s.layout ?? DEFAULT_SETTINGS.layout;

    return {
      linkStroke: colors.linkStroke ?? DEFAULT_SETTINGS.colors.linkStroke,
      linkStrokeWidth:
        colors.linkStrokeWidth ?? DEFAULT_SETTINGS.colors.linkStrokeWidth,
      linkStyle: layout.linkStyle ?? DEFAULT_SETTINGS.layout.linkStyle, // 'orthogonal' | 'curve' | 'line'
      curveTension: layout.curveTension ?? DEFAULT_SETTINGS.layout.curveTension, // 20–200 sugerido
      straightThresholdDx:
        layout.straightThresholdDx ??
        DEFAULT_SETTINGS.layout.straightThresholdDx,
    } as const;
  });

  /**
   * Devuelve el atributo `d` SVG para una arista según el estilo actual.
   * - curve:
   *    - si |dx| < straightThresholdDx → línea recta
   *    - si no → curva cúbica con controles separados por curveTension
   *    - si |dy| ~ 0 → introduce una pequeña “panza” vertical
   * - line: línea recta
   * - orthogonal: secuencia de segmentos en “L” (usa bends de `points`)
   */
  pathFor(e: SchemaEdge): string {
    const pts = e.points ?? [];
    if (pts.length === 0) return '';

    const v = this.view();
    const style = v.linkStyle;

    if (style === 'line') {
      const a = pts[0];
      const b = pts[pts.length - 1];
      return `M ${a.x},${a.y} L ${b.x},${b.y}`;
    }

    if (style === 'curve') {
      const a = pts[0];
      const b = pts[pts.length - 1];

      const dxAbs = Math.abs(b.x - a.x);
      if (dxAbs < v.straightThresholdDx!) {
        return `M ${a.x},${a.y} L ${b.x},${b.y}`;
      }

      const t = Math.max(20, Math.min(200, v.curveTension!));
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

    // 'orthogonal' (o fallback): usa todos los puntos como segmentos
    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
    const [first, ...rest] = pts;
    return `M ${first.x},${first.y} ${rest
      .map((p) => `L ${p.x},${p.y}`)
      .join(' ')}`;
  }

  /** Maneja el click en la arista sin burbujarlo al stage. */
  onLinkClick(e: SchemaEdge, ev: MouseEvent) {
    ev.stopPropagation();
    this.linkClick.emit(e);
  }
}
