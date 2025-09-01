// projects/schema/src/lib/components/schema-card/schema-card.component.ts
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SchemaNode } from '../../models';

@Component({
  selector: 'schema-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      #cardEl
      class="card"
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
          state: node?.state,
        }"
      ></ng-container>

      <!-- Default renderer (GENÉRICO) -->
      <ng-template #defaultTpl>
        <!-- Título (si existe). Evitamos mostrar títulos genéricos innecesarios -->
        <div class="title" *ngIf="showTitle && node?.jsonMeta?.title">
          {{ node?.jsonMeta?.title }}
        </div>

        <!-- Atributos primitivos (ya sin duplicar el título) -->
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

        <!-- Preview sencillo para arrays y objetos vacíos -->
        <div
          class="preview"
          *ngIf="!filteredAttrEntries(node)?.length && node?.jsonMeta?.preview"
        >
          {{ node?.jsonMeta?.preview }}
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
        width: auto; /* ancho dinámico */
        min-height: 84px;
        box-sizing: border-box;
        border: 1px solid #d0d7de;
        border-radius: 10px;
        background: #fff;
        padding: 10px 12px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
        cursor: default;
        user-select: none;

        /* cortar textos largos (ids, hashes, etc.) */
        word-break: break-word;
        overflow-wrap: anywhere;
      }

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

      .preview {
        font-size: 11.5px;
        opacity: 0.75;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaCardComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) node!: SchemaNode;
  @Input() cardTemplate?: TemplateRef<any> | null;

  /** Mostrar/ocultar título (si no hay título, no se renderiza) */
  @Input() showTitle = true;

  /** Límites de ancho dinámico de la card */
  @Input() minWidth = 220;
  @Input() maxWidth = 420;

  /** Límite de atributos mostrados por defecto */
  @Input() attrMax = 8;

  /** Emite las medidas reales de la card (para P0.1 anti-solapes) */
  @Output() sizeChange = new EventEmitter<{
    id: string;
    width: number;
    height: number;
  }>();

  /** Click de card (passthrough) */
  @Output() cardClick = new EventEmitter<SchemaNode>();

  @ViewChild('cardEl', { static: true }) cardEl!: ElementRef<HTMLElement>;

  private ro?: ResizeObserver;

  ngAfterViewInit(): void {
    // Emitimos medida inicial
    this.emitSize();

    // Observamos cambios de tamaño con ResizeObserver (auto-alto)
    this.ro = new ResizeObserver(() => this.emitSize());
    this.ro.observe(this.cardEl.nativeElement);
  }

  ngOnDestroy(): void {
    this.ro?.disconnect();
  }

  private emitSize(): void {
    if (!this.node?.id || !this.cardEl?.nativeElement) return;
    const el = this.cardEl.nativeElement;
    const rect = el.getBoundingClientRect();
    // Nota: getBoundingClientRect usa px físicos; para layout basta width/height
    this.sizeChange.emit({
      id: this.node.id,
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
    });
  }

  // Convierte cualquier valor a string de forma segura para mostrar en la card
  private toText(v: unknown): string {
    if (v === null) return 'null';
    const t = typeof v;
    if (t === 'string') return v as string;
    if (t === 'number' || t === 'boolean' || t === 'bigint') return String(v);
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }

  filteredAttrEntries(node?: SchemaNode): [string, string][] {
    const attrs = node?.jsonMeta?.attributes as
      | Record<string, unknown>
      | undefined;
    if (!attrs) return [];

    // Normalizamos a pares [clave, string]
    const entries: [string, string][] = Object.entries(attrs).map(
      ([k, v]) => [k, this.toText(v)] as [string, string]
    );

    const title = node?.jsonMeta?.title;
    if (!title) return entries;

    // Si el título es "clave: valor", removemos esa "clave" de atributos
    const maybeKey = title.includes(':')
      ? title
          .split(':')[0]
          .trim()
          .replace(/^"+|"+$/g, '')
      : undefined;

    return entries.filter(([k, v]) => {
      if (maybeKey && k === maybeKey) return false;
      return v !== title;
    });
  }
}
