// projects/schema/src/lib/components/schema-links/schema-links.component.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { input, output, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PositionsMap, SchemaEdge } from '../../models';

type DrawableEdge = { edge: SchemaEdge; d: string };

@Component({
  // El host es un <g> dentro del <svg>
  selector: 'g[schema-links]',
  standalone: true,
  imports: [CommonModule],
  template: `
    <svg:path
      *ngFor="let it of paths(); trackBy: trackById"
      [attr.d]="it.d"
      [attr.stroke]="stroke()"
      [attr.stroke-width]="strokeWidth()"
      fill="none"
      vector-effect="non-scaling-stroke"
      (click)="linkClick.emit(it.edge)"
    ></svg:path>
  `,
  styles: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaLinksComponent {
  // Inputs
  edges = input<SchemaEdge[]>([]);
  positions = input<PositionsMap>(new Map());
  linkStyle = input<'line' | 'curve'>('line');
  nodeWidth = input<number>(180);
  nodeHeight = input<number>(84);

  // Estilo configurable
  stroke = input<string>('#98a1a9');
  strokeWidth = input<number>(2);

  // Output
  linkClick = output<SchemaEdge>();

  // Estado calculado
  paths = signal<DrawableEdge[]>([]);

  constructor() {
    effect(
      () => {
        this.paths.set(
          this.buildPaths(
            this.edges(),
            this.positions(),
            this.linkStyle(),
            this.nodeWidth(),
            this.nodeHeight()
          )
        );
      },
      { allowSignalWrites: true }
    );
  }

  private buildPaths(
    edges: SchemaEdge[],
    pos: PositionsMap,
    style: 'line' | 'curve',
    nodeW: number,
    nodeH: number
  ): DrawableEdge[] {
    const out: DrawableEdge[] = [];
    for (const e of edges) {
      const s = pos.get(e.sourceId);
      const t = pos.get(e.targetId);
      if (!s || !t) continue;

      const sx = s.x + nodeW / 2;
      const sy = s.y + nodeH / 2;
      const tx = t.x + nodeW / 2;
      const ty = t.y + nodeH / 2;

      let d: string;
      if (style === 'curve') {
        const mx = (sx + tx) / 2;
        d = `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ty}, ${tx} ${ty}`;
      } else {
        d = `M ${sx} ${sy} L ${tx} ${ty}`;
      }
      out.push({ edge: e, d });
    }
    return out;
  }

  trackById = (_: number, it: DrawableEdge) => it.edge.id;
}
