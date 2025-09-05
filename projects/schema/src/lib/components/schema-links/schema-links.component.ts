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
    const { linkStyle = 'orthogonal', curveTension = 80 } = this.options();
    if (pts.length === 0) return '';

    if (linkStyle === 'curve') {
      const a = pts[0],
        b = pts[pts.length - 1];
      const dx = b.x - a.x;
      const t = Math.max(20, Math.min(200, curveTension)); // 👈 ahora configurable
      const c1x = a.x + Math.sign(dx || 1) * t,
        c1y = a.y;
      const c2x = b.x - Math.sign(dx || 1) * t,
        c2y = b.y;
      return `M ${a.x},${a.y} C ${c1x},${c1y} ${c2x},${c2y} ${b.x},${b.y}`;
    }
    if (linkStyle === 'line') {
      const a = pts[0],
        b = pts[pts.length - 1];
      return `M ${a.x},${a.y} L ${b.x},${b.y}`;
    }

    // orthogonal (polyline de ELK)
    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
    const [first, ...rest] = pts;
    return `M ${first.x},${first.y} ${rest
      .map((p) => `L ${p.x},${p.y}`)
      .join(' ')}`;
  }

  onLinkClick(e: SchemaEdge, ev: MouseEvent) {
    ev.stopPropagation();
    this.linkClick.emit(e);
  }
}
