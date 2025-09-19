// projects/schema/src/lib/components/schema-card.component.ts
// ==========================================================
// SchemaCardComponent (sin SchemaOptions)
// - Migrado a SchemaSettings + DEFAULT_SETTINGS.
// - Aplana settings relevantes para la card con un computed `view`.
// - Mantiene API pública (inputs/outputs) salvo el reemplazo de `options` → `settings`.
// ==========================================================

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
 * Componente visual para renderizar un {@link SchemaNode} como card.
 *
 * ### Responsabilidades
 * - Renderiza un nodo con **título** (si `titleMode !== 'none'`), **preview** de atributos
 *   (`jsonMeta.attributes`) y **badges** con conteos de arrays no escalares (`jsonMeta.arrayCounts`).
 * - Permite **template custom** vía `cardTemplate` (inserta el nodo como `$implicit`).
 * - Expone **acentos visuales** según settings de `colors` y `dataView`.
 * - Muestra un **botón de colapso/expansión** overlay cuando:
 *     - `showCollapseControls === true` **y**
 *     - `hasChildren === true`.
 *   El botón **no interfiere** con el contenido del template.
 * - Emite `nodeClick` y `toggleRequest` sin burbujas de eventos.
 *
 * ### Inputs
 * - `node`: nodo actual a renderizar.
 * - `cardTemplate`: ng-template custom (opcional).
 * - `settings`: configuración por secciones (colors/layout/dataView/debug).
 * - `hasChildren`: indica si el nodo tiene hijos en el grafo completo (para mostrar el botón).
 * - `showCollapseControls`: fuerza la visibilidad del botón (controlado por el contenedor).
 * - `isCollapsed`: estado visual para rotar el ícono del botón.
 *
 * ### Outputs
 * - `nodeClick(SchemaNode)`: emitido al click sobre la card (selección).
 * - `toggleRequest(SchemaNode)`: emitido al click del botón overlay de colapso/expansión.
 *
 * ### Accesibilidad
 * - El botón tiene `aria-pressed` según `isCollapsed`.
 *
 * ### Rendimiento
 * - `ChangeDetectionStrategy.OnPush` para minimizar recalculos.
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
      <!-- Botón superpuesto: no interfiere con el contenido -->
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
          <div class="card-title" *ngIf="showTitle()">
            {{ node()?.jsonMeta?.title || node()?.label }}
          </div>

          <div
            class="card-preview"
            *ngIf="node()?.jsonMeta?.attributes as attrs"
          >
            <div *ngFor="let kv of objToPairs(attrs)" class="kv">
              @if (kv[0] != view().accentByKey) {
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
        span {
          font-size: 0.5rem;
        }
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
  // ===== Inputs =====

  /**
   * Nodo que se va a renderizar.
   * @required
   * @remarks Debe contener `jsonMeta` si se desea mostrar título/preview por defecto.
   */
  node = input.required<SchemaNode>();

  /**
   * Template personalizado para el contenido de la card.
   * - Se invoca con el nodo como `$implicit`.
   * - Si no se asigna, se usa el template por defecto (título + preview).
   */
  cardTemplate = input<TemplateRef<any> | null>(null);

  /**
   * Settings efectivos (mergeados por el contenedor).
   * Se usan `colors`, `dataView` y `debug` para aplanar las opciones de la card.
   * @default DEFAULT_SETTINGS
   */
  settings = input<SchemaSettings>(DEFAULT_SETTINGS);

  /**
   * Indica si el nodo posee hijos en el grafo completo.
   * Controla la visibilidad del botón de colapso cuando `showCollapseControls` es true.
   * @default false
   */
  hasChildren = input<boolean>(false);

  /**
   * Control visual de la presencia del botón de colapso.
   * Normalmente lo controla el contenedor según `dataView.enableCollapse`.
   * @default false
   */
  showCollapseControls = input<boolean>(false);

  /**
   * Estado visual del toggle (rota el ícono de la chevron).
   * @default false
   */
  isCollapsed = input<boolean>(false);

  // ===== Outputs =====

  /** Emite cuando se hace click en la card (selección del nodo actual). */
  @Output() nodeClick = new EventEmitter<SchemaNode>();

  /** Emite cuando se solicita colapsar/expandir este nodo (click al botón overlay). */
  @Output() toggleRequest = new EventEmitter<SchemaNode>();

  // ====== Vista aplanada para el template (evita repetir lookups) ======
  /**
   * `view`: computed con las propiedades planas que usa la card, derivadas de `settings`.
   * Esto evita recalcular y ensuciar el template con múltiples accesos anidados.
   */
  view = computed(() => {
    const s = this.settings() ?? DEFAULT_SETTINGS;
    return {
      // dataView
      titleMode: s.dataView?.titleMode ?? 'auto',
      maxCardWidth: s.dataView?.maxCardWidth ?? null,
      maxCardHeight: s.dataView?.maxCardHeight ?? null,
      noWrapKeys: s.dataView?.noWrapKeys ?? [],

      // colors (acentos)
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

  // ===== API interna (métodos de ayuda) =====

  /** Indica si debe mostrarse el título del template por defecto. */
  showTitle(): boolean {
    return (this.view().titleMode ?? 'auto') !== 'none';
  }

  /**
   * Manejador de click sobre la card.
   * - Detiene la propagación para no afectar el stage/pan.
   * - Emite `nodeClick` con el nodo actual.
   */
  onClick(event: MouseEvent) {
    event.stopPropagation();
    this.nodeClick.emit(this.node()!);
  }

  /**
   * Convierte un objeto plano en una lista de pares [clave, valor].
   * @param obj Objeto a convertir.
   * @returns Array de pares, preservando el orden enumerado.
   */
  objToPairs(obj: Record<string, any>) {
    return Object.entries(obj);
  }

  /**
   * Manejador de click del botón de colapso/expansión overlay.
   * - Detiene la propagación.
   * - Emite `toggleRequest` con el nodo actual.
   */
  onToggle(event: MouseEvent) {
    event.stopPropagation();
    this.toggleRequest.emit(this.node()!);
  }

  /**
   * Calcula clases CSS de acento según:
   * - `view().accentByKey` y valor booleano/null en `node.data[k]`.
   * - `view().accentFill` y `view().accentInverse`.
   * - `view().showColorTrue/False/Null`.
   *
   * @returns Array de clases: `accent-true|false|null` y, si aplica, `accent-fill-*`.
   */
  getAccentClasses(): string[] {
    const {
      accentByKey,
      accentFill,
      accentInverse,
      showColorTrue,
      showColorFalse,
      showColorNull,
    } = this.view();
    if (!accentByKey) return [];

    const v = this.node()?.data?.[accentByKey];
    const classes: string[] = [];

    if (accentInverse) {
      if (v === true && showColorTrue) classes.push('accent-false');
      if (v === false && showColorFalse) classes.push('accent-true');
      if (v === null && showColorNull) classes.push('accent-null');
      if (accentFill) {
        if (v === true && showColorTrue) classes.push('accent-fill-false');
        if (v === false && showColorFalse) classes.push('accent-fill-true');
        if (v === null && showColorNull) classes.push('accent-fill-null');
      }
      return classes;
    } else {
      if (v === true && showColorTrue) classes.push('accent-true');
      if (v === false && showColorFalse) classes.push('accent-false');
      if (v === null && showColorNull) classes.push('accent-null');
      if (accentFill) {
        if (v === true && showColorTrue) classes.push('accent-fill-true');
        if (v === false && showColorFalse) classes.push('accent-fill-false');
        if (v === null && showColorNull) classes.push('accent-fill-null');
      }
      return classes;
    }
  }

  /**
   * Indica si una determinada clave debe representarse en **una sola línea** (nowrap).
   * @param key Clave a evaluar.
   * @returns `true` si `key` está incluida en `dataView.noWrapKeys`.
   */
  isNoWrapKey(key: string): boolean {
    return this.view().noWrapKeys.includes(key);
  }
  /**
   * Devuelve el glifo del botón colapsar/expandir según:
   * - Dirección del layout (RIGHT → ◀/▶, DOWN → ▲/▼)
   * - Estado actual (colapsado = mostrar “expandir”, expandido = mostrar “colapsar”)
   */
  arrowGlyph(): string {
    const dir =
      this.settings()?.layout?.layoutDirection ??
      DEFAULT_SETTINGS.layout.layoutDirection;
    const collapsed = !!this.isCollapsed();

    if (dir === 'DOWN') {
      // Colapsado → mostrar “expandir hacia abajo” (▼)
      // Expandido → mostrar “colapsar hacia arriba” (▲)
      return collapsed ? '▼' : '▲';
    }

    // RIGHT (por defecto):
    // Colapsado → mostrar “expandir hacia la derecha” (▶)
    // Expandido → mostrar “colapsar hacia la izquierda” (◀)
    return collapsed ? '▶' : '◀';
  }
}
