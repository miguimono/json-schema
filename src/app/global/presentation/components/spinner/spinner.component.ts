import {Component} from '@angular/core';
import {GlobalService} from "../../service/global.service";

@Component({
  selector: 'app-spinner',
  templateUrl: './spinner.component.html',
})
export class SpinnerComponent {
  isLoading$ = this.service.isLoading$;

  constructor(private readonly service: GlobalService) {
  }
}
