// URL: projects/schema-ng19/src/lib/components/schema-card.component.ts

/**
 * Componente: SchemaCardComponent
 * ----------------------------------------------------------------------------
 * Renderiza un `SchemaNode` como tarjeta posicionada en el “stage”.*
 * Responsabilidades:
 *  - Mostrar título, atributos de vista previa y badges de arrays no escalares.
 *  - Soportar una miniatura de imagen opcional (grupo de settings de imagen).
 *  - Emitir eventos de interacción: click de nodo y solicitud de colapso.
 *  - Aplicar clases de acento (accent-true/false/null y variantes fill).
 *
 * Reglas:
 *  - La posición (left/top) y tamaño (width/height) vienen del layout/medición.
 *  - No calcula layout; solo representa el nodo con base en `SchemaSettings`.
 *  - Si `cardTemplate` está definido, se usa en lugar del template por defecto.
 *
 * Imagen (grupo completo en `settings.dataView`):
 *  - `showImage`: clave en `node.data` con la URL a mostrar (si existe).
 *  - `imageSizePx`: tamaño en px del cuadro (ancho/alto iguales).
 *  - `imageShape`: "square" | "rounded" | "circle".
 *  - `imageBorder`: borde sutil opcional alrededor de la miniatura.
 *  - `imageBg`: color/fondo CSS del cuadro de imagen (e.g., "transparent").
 *  - `imageFit`: "contain" | "cover" | "scale-down" (mapea a `object-fit`).
 *  - `imageFallback`: URL local/remota a usar si la imagen falla (no implementado aquí).
 *
 * Acentos (grupo `settings.colors`):
 *  - `accentByKey`: clave booleana en `node.data`. Si no hay clave, no hay acento.
 *  - `accentInverse`: invierte la semántica (true↔false).
 *  - `accentFill`: si `true`, además del borde aplica fondo suave.
 *  - `showColorTrue/False/Null`: habilitan visuales para cada caso.
 *
 * Vista previa:
 *  - `jsonMeta.attributes` se deriva en el adapter y se trunca según settings globales.
 *  - Las claves incluidas en `noWrapKeys` se presentan en una sola línea (nowrap).
 *
 * Accesibilidad:
 *  - `alt` para la imagen se deriva del título o `label` del nodo.
 *
 * Nota:
 *  - Este componente no decide si se muestra el botón de colapso; expone
 *    `showCollapseControls` e `isCollapsed`, y emite `toggleRequest`. La UI del
 *    botón puede implementarse en el template custom si se usa `cardTemplate`.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Output, TemplateRef, computed, input } from "@angular/core";
import { SchemaNode, SchemaSettings, DEFAULT_SETTINGS, ImageShape } from "../models";
import { CommonModule, NgTemplateOutlet } from "@angular/common";

@Component({
  selector: "schema-card",
  standalone: true,
  imports: [CommonModule, NgTemplateOutlet],
  templateUrl: "./schema-card.component.html",
  styleUrl: "./schema-card.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaCardComponent {
  /* ============================ Inputs ============================ */

  /** Nodo a representar. Requerido. */
  node = input.required<SchemaNode>();

  /** Template alternativo para renderizar la card (reemplaza al default). */
  cardTemplate = input<TemplateRef<any> | null>(null);

  /** Settings efectivos aplicables a la card (colores, imagen, etc.). */
  settings = input<SchemaSettings>(DEFAULT_SETTINGS);

  /** Indica si este nodo tiene hijos (para mostrar controles de colapso). */
  hasChildren = input<boolean>(false);

  /** Controla si se muestra la UI de colapso (el botón/indicador). */
  showCollapseControls = input<boolean>(false);

  /** Indica si el nodo está colapsado (para iconografía/estado visual). */
  isCollapsed = input<boolean>(false);

  /* ============================ Outputs =========================== */

  /** Click del usuario sobre la card (burbujeo controlado). */
  @Output() nodeClick = new EventEmitter<SchemaNode>();

  /** Solicitud de colapso/expandir desde la card. */
  @Output() toggleRequest = new EventEmitter<SchemaNode>();

  /* ============================ View derivada ===================== */

  /**
   * Vista aplanada derivada de `settings`.
   * - Si `accentByKey` está definido y no hay showColor* en true,
   *   se activan internamente los tres (true/false/null) para visual por defecto.
   */
  view = computed(() => {
    const s = this.settings() ?? DEFAULT_SETTINGS;

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
      // Activación interna por DX; no modifica settings globales
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

      // Defaults para tamaño en ausencia de medición
      defaultNodeW: DEFAULT_SETTINGS.dataView.defaultNodeSize?.width ?? 120,
      defaultNodeH: DEFAULT_SETTINGS.dataView.defaultNodeSize?.height ?? 60,

      // Acentos
      accentByKey,
      accentFill,
      accentInverse,
      showColorTrue: showTrue,
      showColorFalse: showFalse,
      showColorNull: showNull,
    };
  });

  /* ============================ API interna ======================= */

  /** Emite click del nodo y evita burbujeo accidental. */
  onClick(event: MouseEvent) {
    event.stopPropagation();
    const n = this.node();
    if (n) this.nodeClick.emit(n);
  }

  /** Emite solicitud de toggle (colapso/expandir). */
  onToggle(event: MouseEvent) {
    event.stopPropagation();
    const n = this.node();
    if (n) this.toggleRequest.emit(n);
  }

  /** Convierte objeto a pares clave-valor iterables. */
  objToPairs(obj: Record<string, unknown>) {
    const entries = Object.entries(obj ?? {});
    const imgKey = this.view().showImageKey;
    const accentKey = this.view().accentByKey;

    return entries.filter(([k]) => {
      if (imgKey && k === imgKey) return false; // Oculta la URL de imagen
      if (accentKey && k === accentKey) return false; // Oculta la clave de acento (true/false)
      return true;
    });
  }

  /** Clave configurada para la imagen; `null` si no hay. */
  private showImageKey(): string | null {
    const k = this.view().showImageKey;
    return k && typeof k === "string" && k.trim() ? k : null;
  }

  /** URL de imagen si existe y es válida. */
  imageSrc(): string | null {
    const key = this.showImageKey();
    if (!key) return null;
    const v = this.node()?.data?.[key];
    return typeof v === "string" && v.trim() !== "" ? v : null;
  }

  /** Texto alternativo accesible para la miniatura. */
  imageAlt(): string {
    const n = this.node();
    if (!n) return "imagen";
    return n.jsonMeta?.title || n.label || "imagen";
  }

  /**
   * Determina clases de acento según `accentByKey` y flags de color.
   * No aplica estilos si `accentByKey` no está definido en `node.data`.
   */
  getAccentClasses(): string[] {
    const v = this.view();
    const k = v.accentByKey;
    if (!k) return [];
    const n = this.node();
    const val = n?.data?.[k];

    const classes: string[] = [];
    const pushIf = (cond: boolean, cls: string) => {
      if (cond) classes.push(cls);
    };

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

  /** Indica si una clave debe mostrarse en una sola línea. */
  isNoWrapKey(key: string): boolean {
    const arr = this.view().noWrapKeys ?? [];
    return Array.isArray(arr) ? arr.includes(key) : false;
  }

  /** Glifo de flecha para estados colapsado/expandido (cuando se use). */
  arrowGlyph(): string {
    const dir = this.settings()?.layout?.layoutDirection ?? DEFAULT_SETTINGS.layout.layoutDirection;
    const collapsed = !!this.isCollapsed();
    if (dir === "DOWN") return collapsed ? "▼" : "▲";
    return collapsed ? "▶" : "◀";
  }

  /** Presentación del valor (aplica truncamiento cuando corresponde). */
  displayValue(val: unknown): string {
    const str = val == null ? String(val) : String(val);
    const limit = this.view().valueMaxChars;
    if (typeof limit === "number" && limit > 0 && str.length > limit) {
      return str.slice(0, limit) + "…";
    }
    return str;
  }

  /** Tooltip con el valor completo (si está habilitado). */
  valueTitle(val: unknown): string | null {
    if (!this.view().valueShowTooltip) return null;
    return val == null ? String(val) : String(val);
  }

  /** Mapea clave a etiqueta legible, si está definida en `labelData`. */
  displayKey(key: string): string {
    const map = this.view().labelData ?? {};
    return Object.prototype.hasOwnProperty.call(map, key) ? (map as any)[key] : key;
  }

  /** Indica si existe un título calculado para la card. */
  hasComputedTitle(): boolean {
    const t = this.node()?.jsonMeta?.title;
    return !!t && String(t).trim() !== "";
  }

  /**
   * Manejo de error en carga de imagen:
   *  - Si existe `imageFallback` y no se intentó antes, usarla (una sola vez).
   *  - Si no hay fallback o ya falló, remover `src` y aplicar fondo suave.
   */
  onImgError(ev: Event) {
    const el = ev.target as HTMLImageElement | null;
    if (!el) return;

    const ds = el.dataset;
    const tried = ds["fallbackApplied"] === "1";
    const fallback = this.view().imageFallback;

    if (fallback && !tried) {
      ds["fallbackApplied"] = "1";
      el.src = fallback;
      return;
    }

    // Sin fallback (o ya falló)
    el.removeAttribute("src");
    if (!this.view().imageBg) {
      el.style.background = "#e2e8f0";
    }
    if (this.view().imageBorder === undefined) {
      el.style.border = "1px solid rgba(0,0,0,0.06)";
    }
  }
}
