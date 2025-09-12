import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  TemplateRef,
  input,
} from '@angular/core';
import { DEFAULT_OPTIONS, SchemaNode, SchemaOptions } from '../models';
import { CommonModule, NgIf, NgTemplateOutlet } from '@angular/common';

@Component({
  selector: 'schema-card',
  standalone: true,
  imports: [CommonModule, NgIf, NgTemplateOutlet],
  template: `
    <div
      class="schema-card"
      [class.debug-outline]="options().debug?.paintBounds"
      [attr.data-node-id]="node()?.id"
      [ngClass]="getAccentClasses()"
      [style.left.px]="node()?.x"
      [style.top.px]="node()?.y"
      [style.width.px]="node()?.width"
      [style.height.px]="node()?.height"
      [style.maxWidth.px]="options().maxCardWidth ?? null"
      [style.maxHeight.px]="options().maxCardHeight ?? null"
      (click)="onClick($event)"
      style="z-index: 1;"
    >
      <ng-container
        *ngIf="cardTemplate(); else defaultTpl"
        [ngTemplateOutlet]="cardTemplate()"
        [ngTemplateOutletContext]="{ $implicit: node() }"
      ></ng-container>

      <ng-template #defaultTpl>
        <div class="card-body">
          <div class="card-title" *ngIf="showTitle()">
            {{ node()?.jsonMeta?.title || node()?.label }}
          </div>

          <div
            class="card-preview"
            *ngIf="node()?.jsonMeta?.attributes as attrs"
          >
            <div *ngFor="let kv of objToPairs(attrs)" class="kv">
              @if (kv[0] != this.options().accentByKey) {
              <span class="k">{{ kv[0] }}:</span>
              <span
                class="v"
                [class.v-true]="kv[1] === true"
                [class.v-false]="kv[1] === false"
                [class.nowrap]="isNoWrapKey(kv[0])"
              >
                {{ kv[1] }}
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
                {{ e[0] }}: {{ e[1] }} {{ e[1] === 1 ? 'item' : 'items' }}
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
        position: absolute;
        border-radius: 12px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        user-select: none;
        box-sizing: border-box;
        word-break: normal;
        overflow-wrap: normal;
        overflow: hidden;
      }
      .debug-outline {
        outline: 2px dashed #ef4444;
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

      /* Acentos por booleano */
      .schema-card.accent-true {
        border-color: #16a34a; /* green-600 */
        box-shadow: 0 2px 10px rgba(22, 163, 74, 0.15);
      }
      .schema-card.accent-false {
        border-color: #dc2626; /* red-600 */
        box-shadow: 0 2px 10px rgba(220, 38, 38, 0.15);
      }
      .schema-card.accent-null {
        border-color: #f59e0b; /* amber-500 */
        box-shadow: 0 2px 10px rgba(245, 158, 11, 0.15);
      }

      /* 🎨 Relleno opcional cuando accentFill=true */
      .schema-card.accent-fill-true {
        background: rgba(22, 163, 74, 0.1); /* verde suave */
      }
      .schema-card.accent-fill-false {
        background: rgba(220, 38, 38, 0.1); /* rojo suave */
      }
      .schema-card.accent-fill-null {
        background: rgba(245, 158, 11, 0.1); /* naranja suave */
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaCardComponent {
  node = input.required<SchemaNode>();
  cardTemplate = input<TemplateRef<any> | null>(null);
  options = input<SchemaOptions>(DEFAULT_OPTIONS);

  @Output() nodeClick = new EventEmitter<SchemaNode>();

  showTitle(): boolean {
    return (this.options().titleMode ?? 'auto') !== 'none';
  }
  onClick(event: MouseEvent) {
    event.stopPropagation();
    this.nodeClick.emit(this.node()!);
  }
  objToPairs(obj: Record<string, any>) {
    return Object.entries(obj);
  }
  getAccentClasses(): string[] {
    const k = this.options().accentByKey;
    if (!k) return [];
    const v = this.node()?.data?.[k];
    const classes: string[] = [];
    if (this.options().accentInverse) {
      if (v === true && this.options().showColorTrue)
        classes.push('accent-false');
      if (v === false && this.options().showColorFalse)
        classes.push('accent-true');
      if (v === null && this.options().showColorNull)
        classes.push('accent-null');
      if (this.options().accentFill) {
        if (v === true && this.options().showColorTrue)
          classes.push('accent-fill-false');
        if (v === false && this.options().showColorFalse)
          classes.push('accent-fill-true');
        if (v === null && this.options().showColorNull)
          classes.push('accent-fill-null');
      }
      return classes;
    } else {
      if (v === true && this.options().showColorTrue)
        classes.push('accent-true');
      if (v === false && this.options().showColorFalse)
        classes.push('accent-false');
      if (v === null && this.options().showColorNull)
        classes.push('accent-null');
      if (this.options().accentFill) {
        if (v === true && this.options().showColorTrue)
          classes.push('accent-fill-true');
        if (v === false && this.options().showColorFalse)
          classes.push('accent-fill-false');
        if (v === null && this.options().showColorNull)
          classes.push('accent-fill-null');
      }
      return classes;
    }
  }
  isNoWrapKey(key: string): boolean {
    const list = this.options().noWrapKeys ?? [];
    return list.includes(key);
  }
}
