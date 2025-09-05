// path: projects/schema/src/lib/schema-card.component.ts

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  TemplateRef,
  input,
} from '@angular/core';
import { DEFAULT_OPTIONS, SchemaNode, SchemaOptions } from '../../models';
import { CommonModule, NgIf, NgTemplateOutlet } from '@angular/common';

@Component({
  selector: 'schema-card',
  standalone: true,
  imports: [CommonModule, NgIf, NgTemplateOutlet],
  template: `
    <div
      class="schema-card"
      [ngClass]="getAccentClass()"
      [style.left.px]="node()?.x"
      [style.top.px]="node()?.y"
      [style.width.px]="node()?.width"
      [style.height.px]="node()?.height"
      (click)="onClick($event)"
    >
      <ng-container
        *ngIf="cardTemplate(); else defaultTpl"
        [ngTemplateOutlet]="cardTemplate()"
        [ngTemplateOutletContext]="{ $implicit: node() }"
      >
      </ng-container>

      <ng-template #defaultTpl>
        <div
          class="card-badge"
          *ngIf="(node()?.jsonMeta?.childrenCount ?? 0) > 0"
        >
          {{ node()?.jsonMeta?.childrenCount }} hijos
        </div>

        <div class="card-body">
          <div class="card-title" *ngIf="showTitle()">
            {{ node()?.jsonMeta?.title || node()?.label }}
          </div>
          <div
            class="card-preview"
            *ngIf="node()?.jsonMeta?.attributes as attrs"
          >
            <div *ngFor="let kv of objToPairs(attrs)" class="kv">
              <span class="k">{{ kv[0] }}:</span>
              <span
                class="v"
                [class.v-true]="kv[1] === true"
                [class.v-false]="kv[1] === false"
                >{{ kv[1] }}</span
              >
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
        border-radius: 10px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        overflow: hidden;
        user-select: none;
      }
      .card-badge {
        position: absolute;
        top: 6px;
        right: 8px;
        font-size: 10px;
        background: #eef6ff;
        color: #2563eb;
        padding: 2px 6px;
        border-radius: 999px;
      }
      .card-body {
        padding: 10px;
      }
      .card-title {
        font-weight: 600;
        font-size: 13px;
        margin-bottom: 6px;
      }
      .card-preview {
        font-size: 11px;
        opacity: 0.85;
        line-height: 1.3;
      }
      .kv .k {
        opacity: 0.66;
        margin-right: 6px;
      }
      .schema-card {
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: #fff;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
        border-radius: 10px;
      }
      .schema-card.accent-true {
        border-color: #1b5e20;
        box-shadow: 0 2px 10px rgba(27, 94, 32, 0.15);
      }
      .schema-card.accent-false {
        border-color: #b71c1c;
        box-shadow: 0 2px 10px rgba(183, 28, 28, 0.15);
      }
      .v-true {
        color: #1b5e20;
        font-weight: 600;
      }
      .v-false {
        color: #b71c1c;
        font-weight: 600;
      }
      array-badges {
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
      .schema-card {
        word-break: break-word;
      } /* 👈 evita corte horizontal del CAI */
      .card-title {
        white-space: normal;
      } /* por si quedaba en una línea */
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaCardComponent {
  node = input.required<SchemaNode>();
  cardTemplate = input<TemplateRef<any> | null>(null);
  options = input<SchemaOptions>(DEFAULT_OPTIONS);

  showTitle(): boolean {
    return (this.options().titleMode ?? 'auto') !== 'none';
  }

  @Output() nodeClick = new EventEmitter<SchemaNode>();

  onClick(event: MouseEvent) {
    event.stopPropagation();
    this.nodeClick.emit(this.node()!);
  }

  objToPairs(obj: Record<string, any>) {
    return Object.entries(obj);
  }
  objLen(obj: Record<string, any>) {
    return Object.keys(obj).length;
  }
  // helper para clase de acento
  getAccentClass(): string {
    const opt = this.options();
    const k = opt.accentByKey;
    if (!k) return '';
    const v = this.node()?.data?.[k];
    if (v === true) return 'accent-true';
    if (v === false) return 'accent-false';
    return '';
  }
}
