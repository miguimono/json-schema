// URL: projects/schema-ng19/src/lib/components/schema-links.component.ts

/**
 * Componente: SchemaLinksComponent
 * ----------------------------------------------------------------------------
 * Dibuja todas las aristas del grafo en un único SVG posicionado tras las cards.
 *
 * Responsabilidades:
 *  - Convertir `SchemaEdge.points` (calculados en el layout) en paths SVG.
 *  - Adaptar la forma según `settings.layout.linkStyle`:
 *      - "line"       : segmento recto entre extremos.
 *      - "curve"      : curva cúbica con tensión configurable (si el dx supera
 *                       `straightThresholdDx`; en tramos muy cortos, usa línea).
 *      - "orthogonal" : secuencia de segmentos “L” usando todos los bends.
 *  - Emitir `linkClick` cuando se hace click sobre una arista.
 *
 * Parámetros relevantes de `SchemaSettings`:
 *  - colors.linkStroke        : color del trazo (CSS).
 *  - colors.linkStrokeWidth   : grosor del trazo (px).
 *  - layout.linkStyle         : "orthogonal" | "curve" | "line".
 *  - layout.curveTension      : control de curvatura (px). Rango sugerido: 20–200.
 *  - layout.straightThresholdDx: si |dx| < threshold → línea recta en modo "curve".
 *
 * Notas:
 *  - Este componente no calcula puntos; asume que `SchemaLayoutService` ya los
 *    generó y decide la forma final según el estilo actual.
 *  - `width/height` del SVG deben sincronizarse con el “stage” del contenedor.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, input } from "@angular/core";
import { SchemaEdge, SchemaSettings, DEFAULT_SETTINGS } from "../models";

@Component({
  selector: "schema-links",
  standalone: true,
  templateUrl: "./schema-links.component.html",
  styleUrl: "./schema-links.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaLinksComponent {
  /* ============================ Inputs ============================ */

  /** Conjunto de aristas a dibujar (sus `points` provienen del layout). */
  edges = input.required<SchemaEdge[]>();

  /** Settings efectivos para estilo y color de enlaces. */
  settings = input<SchemaSettings>(DEFAULT_SETTINGS);

  /** Ancho del lienzo virtual (coherente con el “stage” del contenedor). */
  @Input() width = 4000;

  /** Alto del lienzo virtual (coherente con el “stage” del contenedor). */
  @Input() height = 2000;

  /* ============================ Outputs =========================== */

  /** Evento emitido al hacer click en una arista. */
  @Output() linkClick = new EventEmitter<SchemaEdge>();

  /* ============================ View derivada ===================== */

  /**
   * Vista aplanada para estilos de path.
   * Usa `DEFAULT_SETTINGS` como fallback para garantizar estabilidad.
   */
  view = computed(() => {
    const s = this.settings() ?? DEFAULT_SETTINGS;
    const colors = s.colors ?? DEFAULT_SETTINGS.colors;
    const layout = s.layout ?? DEFAULT_SETTINGS.layout;

    // Defaults seguros (numéricos y cadenas)
    const linkStroke = colors.linkStroke ?? DEFAULT_SETTINGS.colors.linkStroke;
    const linkStrokeWidth = colors.linkStrokeWidth ?? DEFAULT_SETTINGS.colors.linkStrokeWidth;
    const linkStyle = layout.linkStyle ?? DEFAULT_SETTINGS.layout.linkStyle;
    const curveTension = layout.curveTension ?? DEFAULT_SETTINGS.layout.curveTension;
    const straightThresholdDx = layout.straightThresholdDx ?? DEFAULT_SETTINGS.layout.straightThresholdDx;

    return {
      linkStroke,
      linkStrokeWidth,
      linkStyle,
      curveTension,
      straightThresholdDx,
    } as const;
  });

  /* ============================ Render helpers ==================== */

  /**
   * Construye el atributo `d` del path según el estilo de enlace.
   * Supone que `e.points` contiene al menos el punto de inicio y fin.
   */
  pathFor(e: SchemaEdge): string {
    const pts = e.points ?? [];
    if (pts.length === 0) return "";

    const v = this.view();
    const style = v.linkStyle;

    // Estilo "line": un segmento recto de A a B
    if (style === "line") {
      const a = pts[0];
      const b = pts[pts.length - 1];
      return `M ${a.x},${a.y} L ${b.x},${b.y}`;
    }

    // Estilo "curve": curva cúbica con tensión en X
    if (style === "curve") {
      const a = pts[0];
      const b = pts[pts.length - 1];

      // Evita curvas “demasiado cortas”: usa línea recta cuando |dx| < threshold
      const threshold = Number.isFinite(v.straightThresholdDx)
        ? v.straightThresholdDx
        : DEFAULT_SETTINGS.layout.straightThresholdDx;
      const dxAbs = Math.abs(b.x - a.x);
      if (dxAbs < (threshold ?? 0)) {
        return `M ${a.x},${a.y} L ${b.x},${b.y}`;
      }

      // Asegura límites razonables de tensión
      const baseT = Number.isFinite(v.curveTension) ? v.curveTension : DEFAULT_SETTINGS.layout.curveTension;
      const t = Math.max(20, Math.min(200, baseT ?? 30));
      const dir = Math.sign(b.x - a.x) || 1;
      const dy = b.y - a.y;

      // Puntos de control con separación horizontal `t`
      let c1x = a.x + dir * t;
      let c1y = a.y;
      let c2x = b.x - dir * t;
      let c2y = b.y;

      // Si el delta vertical es muy pequeño, introduce una “panza” suave
      if (Math.abs(dy) < 1) {
        const bow = Math.max(8, Math.min(96, t * 0.5));
        c1y = a.y - bow;
        c2y = b.y + bow;
      }

      return `M ${a.x},${a.y} C ${c1x},${c1y} ${c2x},${c2y} ${b.x},${b.y}`;
    }

    // Estilo "orthogonal": usa todos los puntos como quiebres (L)
    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
    const first = pts[0];
    let d = `M ${first.x},${first.y}`;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      d += ` L ${p.x},${p.y}`;
    }
    return d;
  }

  /* ============================ Eventos ========================== */

  /** Maneja el click en una arista sin burbujarlo al stage. */
  onLinkClick(e: SchemaEdge, ev: MouseEvent) {
    ev.stopPropagation();
    this.linkClick.emit(e);
  }
}
