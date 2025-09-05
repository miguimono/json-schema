// path: projects/schema/src/lib/schema-links.component.ts

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, input } from "@angular/core";
import { SchemaEdge } from "../../models";

@Component({
  selector: "schema-links",
  standalone: true,
  // Usamos control flow moderno @for (Angular 17+). No requiere CommonModule.
  template: `
    <svg class="schema-links" [attr.width]="width" [attr.height]="height">
      <g>
        @for (e of edges(); track e.id) {
          <path
            [attr.d]="asPath(e)"
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
  linkStroke = input<string>("#4CAF50");
  linkStrokeWidth = input<number>(1.25);

  @Input() width = 4000;
  @Input() height = 2000;

  @Output() linkClick = new EventEmitter<SchemaEdge>();

  asPath(e: SchemaEdge): string {
    const pts = e.points ?? [];
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`; // ← corregido el '..y'
    const [first, ...rest] = pts;
    const lines = rest.map((p) => `L ${p.x},${p.y}`).join(" ");
    return `M ${first.x},${first.y} ${lines}`;
  }

  onLinkClick(e: SchemaEdge, ev: MouseEvent) {
    ev.stopPropagation();
    this.linkClick.emit(e);
  }
}
