// path: projects/schema/src/lib/schema-card.component.ts

import { ChangeDetectionStrategy, Component, EventEmitter, Output, TemplateRef, input } from "@angular/core";
import { SchemaNode } from "../../models";
import { NgIf, NgTemplateOutlet } from "@angular/common";

@Component({
  selector: "schema-card",
  standalone: true,
  imports: [NgIf, NgTemplateOutlet],
  template: `
    <div
      class="schema-card"
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
        <div class="card-body">
          <div class="card-title">{{ node()?.jsonMeta?.title || node()?.label }}</div>
          <div class="card-preview" *ngIf="node()?.jsonMeta?.attributes as attrs">
            <div *ngFor="let kv of objToPairs(attrs) | slice: 0 : 4" class="kv">
              <span class="k">{{ kv[0] }}:</span>
              <span class="v">{{ kv[1] }}</span>
            </div>
            <div class="more" *ngIf="objLen(attrs) > 4">+{{ objLen(attrs) - 4 }} más</div>
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
        cursor: default;
        overflow: hidden;
        user-select: none;
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
      .more {
        font-size: 10px;
        opacity: 0.6;
        margin-top: 4px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaCardComponent {
  node = input.required<SchemaNode>();
  cardTemplate = input<TemplateRef<any> | null>(null);

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
}
