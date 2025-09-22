// projects/schema/src/lib/components/schema-card.component.ts
// URL: projects/schema/src/lib/components/schema-card.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  TemplateRef,
  computed,
  input,
} from '@angular/core';
import { SchemaNode, SchemaSettings, DEFAULT_SETTINGS } from '../models';
import { CommonModule, NgIf, NgTemplateOutlet } from '@angular/common';

/**
 * Renderiza un {@link SchemaNode} como card.
 *
 * - Título (opcional), preview de atributos (`jsonMeta.attributes`) y badges de arrays (`jsonMeta.arrayCounts`).
 * - Permite template custom con `cardTemplate` (el nodo se expone como `$implicit`).
 * - Acentos visuales según `settings.colors` y `settings.dataView`.
 * - Botón de colapso/expansión si `showCollapseControls === true` y `hasChildren === true`.
 *
 * @example
 * ```html
 * <schema-card
 *   [node]="n"
 *   [settings]="settings"
 *   [cardTemplate]="tpl"
 *   [hasChildren]="true"
 *   [showCollapseControls]="true"
 *   (toggleRequest)="onToggle($event)"
 *   (nodeClick)="onNodeClick($event)"
 * ></schema-card>
 *
 * <ng-template #tpl let-node>
 *   <strong>{{ node.jsonMeta?.title || node.label }}</strong>
 * </ng-template>
 * ```
 */
