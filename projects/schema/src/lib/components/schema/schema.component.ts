// path: projects/schema/src/lib/schema.component.ts

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  OnChanges,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  input,
  signal,
  computed,
} from '@angular/core';
import { JsonAdapterService } from '../../services/json-adapter.service';
import { SchemaLayoutService } from '../../services/schema-layout.service';
import {
  DEFAULT_OPTIONS,
  NormalizedGraph,
  SchemaEdge,
  SchemaNode,
  SchemaOptions,
} from '../../models';
import { NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import { SchemaCardComponent } from '../schema-card/schema-card.component';
import { SchemaLinksComponent } from '../schema-links/schema-links.component';

@Component({
  selector: 'schema',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    NgTemplateOutlet,
    SchemaCardComponent,
    SchemaLinksComponent,
  ],
  template: `
    <div
      class="schema-root"
      #root
      (wheel)="onWheel($event)"
      (mousedown)="onPointerDown($event)"
      (mousemove)="onPointerMove($event)"
      (mouseup)="onPointerUp()"
      (mouseleave)="onPointerUp()"
    >
      <div class="stage" [style.transform]="transform()">
        <schema-links
          [edges]="edges()"
          [linkStroke]="linkStroke()"
          [linkStrokeWidth]="linkStrokeWidth()"
          (linkClick)="linkClick.emit($event)"
          [width]="virtualWidth"
          [height]="virtualHeight"
        ></schema-links>

        <ng-container *ngFor="let n of nodes()">
          <schema-card
            [node]="n"
            [cardTemplate]="cardTemplate()"
            (nodeClick)="nodeClick.emit($event)"
          ></schema-card>
        </ng-container>
      </div>
    </div>
  `,
  styles: [
    `
      .schema-root {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #f7f9fb;
        border-radius: 8px;
      }
      .stage {
        position: absolute;
        left: 0;
        top: 0;
        width: 4000px;
        height: 2000px;
        transform-origin: 0 0;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaComponent implements AfterViewInit, OnChanges {
  data = input<any>();
  options = input<SchemaOptions>(DEFAULT_OPTIONS);
  linkStroke = input<string>(DEFAULT_OPTIONS.linkStroke!);
  linkStrokeWidth = input<number>(DEFAULT_OPTIONS.linkStrokeWidth!);
  cardTemplate = input<TemplateRef<any> | null>(null);

  @Output() nodeClick = new EventEmitter<SchemaNode>();
  @Output() linkClick = new EventEmitter<SchemaEdge>();

  private graph = signal<NormalizedGraph>({ nodes: [], edges: [] });
  nodes = computed(() => this.graph().nodes);
  edges = computed(() => this.graph().edges);

  @ViewChild('root', { static: true }) rootRef!: ElementRef<HTMLElement>;
  private scale = signal(1);
  private tx = signal(0);
  private ty = signal(0);
  transform = computed(
    () => `translate(${this.tx()}px, ${this.ty()}px) scale(${this.scale()})`
  );

  virtualWidth = 4000;
  virtualHeight = 2000;

  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(
    private adapter: JsonAdapterService,
    private layoutService: SchemaLayoutService
  ) {}

  ngAfterViewInit(): void {
    this.compute();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] || changes['options']) this.compute();
  }

  private async compute(): Promise<void> {
    const normalized = this.adapter.normalize(this.data(), this.options());
    const laid = await this.layoutService.layout(normalized, this.options());
    console.log('nodes:', laid.nodes.length, 'edges:', laid.edges.length);
    this.graph.set(laid);
  }

  onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = -e.deltaY;
    const zoomFactor = 1 + (delta > 0 ? 0.08 : -0.08);
    const newScale = Math.min(2.5, Math.max(0.3, this.scale() * zoomFactor));
    this.scale.set(newScale);
  }
  onPointerDown(e: MouseEvent) {
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }
  onPointerMove(e: MouseEvent) {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.tx.set(this.tx() + dx);
    this.ty.set(this.ty() + dy);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }
  onPointerUp() {
    this.dragging = false;
  }
}
