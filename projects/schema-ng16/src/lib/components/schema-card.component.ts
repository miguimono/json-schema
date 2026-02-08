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

  /* ============================ Outputs =========================== */
  @Output() nodeClick = new EventEmitter<SchemaNode>();
  @Output() toggleRequest = new EventEmitter<SchemaNode>();

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
    } as const;
  });

  /* ============================ API interna ======================= */

  onClick(event: MouseEvent) {
    event.stopPropagation();
    const n = this.node();
    if (n) this.nodeClick.emit(n);
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
}
