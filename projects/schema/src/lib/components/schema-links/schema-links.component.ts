// path: projects/schema/src/lib/schema-links.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
  input,
} from '@angular/core';
import { SchemaEdge, SchemaOptions, DEFAULT_OPTIONS } from '../../models';

@Component({
  selector: 'schema-links',
  standalone: true,
  template: `
    <svg class="schema-links" [attr.width]="width" [attr.height]="height">
      <g>
        @for (e of edges(); track e.id) {
        <path
          [attr.d]="pathFor(e)"
          [attr.stroke]="linkStroke()"
          [attr.stroke-width]="linkStrokeWidth()"
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
      }
      path {
        cursor: pointer;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaLinksComponent {
  edges = input.required<SchemaEdge[]>();
  linkStroke = input<string>(DEFAULT_OPTIONS.linkStroke!);
  linkStrokeWidth = input<number>(DEFAULT_OPTIONS.linkStrokeWidth!);
  options = input<SchemaOptions>(DEFAULT_OPTIONS); // para leer linkStyle

  @Input() width = 4000;
  @Input() height = 2000;

  @Output() linkClick = new EventEmitter<SchemaEdge>();

  pathFor(e: SchemaEdge): string {
    const pts = e.points ?? [];
    const style = this.options().linkStyle ?? 'orthogonal';

    if (pts.length === 0) return '';
    if (style === 'line') {
      const a = pts[0],
        b = pts[pts.length - 1];
      return `M ${a.x},${a.y} L ${b.x},${b.y}`;
    }
    if (style === 'curve' && pts.length >= 2) {
      // Curva suavizada con C bézier entre puntos
      let d = `M ${pts[0].x},${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 1],
          p1 = pts[i];
        const cx = (p0.x + p1.x) / 2;
        const cy = (p0.y + p1.y) / 2;
        d += ` Q ${cx},${cy} ${p1.x},${p1.y}`;
      }
      return d;
    }
    // orthogonal / default: polyline siguiendo puntos de ELK
    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
    const [first, ...rest] = pts;
    const lines = rest.map((p) => `L ${p.x},${p.y}`).join(' ');
    return `M ${first.x},${first.y} ${lines}`;
  }

  onLinkClick(e: SchemaEdge, ev: MouseEvent) {
    ev.stopPropagation();
    this.linkClick.emit(e);
  }
}
