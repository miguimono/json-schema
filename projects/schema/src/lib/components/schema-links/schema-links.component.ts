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
        z-index: 0;
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
  options = input<SchemaOptions>(DEFAULT_OPTIONS);

  @Input() width = 4000;
  @Input() height = 2000;

  @Output() linkClick = new EventEmitter<SchemaEdge>();

  pathFor(e: SchemaEdge): string {
    const pts = e.points ?? [];
    const {
      linkStyle = 'orthogonal',
      curveTension = 80,
      straightThresholdDx = 160,
    } = this.options();
    if (pts.length === 0) return '';

    // --- CURVE (con fallback a recta si están cerca en X)
    if (linkStyle === 'curve') {
      const a = pts[0],
        b = pts[pts.length - 1];
      const dxAbs = Math.abs(b.x - a.x);
      if (dxAbs < straightThresholdDx) {
        return `M ${a.x},${a.y} L ${b.x},${b.y}`;
      }
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

    // --- LINE (simple)
    if (linkStyle === 'line') {
      const a = pts[0],
        b = pts[pts.length - 1];
      return `M ${a.x},${a.y} L ${b.x},${b.y}`;
    }

    // --- ORTHOGONAL: usar la polilínea tal cual (ya saneada en el service)
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
