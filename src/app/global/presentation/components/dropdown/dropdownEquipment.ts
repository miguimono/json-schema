import {Component, EventEmitter, Input, OnInit, Output, ViewChild} from "@angular/core";
import {FormBuilder, FormGroup, FormsModule, ReactiveFormsModule} from "@angular/forms";
import {AsyncPipe, CurrencyPipe, NgForOf, NgIf, PercentPipe} from "@angular/common";
import {GlobalModule} from "../../../global.module";
import {PhoneValuesModel} from "../../../../commons/domain/models/PhoneValuesModel";
import {GlobalService} from "../../service/global.service";
import {MatSelect, MatSelectModule} from "@angular/material/select";
import {NgxMatSelectSearchModule} from "ngx-mat-select-search";
import {ReplaySubject, Subject, take, takeUntil} from "rxjs";

@Component({
  standalone: true,
  selector: 'app-dropdown-equipment',
  templateUrl: './dropdownEquipment.html',
  imports: [
    ReactiveFormsModule,
    PercentPipe,
    CurrencyPipe,
    NgIf,
    NgForOf,
    FormsModule,
    GlobalModule,
    MatSelectModule,
    NgxMatSelectSearchModule,
    AsyncPipe
  ]
})
export class DropdownComponent implements OnInit {
  form!: FormGroup;
  listPhones?: PhoneValuesModel[];
  @Input() selectedItem: string = '';
  @Output() OnChange: EventEmitter<PhoneValuesModel> = new EventEmitter<PhoneValuesModel>();
  @ViewChild('singleSelect', {static: true}) singleSelect?: MatSelect;

  /** list of phones filtered by search keyword */
  public filteredPhones: ReplaySubject<PhoneValuesModel[]> = new ReplaySubject<PhoneValuesModel[]>(1);

  /** Subject that emits when the component has been destroyed. */
  protected _onDestroy = new Subject<void>();
  clean$ = this.service.isLoading$;

  constructor(private service: GlobalService, private builder: FormBuilder,) {
    this.buildForm();
    this.form.controls['bagManagement'].setValue('')
  }

  ngOnInit(): void {
        throw new Error("Method not implemented.");
    }

  ngAfterViewInit() {
    this.setInitialValue();
  }

  ngOnDestroy() {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

  protected setInitialValue() {
    this.filteredPhones
      .pipe(take(1), takeUntil(this._onDestroy))
      .subscribe(() => {
        // setting the compareWith property to a comparison function
        // triggers initializing the selection according to the initial value of
        // the form control (i.e. _initializeSelection())
        // this needs to be done after the filteredBanks are loaded initially
        // and after the mat-option elements are available
        // this.singleSelect.compareWith = (a: Bank, b: Bank) => a && b && a.id === b.id;
      });
  }

  protected filterBanks() {
    if (!this.listPhones) {
      return;
    }
    // get the search keyword
    let search: string = this.bankFiler?.value;
    if (!search) {
      this.filteredPhones.next(this.listPhones.slice());
      return;
    } else {
      search = search.toLowerCase();
    }
    // filter the banks
    this.filteredPhones.next(
      // @ts-ignore
      this.listPhones.filter(phone => phone.descripcion.toLowerCase().indexOf(search) > -1)
    );
  }

  itemSelected(phone: PhoneValuesModel) {
    if (phone.descripcion)
      this.selectedItem = phone.descripcion;
    this.OnChange.emit(phone);
  }

  private buildForm() {
    this.form = this.builder.group({
      bankFilterCtrl: [''],
      bagManagement: ['']
    });
  }

  get bankFiler() {
    return this.form.get('bankFilterCtrl');
  }
}
