import {Component, EventEmitter, Input, Output} from "@angular/core";
import {SvgImporterComponent} from "../svg-importer/svg-importer.component";
import {ReactiveFormsModule} from "@angular/forms";
import {CurrencyPipe, NgForOf, NgIf} from "@angular/common";

@Component({
  standalone: true,
  selector: 'app-chips',
  templateUrl: './chips.html',
  imports: [
    SvgImporterComponent,
    ReactiveFormsModule,
    CurrencyPipe,
    NgIf,
    NgForOf
  ]
})
export class ChipsComponents {
  @Input() listIdentifications: string[] = [];
  @Output() deleteIdentification: EventEmitter<string> = new EventEmitter<string>();
  constructor() {
  }


  deleteItem(identification: string) {
    this.deleteIdentification.emit(identification);
  }
}