@Component({
  selector: 'schema-card',
  standalone: true,
  imports: [CommonModule, NgIf, NgTemplateOutlet],
  template: `
    <div
      class="schema-card"
      [class.debug-outline]="view().debugPaintBounds"
      [attr.data-node-id]="node()?.id"
      [ngClass]="getAccentClasses()"
      [style.left.px]="node()?.x"
      [style.top.px]="node()?.y"
      [style.width.px]="node()?.width"
      [style.height.px]="node()?.height"
      [style.maxWidth.px]="view().maxCardWidth"
      [style.maxHeight.px]="view().maxCardHeight"
      (click)="onClick($event)"
      style="z-index: 1; position: absolute;"
    >
      <button
        *ngIf="showCollapseControls() && hasChildren()"
        type="button"
        class="collapse-btn"
        [attr.aria-pressed]="isCollapsed()"
        (click)="onToggle($event)"
        title="{{ isCollapsed() ? 'Expandir' : 'Colapsar' }}"
      >
        <span class="chev">{{ arrowGlyph() }}</span>
      </button>

      <ng-container
        *ngIf="cardTemplate(); else defaultTpl"
        [ngTemplateOutlet]="cardTemplate()"
        [ngTemplateOutletContext]="{ $implicit: node() }"
      ></ng-container>

      <ng-template #defaultTpl>
        <div class="card-body">
          <div
            class="card-title"
            *ngIf="view().showTitle && hasComputedTitle()"
          >
            {{ node()?.jsonMeta?.title }}
          </div>

          <div
            class="card-preview"
            *ngIf="node()?.jsonMeta?.attributes as attrs"
          >
            <div *ngFor="let kv of objToPairs(attrs)" class="kv">
              @if (kv[0] != view().accentByKey) {
              <span class="k">{{ displayKey(kv[0]) }}:</span>
              <span
                class="v"
                [class.v-true]="kv[1] === true"
                [class.v-false]="kv[1] === false"
                [class.nowrap]="isNoWrapKey(kv[0])"
                [attr.title]="valueTitle(kv[1])"
              >
                {{ displayValue(kv[1]) }}
              </span>
              }
            </div>
          </div>

          <div
            class="array-badges"
            *ngIf="node()?.jsonMeta?.arrayCounts as arrs"
          >
            <ng-container *ngFor="let e of objToPairs(arrs)">
              <span class="arr-badge">
                {{ displayKey(e[0]) }}: {{ e[1] }}
                {{ e[1] === 1 ? 'item' : 'items' }}
              </span>
            </ng-container>
          </div>
        </div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      .schema-card {
        border-radius: 12px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        user-select: none;
        box-sizing: border-box;
        word-break: normal;
        overflow-wrap: normal;
        overflow: hidden;
        transition: left 160ms ease, top 160ms ease, opacity 120ms ease;
      }
      .collapse-btn {
        position: absolute;
        top: 6px;
        right: 8px;
        width: 24px;
        height: 24px;
        border-radius: 6px;
        border: 1px solid rgba(0, 0, 0, 0.12);
        background: #f8fafc;
        cursor: pointer;
        display: grid;
        place-items: center;
        padding: 0;
        line-height: 1;
        z-index: 2;
      }
      .chev {
        display: inline-block;
        transition: transform 160ms ease;
      }
      .chev.collapsed {
        transform: rotate(180deg);
      }
      .card-body {
        padding: 12px 20px;
      }
      .card-title {
        font-weight: 700;
        font-size: 14px;
        margin-bottom: 6px;
      }
      .card-preview {
        font-size: 12px;
        line-height: 1.28;
      }
      .kv {
        display: grid;
        grid-template-columns: max-content max-content;
        column-gap: 10px;
        align-items: baseline;
        margin: 3px 0;
        padding-right: 8px;
      }
      .k {
        opacity: 0.66;
        font-weight: 600;
        font-size: 12px;
      }
      .v {
        font-size: 10.75px;
        line-height: 1.25;
        letter-spacing: 0.1px;
        padding-right: 6px;
        display: inline-block;
      }
      .v-true {
        color: #16a34a;
        font-weight: 700;
      }
      .v-false {
        color: #dc2626;
        font-weight: 700;
      }
      .array-badges {
        margin-top: 6px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .arr-badge {
        font-size: 10px;
        background: #eef2ff;
        color: #3730a3;
        padding: 2px 6px;
        border-radius: 999px;
      }
      .nowrap {
        white-space: nowrap !important;
        word-break: keep-all !important;
        overflow-wrap: normal !important;
      }
      .schema-card.accent-true {
        border-color: #16a34a;
        box-shadow: 0 2px 10px rgba(22, 163, 74, 0.15);
      }
      .schema-card.accent-false {
        border-color: #dc2626;
        box-shadow: 0 2px 10px rgba(220, 38, 38, 0.15);
      }
      .schema-card.accent-null {
        border-color: #f59e0b;
        box-shadow: 0 2px 10px rgba(245, 158, 11, 0.15);
      }
      .schema-card.accent-fill-true {
        background: rgba(22, 163, 74, 0.1);
      }
      .schema-card.accent-fill-false {
        background: rgba(220, 38, 38, 0.1);
      }
      .schema-card.accent-fill-null {
        background: rgba(245, 158, 11, 0.1);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaCardComponent {
  // Inputs
  node = input.required<SchemaNode>();
  cardTemplate = input<TemplateRef<any> | null>(null);
  settings = input<SchemaSettings>(DEFAULT_SETTINGS);
  hasChildren = input<boolean>(false);
  showCollapseControls = input<boolean>(false);
  isCollapsed = input<boolean>(false);

  // Outputs
  @Output() nodeClick = new EventEmitter<SchemaNode>();
  @Output() toggleRequest = new EventEmitter<SchemaNode>();

  /** Vista aplanada derivada de settings. */
  view = computed(() => {
    const s = this.settings() ?? DEFAULT_SETTINGS;
    return {
      // dataView
      showTitle: s.dataView?.showTitle ?? false,
      maxCardWidth: s.dataView?.maxCardWidth ?? null,
      maxCardHeight: s.dataView?.maxCardHeight ?? null,
      noWrapKeys: s.dataView?.noWrapKeys ?? [],
      labelData: s.dataView?.labelData ?? {},
      valueShowTooltip: s.dataView?.valueShowTooltip ?? false,
      valueMaxChars: s.dataView?.valueMaxChars ?? null,

      // colors
      accentByKey: s.colors?.accentByKey ?? null,
      accentFill: s.colors?.accentFill ?? false,
      accentInverse: s.colors?.accentInverse ?? false,
      showColorTrue: s.colors?.showColorTrue ?? false,
      showColorFalse: s.colors?.showColorFalse ?? false,
      showColorNull: s.colors?.showColorNull ?? false,

      // debug
      debugPaintBounds: s.debug?.paintBounds ?? false,
    };
  });

  // API interna
  onClick(event: MouseEvent) {
    event.stopPropagation();
    this.nodeClick.emit(this.node()!);
  }

  objToPairs(obj: Record<string, unknown>) {
    return Object.entries(obj);
  }

  onToggle(event: MouseEvent) {
    event.stopPropagation();
    this.toggleRequest.emit(this.node()!);
  }

  getAccentClasses(): string[] {
    const v = this.view();
    const k = v.accentByKey;
    if (!k) return [];
    const val = this.node()?.data?.[k];
    const classes: string[] = [];

    const pushIf = (cond: boolean, cls: string) => {
      if (cond) classes.push(cls);
    };

    if (!v.accentInverse) {
      pushIf(val === true && v.showColorTrue, 'accent-true');
      pushIf(val === false && v.showColorFalse, 'accent-false');
      pushIf(val === null && v.showColorNull, 'accent-null');
      if (v.accentFill) {
        pushIf(val === true && v.showColorTrue, 'accent-fill-true');
        pushIf(val === false && v.showColorFalse, 'accent-fill-false');
        pushIf(val === null && v.showColorNull, 'accent-fill-null');
      }
    } else {
      pushIf(val === true && v.showColorTrue, 'accent-false');
      pushIf(val === false && v.showColorFalse, 'accent-true');
      pushIf(val === null && v.showColorNull, 'accent-null');
      if (v.accentFill) {
        pushIf(val === true && v.showColorTrue, 'accent-fill-false');
        pushIf(val === false && v.showColorFalse, 'accent-fill-true');
        pushIf(val === null && v.showColorNull, 'accent-fill-null');
      }
    }
    return classes;
  }

  isNoWrapKey(key: string): boolean {
    return this.view().noWrapKeys.includes(key);
  }

  arrowGlyph(): string {
    const dir =
      this.settings()?.layout?.layoutDirection ??
      DEFAULT_SETTINGS.layout.layoutDirection;
    const collapsed = !!this.isCollapsed();

    if (dir === 'DOWN') {
      return collapsed ? '▼' : '▲';
    }
    return collapsed ? '▶' : '◀';
  }

  displayValue(val: unknown): string {
    const str = val == null ? String(val) : String(val);
    const limit = this.view().valueMaxChars;
    if (typeof limit === 'number' && limit > 0 && str.length > limit) {
      return str.slice(0, limit) + '…';
    }
    return str;
  }

  valueTitle(val: unknown): string | null {
    if (!this.view().valueShowTooltip) return null;
    return val == null ? String(val) : String(val);
  }

  displayKey(key: string): string {
    const map = this.view().labelData ?? {};
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : key;
  }

  hasComputedTitle(): boolean {
    const t = this.node()?.jsonMeta?.title;
    return !!t && String(t).trim() !== '';
  }
}
