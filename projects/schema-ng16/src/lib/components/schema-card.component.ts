// URL: projects/schema-ng16/src/lib/components/schema-card.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  TemplateRef,
  Input,
  computed,
  signal,
} from "@angular/core";
import { CommonModule, NgIf, NgTemplateOutlet, NgClass } from "@angular/common";
import { SchemaNode, SchemaSettings, DEFAULT_SETTINGS, ImageShape } from "../models";

@Component({
  selector: "schema-card",
  standalone: true,
  imports: [CommonModule, NgIf, NgTemplateOutlet, NgClass],
  templateUrl: "./schema-card.component.html",
  styleUrls: ["./schema-card.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaCardComponent {
  private colorRgbaCache = new Map<string, string>();
  private static colorParserCtx: CanvasRenderingContext2D | null | undefined;
  /* ============================ Inputs (con alias para evitar conflictos con métodos) ============================ */
  private _node = signal<SchemaNode | null>(null);
  @Input("node") set nodeInput(value: SchemaNode | null) {
    this._node.set(value ?? null);
  }
  node() {
    return this._node();
  }

  private _cardTemplate = signal<TemplateRef<any> | null>(null);
  @Input("cardTemplate") set cardTemplateInput(value: TemplateRef<any> | null) {
    this._cardTemplate.set(value ?? null);
  }
  cardTemplate() {
    return this._cardTemplate();
  }

  private _settings = signal<SchemaSettings>(DEFAULT_SETTINGS);
  @Input("settings") set settingsInput(value: SchemaSettings | null) {
    this._settings.set(value ?? DEFAULT_SETTINGS);
  }
  settings() {
    return this._settings();
  }

  private _hasChildren = signal<boolean>(false);
  @Input("hasChildren") set hasChildrenInput(value: boolean) {
    this._hasChildren.set(!!value);
  }
  hasChildren() {
    return this._hasChildren();
  }

  private _showCollapseControls = signal<boolean>(false);
  @Input("showCollapseControls") set showCollapseControlsInput(value: boolean) {
    this._showCollapseControls.set(!!value);
  }
  showCollapseControls() {
    return this._showCollapseControls();
  }

  private _isCollapsed = signal<boolean>(false);
  @Input("isCollapsed") set isCollapsedInput(value: boolean) {
    this._isCollapsed.set(!!value);
  }
  isCollapsed() {
    return this._isCollapsed();
  }

  private _textSelectionEnabled = signal<boolean>(false);
  @Input("textSelectionEnabled") set textSelectionEnabledInput(value: boolean) {
    this._textSelectionEnabled.set(!!value);
  }
  textSelectionEnabled() {
    return this._textSelectionEnabled();
  }

  private _showCopyAllButton = signal<boolean>(false);
  @Input("showCopyAllButton") set showCopyAllButtonInput(value: boolean) {
    this._showCopyAllButton.set(!!value);
  }
  showCopyAllButton() {
    return this._showCopyAllButton();
  }

  /* ============================ Outputs =========================== */
  @Output() nodeClick = new EventEmitter<SchemaNode>();
  @Output() toggleRequest = new EventEmitter<SchemaNode>();
  @Output() interactionStart = new EventEmitter<void>();
  @Output() interactionEnd = new EventEmitter<void>();

  /* ============================ View derivada ===================== */
  view = computed(() => {
    const s = this.settings(); // nunca null; siempre hay defaults

    // Grupo de imagen
    const imageSizePx = s.dataView?.imageSizePx ?? DEFAULT_SETTINGS.dataView.imageSizePx;
    const imageShape = (s.dataView?.imageShape ?? DEFAULT_SETTINGS.dataView.imageShape) as ImageShape;
    const imageBorder = s.dataView?.imageBorder ?? DEFAULT_SETTINGS.dataView.imageBorder;
    const imageBg = s.dataView?.imageBg ?? DEFAULT_SETTINGS.dataView.imageBg;
    const imageFit = s.dataView?.imageFit ?? DEFAULT_SETTINGS.dataView.imageFit;

    // Presentación general
    const maxCardWidth = s.dataView?.maxCardWidth ?? null;
    const maxCardHeight = s.dataView?.maxCardHeight ?? null;
    const noWrapKeys = s.dataView?.noWrapKeys ?? [];
    const labelData = s.dataView?.labelData ?? {};
    const valueShowTooltip = s.dataView?.valueShowTooltip ?? false;
    const valueMaxChars = s.dataView?.valueMaxChars ?? null;

    // Acentos
    const accentByKey = s.colors?.accentByKey ?? null;
    const accentFill = s.colors?.accentFill ?? false;
    const accentInverse = s.colors?.accentInverse ?? false;

    const reqTrue = s.colors?.showColorTrue ?? false;
    const reqFalse = s.colors?.showColorFalse ?? false;
    const reqNull = s.colors?.showColorNull ?? false;
    const colorTrue = s.colors?.colorTrue ?? DEFAULT_SETTINGS.colors.colorTrue;
    const colorFalse = s.colors?.colorFalse ?? DEFAULT_SETTINGS.colors.colorFalse;
    const colorNull = s.colors?.colorNull ?? DEFAULT_SETTINGS.colors.colorNull;

    let showTrue = reqTrue;
    let showFalse = reqFalse;
    let showNull = reqNull;

    const anyRequested = reqTrue || reqFalse || reqNull;
    if (accentByKey && !anyRequested) {
      showTrue = true;
      showFalse = true;
      showNull = true;
    }

    return {
      // Imagen
      showImageKey: s.dataView?.showImage ?? null,
      imageSizePx,
      imageShape,
      imageBorder,
      imageBg,
      imageFit,
      imageFallback: s.dataView?.imageFallback ?? null,

      // Presentación
      maxCardWidth,
      maxCardHeight,
      noWrapKeys,
      labelData,
      valueShowTooltip,
      valueMaxChars,

      // Defaults de tamaño
      defaultNodeW: DEFAULT_SETTINGS.dataView.defaultNodeSize?.width ?? 120,
      defaultNodeH: DEFAULT_SETTINGS.dataView.defaultNodeSize?.height ?? 60,

      // Acentos
      accentByKey,
      accentFill,
      accentInverse,
      showColorTrue: showTrue,
      showColorFalse: showFalse,
      showColorNull: showNull,
      colorTrue,
      colorFalse,
      colorNull,
      shadowTrue: this.buildShadow(colorTrue, 0.15),
      shadowFalse: this.buildShadow(colorFalse, 0.15),
      shadowNull: this.buildShadow(colorNull, 0.18),
      fillTrue: this.toRgba(colorTrue, 0.1, "rgba(22, 163, 74, 0.1)"),
      fillFalse: this.toRgba(colorFalse, 0.1, "rgba(220, 38, 38, 0.1)"),
      fillNull: this.toRgba(colorNull, 0.12, "rgba(107, 114, 128, 0.12)"),
    } as const;
  });

  /* ============================ API interna ======================= */

  onClick(event: MouseEvent) {
    event.stopPropagation();
    const n = this.node();
    if (n) this.nodeClick.emit(n);
  }

  onPointerDown(event: PointerEvent) {
    if (!this.textSelectionEnabled()) return;
    event.stopPropagation();
    this.interactionStart.emit();
  }

  onPointerEnter() {
    this.interactionStart.emit();
  }

  onPointerLeave() {
    this.interactionEnd.emit();
  }

  onToggle(event: MouseEvent) {
    event.stopPropagation();
    const n = this.node();
    if (n) this.toggleRequest.emit(n);
  }

  objToPairs(obj: Record<string, unknown>) {
    const entries = Object.entries(obj ?? {});
    const imgKey = this.view().showImageKey;
    const accentKey = this.view().accentByKey;

    return entries.filter(([k]) => {
      if (imgKey && k === imgKey) return false;
      if (accentKey && k === accentKey) return false;
      return true;
    });
  }

  private showImageKey(): string | null {
    const k = this.view().showImageKey;
    return k && typeof k === "string" && k.trim() ? k : null;
  }

  imageSrc(): string | null {
    const key = this.showImageKey();
    if (!key) return null;
    const v = this.node()?.data?.[key];
    return typeof v === "string" && v.trim() !== "" ? v : null;
  }

  imageAlt(): string {
    const n = this.node();
    if (!n) return "imagen";
    return n.jsonMeta?.title || n.label || "imagen";
  }

  getAccentClasses(): string[] {
    const v = this.view();
    const k = v.accentByKey;
    if (!k) return [];
    const n = this.node();
    const val = n?.data?.[k];

    const classes: string[] = [];
    const pushIf = (cond: boolean, cls: string) => cond && classes.push(cls);

    if (!v.accentInverse) {
      pushIf(val === true && v.showColorTrue, "accent-true");
      pushIf(val === false && v.showColorFalse, "accent-false");
      pushIf(val === null && v.showColorNull, "accent-null");
      if (v.accentFill) {
        pushIf(val === true && v.showColorTrue, "accent-fill-true");
        pushIf(val === false && v.showColorFalse, "accent-fill-false");
        pushIf(val === null && v.showColorNull, "accent-fill-null");
      }
    } else {
      pushIf(val === true && v.showColorTrue, "accent-false");
      pushIf(val === false && v.showColorFalse, "accent-true");
      pushIf(val === null && v.showColorNull, "accent-null");
      if (v.accentFill) {
        pushIf(val === true && v.showColorTrue, "accent-fill-false");
        pushIf(val === false && v.showColorFalse, "accent-fill-true");
        pushIf(val === null && v.showColorNull, "accent-fill-null");
      }
    }
    return classes;
  }

  isNoWrapKey(key: string): boolean {
    const arr = this.view().noWrapKeys ?? [];
    return Array.isArray(arr) ? arr.includes(key) : false;
  }

  arrowGlyph(): string {
    const dir = this.settings().layout?.layoutDirection ?? DEFAULT_SETTINGS.layout.layoutDirection;
    const collapsed = !!this.isCollapsed();
    if (dir === "DOWN") return collapsed ? "▼" : "▲";
    return collapsed ? "▶" : "◀";
  }

  displayValue(val: unknown): string {
    const str = val == null ? String(val) : String(val);
    const limit = this.view().valueMaxChars;
    if (typeof limit === "number" && limit > 0 && str.length > limit) {
      return str.slice(0, limit) + "…";
    }
    return str;
  }

  valueTitle(val: unknown): string | null {
    if (!this.view().valueShowTooltip) return null;
    return val == null ? String(val) : String(val);
  }

  displayKey(key: string): string {
    const map = this.view().labelData ?? {};
    return Object.prototype.hasOwnProperty.call(map, key) ? (map as any)[key] : key;
  }

  hasComputedTitle(): boolean {
    const t = this.node()?.jsonMeta?.title;
    return !!t && String(t).trim() !== "";
  }

  onImgError(ev: Event) {
    const el = ev.target as HTMLImageElement | null;
    if (!el) return;

    const tried = el.dataset["fallbackApplied"] === "1";
    const fallback = this.view().imageFallback;

    if (fallback && !tried) {
      el.dataset["fallbackApplied"] = "1";
      el.src = fallback;
      return;
    }

    el.removeAttribute("src");
    if (!this.view().imageBg) el.style.background = "#e2e8f0";
    if (this.view().imageBorder === undefined) el.style.border = "1px solid rgba(0,0,0,0.06)";
  }

  onCopyAll(event: MouseEvent): void {
    event.stopPropagation();
    const text = this.buildCopyText();
    if (!text) return;
    this.copyToClipboard(text);
  }

  private buildCopyText(): string {
    const n = this.node();
    if (!n) return "";

    const lines: string[] = [];
    if (this.hasComputedTitle()) lines.push(String(n.jsonMeta?.title ?? "").trim());

    const attrs = n.jsonMeta?.attributes ?? {};
    for (const [k, v] of this.objToPairs(attrs)) {
      lines.push(`${this.displayKey(k)}: ${this.displayValue(v)}`);
    }

    const arrs = n.jsonMeta?.arrayCounts ?? {};
    for (const [k, v] of this.objToPairs(arrs)) {
      lines.push(`${this.displayKey(k)}: ${v} ${Number(v) === 1 ? "item" : "items"}`);
    }

    return lines.join("\n").trim();
  }

  private async copyToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}

    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      ta.style.pointerEvents = "none";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }

  private buildShadow(color: string | undefined, alpha: number): string {
    const rgba = this.toRgba(color, alpha, `rgba(0, 0, 0, ${alpha})`);
    return `0 2px 10px ${rgba}`;
  }

  private toRgba(color: string | undefined, alpha: number, fallback: string): string {
    if (!color || typeof color !== "string") return fallback;
    const c = color.trim();
    if (!c) return fallback;

    const key = `${c}|${alpha}`;
    const cached = this.colorRgbaCache.get(key);
    if (cached) return cached;

    const rgb = this.parseCssColor(c);
    if (!rgb) return fallback;

    const out = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    this.colorRgbaCache.set(key, out);
    return out;
  }

  private parseCssColor(color: string): { r: number; g: number; b: number } | null {
    const fromHex = this.parseHexColor(color);
    if (fromHex) return fromHex;

    const fromRgb = this.parseRgbColor(color);
    if (fromRgb) return fromRgb;

    const ctx = this.getColorParserCtx();
    if (!ctx) return null;
    ctx.fillStyle = "#000000";
    ctx.fillStyle = color;
    const normalized = String(ctx.fillStyle || "").trim();
    return this.parseHexColor(normalized) ?? this.parseRgbColor(normalized);
  }

  private parseHexColor(color: string): { r: number; g: number; b: number } | null {
    const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!hex) return null;
    const h = hex[1];
    const full = h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  private parseRgbColor(color: string): { r: number; g: number; b: number } | null {
    const rgb = color.match(/^rgba?\(([^)]+)\)$/i);
    if (!rgb) return null;
    const parts = rgb[1].split(",").map((p) => p.trim());
    if (parts.length < 3) return null;
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    if (![r, g, b].every((v) => Number.isFinite(v))) return null;
    return {
      r: Math.max(0, Math.min(255, Math.round(r))),
      g: Math.max(0, Math.min(255, Math.round(g))),
      b: Math.max(0, Math.min(255, Math.round(b))),
    };
  }

  private getColorParserCtx(): CanvasRenderingContext2D | null {
    if (SchemaCardComponent.colorParserCtx !== undefined) {
      return SchemaCardComponent.colorParserCtx;
    }
    try {
      if (typeof document === "undefined") {
        SchemaCardComponent.colorParserCtx = null;
      } else {
        const canvas = document.createElement("canvas");
        SchemaCardComponent.colorParserCtx = canvas.getContext("2d");
      }
    } catch {
      SchemaCardComponent.colorParserCtx = null;
    }
    return SchemaCardComponent.colorParserCtx;
  }

}
