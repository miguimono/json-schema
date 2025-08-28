import {Component, EventEmitter, OnInit, Output} from "@angular/core";
import {SvgImporterComponent} from "../svg-importer/svg-importer.component";
import {FormBuilder, FormGroup, ReactiveFormsModule, Validators} from "@angular/forms";
import {CurrencyPipe, NgIf, PercentPipe} from "@angular/common";

@Component({
  standalone: true,
  selector: 'app-calculator',
  templateUrl: './calculator.html',
  imports: [
    SvgImporterComponent,
    ReactiveFormsModule,
    PercentPipe,
    CurrencyPipe,
    NgIf
  ]
})
export class CalculatorComponent implements OnInit {
  @Output() onSCLorRenovaValue: EventEmitter<number> = new EventEmitter();
  @Output() onPayClientValue: EventEmitter<number> = new EventEmitter();

  calculatorForm!: FormGroup;

  ngOnInit(): void {
    this.buildForm();
  }

  constructor(private formBuilder: FormBuilder) {
  }

  calculate() {
    this.calculatorForm.controls['percentageSCL'].setValue(0);
    this.calculatorForm.controls['equipmentValue'].setValue(0);

    let payClient = this.idValuePayClient?.value;
    let scl = this.idValueSCLorRenova?.value;

    if ("" == scl || "" == payClient) {
      if ("" == payClient)
        this.idValuePayClient?.markAsTouched();
      if ("" == scl)
        this.idValueSCLorRenova?.markAsTouched();
      return;
    }

    this.sendFatherData();

    this.calculatorForm.controls['percentageSCL'].setValue(((1 - (payClient / scl)) * 100).toFixed(1));
    this.calculatorForm.controls['equipmentValue'].setValue((scl - payClient));
  }

  private sendFatherData() {
    this.onSCLorRenovaValue.emit(this.idValueSCLorRenova?.value);
    this.onPayClientValue.emit(this.idValuePayClient?.value);
  }

  private buildForm() {
    this.calculatorForm = this.formBuilder.group({
      valueSCLorRenova: ['', Validators.required],
      valuePayClient: ['', Validators.required],
      percentageSCL: [0, Validators.required],
      equipmentValue: [0, Validators.required]
    });
  }

  get idValueSCLorRenova() {
    return this.calculatorForm.get('valueSCLorRenova');
  }

  get idValuePayClient() {
    return this.calculatorForm.get('valuePayClient');
  }

  get idPercentageSCL() {
    return this.calculatorForm.get('percentageSCL');
  }

  get idEquipment() {
    return this.calculatorForm.get('equipmentValue');
  }
}
