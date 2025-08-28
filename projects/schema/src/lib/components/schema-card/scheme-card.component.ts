// projects/schema/src/lib/components/schema-card/schema-card.component.ts
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  TemplateRef,
  Output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchemaNode } from '../../models';

@Component({
  selector: 'schema-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="card"
      [class.damage]="node?.state?.inDamage"
      [style.minWidth.px]="minWidth"
      [style.maxWidth.px]="maxWidth"
      (click)="cardClick.emit(node)"
    >
      <!-- Custom template -->
      <ng-container
        *ngIf="cardTemplate; else defaultTpl"
        [ngTemplateOutlet]="cardTemplate"
        [ngTemplateOutletContext]="{
          $implicit: node,
          level: node?.level,
          state: node?.state
        }"
      >
      </ng-container>

      <!-- Default renderer (GENÉRICO) -->
      <ng-template #defaultTpl>
        <!-- (1) Título real: solo si existe; NO mostrar 'JSON-OBJECT/ARRAY/VALUE' -->
        <div
          class="title"
          *ngIf="
            showTitle &&
            node?.jsonMeta?.title &&
            node?.jsonMeta?.kind !== 'array'
          "
        >
          {{ node?.jsonMeta?.title }}
        </div>
        <!-- (2) Atributos primitivos (filtrando el del título para no duplicar) -->
        <div class="attrs" *ngIf="filteredAttrEntries(node)?.length">
          <div
            class="attr"
            *ngFor="let a of filteredAttrEntries(node) | slice : 0 : attrMax"
          >
            <span class="k">{{ a[0] }}:</span>
            <span class="v">{{ a[1] }}</span>
          </div>
          <div
            class="more"
            *ngIf="(filteredAttrEntries(node)?.length || 0) > attrMax"
          >
            +{{ (filteredAttrEntries(node)?.length || 0) - attrMax }} más
          </div>
        </div>

        <!-- Badges de arrays (muestran sample si está disponible) -->
        <div class="badges" *ngIf="arrayEntries(node)?.length">
          <span class="badge" *ngFor="let b of arrayEntries(node)">
            {{ b[0] }} [{{ b[1]?.length }}]
            <ng-container *ngIf="b[1]?.sample?.length">
              — {{ b[1]?.sample?.join(', ') }}
            </ng-container>
          </span>
        </div>
      </ng-template>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .card {
        display: inline-block;
        width: auto; /* (4) ancho dinámico */
        min-height: 84px;
        box-sizing: border-box;
        border: 1px solid #d0d7de;
        border-radius: 10px;
        background: #fff;
        padding: 10px 12px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
        cursor: default;
        user-select: none;

        /* cortar textos largos (CAI, hashes, etc.) */
        word-break: break-word;
        overflow-wrap: anywhere;
      }
      .card.damage {
        border-color: #e53935;
        box-shadow: 0 0 0 2px rgba(229, 57, 53, 0.15);
      }

      /* (3) Título más grande, peso y color distinto */
      .title {
        font-weight: 700;
        font-size: 13.5px;
        color: #1f2937; /* gray-900 */
        letter-spacing: 0.2px;
        margin-bottom: 8px;
        line-height: 1.25;
      }

      .attrs {
        font-size: 11.5px;
        line-height: 1.35;
      }
      .attr .k {
        opacity: 0.7;
        margin-right: 4px;
      }
      .attr + .attr {
        margin-top: 2px;
      }
      .more {
        font-size: 10px;
        opacity: 0.6;
        margin-top: 4px;
      }

      .badges {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .badge {
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 999px;
        background: #eef2f6;
        color: #374151;
        border: 1px solid #d8e0ea;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaCardComponent {
  @Input({ required: true }) node!: SchemaNode;
  @Input() cardTemplate?: TemplateRef<any> | null;

  /** Mostrar/ocultar título (si no hay título, no se renderiza) */
  @Input() showTitle = true;

  /** (4) Límites de ancho dinámico de la card */
  @Input() minWidth = 220;
  @Input() maxWidth = 420;

  /** Límite de atributos mostrados por defecto */
  @Input() attrMax = 8;

  @Output() cardClick = new EventEmitter<SchemaNode>();

  /** Filtra el atributo que coincide con el título para no duplicarlo */
  filteredAttrEntries(node?: SchemaNode): [string, string][] {
    const attrs = node?.jsonMeta?.attributes;
    if (!attrs) return [];
    const entries = Object.entries(attrs);

    const title = node?.jsonMeta?.title;
    if (!title) return entries;

    // Si el título viene del fallback "clave: valor"
    const maybeKey = title.includes(':')
      ? title
          .split(':')[0]
          .trim()
          .replace(/^"+|"+$/g, '')
      : undefined;

    return entries.filter(([k, v]) => {
      // quitar por clave si coincide con "clave" del fallback
      if (maybeKey && k === maybeKey) return false;
      // o quitar si el valor textual coincide exactamente con el título
      return String(v) !== title;
    });
  }

  arrayEntries(
    node?: SchemaNode
  ): [string, { length: number; sample?: string[] }][] {
    const m = node?.jsonMeta?.arrays;
    return m ? Object.entries(m) : [];
  }
}
