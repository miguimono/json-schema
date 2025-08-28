import {Component, EventEmitter, Input, OnInit, Output} from "@angular/core";
import {SvgImporterComponent} from "../svg-importer/svg-importer.component";

@Component({
  standalone: true,
  selector: 'app-modal',
  templateUrl: './modal.html',
  imports: [
    SvgImporterComponent
  ]
})
export class modalComponent implements OnInit {

  @Input() showModal!: boolean;
  @Input() dataText!: string;
  @Output() hiddenModal: EventEmitter<boolean> = new EventEmitter();
  @Output() responseModal: EventEmitter<boolean> = new EventEmitter();

  ngOnInit(): void {
  }

  toggleModal() {
    this.hiddenModal.emit(false);
  }

  response() {
    this.responseModal.emit(true)
  }
}
