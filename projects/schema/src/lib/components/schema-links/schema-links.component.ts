// projects/schema/src/lib/components/schema-links/schema-links.component.ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { input, output, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PositionsMap, SchemaEdge, LinkStyle } from '../../models';

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
  // Inputs (datos)
  edges = input<SchemaEdge[]>([]);
  positions = input<PositionsMap>(new Map());

  /** Estilo de enlace: 'line' | 'curve' | 'orthogonal' */
  linkStyle = input<LinkStyle>('line');

  /** Tamaño por defecto si no hay tamaño por nodo */
  nodeWidth = input<number>(180);
  nodeHeight = input<number>(84);

  /**
   * (Opcional) Tamaños por nodo, cuando mides cada card.
   * Estructura: { [nodeId]: { width, height } }
   */
  nodeSizes = input<Record<string, { width: number; height: number }>>({});

  // Estilo visual
  stroke = input<string>('#98a1a9');
  strokeWidth = input<number>(2);

  // Parámetros de curvatura / codo
  curveDx = input<number>(60); // separa control points en curvas
  orthogonalDx = input<number>(24); // ancho del primer/último tramo horizontal en ortogonal

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
            this.nodeHeight(),
            this.nodeSizes(),
            this.curveDx(),
            this.orthogonalDx()
          )
        );
      },
      { allowSignalWrites: true }
    );
  }

  private buildPaths(
    edges: SchemaEdge[],
    pos: PositionsMap,
    style: LinkStyle,
    defaultW: number,
    defaultH: number,
    sizeMap: Record<string, { width: number; height: number }>,
    curveDx: number,
    orthoDx: number
  ): DrawableEdge[] {
    const out: DrawableEdge[] = [];

    for (const e of edges) {
      const s = pos.get(e.sourceId);
      const t = pos.get(e.targetId);
      if (!s || !t) continue;

      // Tamaños reales si existen, o defaults
      const sw = sizeMap[e.sourceId]?.width ?? defaultW;
      const sh = sizeMap[e.sourceId]?.height ?? defaultH;
      const tw = sizeMap[e.targetId]?.width ?? defaultW;
      const th = sizeMap[e.targetId]?.height ?? defaultH;

      // Anclajes laterales: derecha del source → izquierda del target (comportamiento árbol L→R)
      // Si el target está a la izquierda (tx < sx), invertimos lados para evitar cruzar el centro de las cards.
      const sourceRight = { x: s.x + sw, y: s.y + sh / 2 };
      const sourceLeft = { x: s.x, y: s.y + sh / 2 };
      const targetLeft = { x: t.x, y: t.y + th / 2 };
      const targetRight = { x: t.x + tw, y: t.y + th / 2 };

      // Elegir pares de anclaje según geometría
      const forward = t.x >= s.x; // target a la derecha del source
      const A = forward ? sourceRight : sourceLeft;
      const B = forward ? targetLeft : targetRight;

      let d: string;

      if (style === 'curve') {
        // Curva cúbica Bezier con control points desplazados en X
        const c1 = { x: A.x + (forward ? curveDx : -curveDx), y: A.y };
        const c2 = { x: B.x - (forward ? curveDx : -curveDx), y: B.y };
        d = `M ${A.x} ${A.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${B.x} ${B.y}`;
      } else if (style === 'orthogonal' || style === 'step') {
        // Camino en L: H → V → H, con un pequeño offset orthoDx para separar de las tarjetas
        // midX ayuda a "doblar" a mitad de camino
        const midX = (A.x + B.x) / 2;
        // Ajustes cortos cercanos a los nodos para no pegar el codo a los bordes
        const preX = forward
          ? Math.min(A.x + orthoDx, midX)
          : Math.max(A.x - orthoDx, midX);
        const postX = forward
          ? Math.max(B.x - orthoDx, midX)
          : Math.min(B.x + orthoDx, midX);

        d = [
          `M ${A.x} ${A.y}`, // punto de salida
          `L ${preX} ${A.y}`, // pequeño horizontal desde el nodo source
          `L ${postX} ${B.y}`, // vertical (implícito por cambio de Y) hasta la altura del target
          `L ${B.x} ${B.y}`, // pequeño horizontal de llegada al nodo target
        ].join(' ');
      } else {
        // 'line' (por defecto): línea recta entre anclajes laterales
        d = `M ${A.x} ${A.y} L ${B.x} ${B.y}`;
      }

      out.push({ edge: e, d });
    }

    return out;
  }

  trackById = (_: number, it: DrawableEdge) => it.edge.id;
}
