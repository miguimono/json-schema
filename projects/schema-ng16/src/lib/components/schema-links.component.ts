// URL: projects/schema-ng16/src/lib/components/schema-links.component.ts

import { ChangeDetectionStrategy, Component, EventEmitter, Output, Input, computed, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SchemaEdge, SchemaSettings, DEFAULT_SETTINGS } from "../models";

@Component({
  selector: "schema-links",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./schema-links.component.html",
  styleUrls: ["./schema-links.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaLinksComponent {
  /* ============================ Inputs ============================ */
  private _edges = signal<SchemaEdge[]>([]);
  @Input("edges") set edgesInput(value: SchemaEdge[] | null) {
    this._edges.set(Array.isArray(value) ? value : []);
  }
  edges() {
    return this._edges();
  }

  private _settings = signal<SchemaSettings>(DEFAULT_SETTINGS);
  @Input("settings") set settingsInput(value: SchemaSettings | null) {
    this._settings.set(value ?? DEFAULT_SETTINGS);
  }
  settings() {
    return this._settings();
  }

  // Importante: públicos para el template (antes eran private)
  _width = signal<number>(4000);
  @Input() set width(value: number | null) {
    this._width.set(typeof value === "number" && isFinite(value) ? value : 4000);
  }

  _height = signal<number>(2000);
  @Input() set height(value: number | null) {
    this._height.set(typeof value === "number" && isFinite(value) ? value : 2000);
  }

  /* ============================ Outputs =========================== */
  @Output() linkClick = new EventEmitter<SchemaEdge>();

  /* ============================ View derivada ===================== */
  view = computed(() => {
    const s = this.settings();
    const colors = s.colors ?? DEFAULT_SETTINGS.colors;
    const layout = s.layout ?? DEFAULT_SETTINGS.layout;

    return {
      linkStroke: colors.linkStroke ?? DEFAULT_SETTINGS.colors.linkStroke,
      linkStrokeWidth: colors.linkStrokeWidth ?? DEFAULT_SETTINGS.colors.linkStrokeWidth,
      linkStyle: layout.linkStyle ?? DEFAULT_SETTINGS.layout.linkStyle,
      curveTension: layout.curveTension ?? DEFAULT_SETTINGS.layout.curveTension,
      straightThresholdDx: layout.straightThresholdDx ?? DEFAULT_SETTINGS.layout.straightThresholdDx,
    } as const;
  });

  /* ============================ Render helpers ==================== */
  trackEdgeId = (_: number, e: SchemaEdge) => e.id;

  pathFor(e: SchemaEdge): string {
    const pts = e.points ?? [];
    if (pts.length === 0) return "";

    const v = this.view();
    const style = v.linkStyle;

    if (style === "line") {
      const a = pts[0];
      const b = pts[pts.length - 1];
      return `M ${a.x},${a.y} L ${b.x},${b.y}`;
    }

    if (style === "curve") {
      const a = pts[0];
      const b = pts[pts.length - 1];

      const threshold = Number.isFinite(v.straightThresholdDx)
        ? v.straightThresholdDx
        : DEFAULT_SETTINGS.layout.straightThresholdDx;
      const dxAbs = Math.abs(b.x - a.x);
      if (dxAbs < (threshold ?? 0)) {
        return `M ${a.x},${a.y} L ${b.x},${b.y}`;
      }

      const baseT = Number.isFinite(v.curveTension) ? v.curveTension : DEFAULT_SETTINGS.layout.curveTension;
      const t = Math.max(20, Math.min(200, baseT ?? 30));
      const dir = Math.sign(b.x - a.x) || 1;
      const dy = b.y - a.y;

      let c1x = a.x + dir * t;
      let c1y = a.y;
      let c2x = b.x - dir * t;
      let c2y = b.y;

      if (Math.abs(dy) < 1) {
        const bow = Math.max(8, Math.min(96, t * 0.5));
        c1y = a.y - bow;
        c2y = b.y + bow;
      }

      return `M ${a.x},${a.y} C ${c1x},${c1y} ${c2x},${c2y} ${b.x},${b.y}`;
    }

    if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
    const first = pts[0];
    let d = `M ${first.x},${first.y}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x},${pts[i].y}`;
    return d;
  }

  /* ============================ Eventos ========================== */
  onLinkClick(e: SchemaEdge, ev: MouseEvent) {
    ev.stopPropagation();
    this.linkClick.emit(e);
  }
}
