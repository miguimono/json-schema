import { Component, OnInit } from "@angular/core";
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { AuthService } from "../../services/auth-service.service";
import { MatSnackBar, MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition } from "@angular/material/snack-bar";
import { DomSanitizer } from "@angular/platform-browser";
import { catchError } from "rxjs/operators";

@Component({
  selector: "app-login",
  templateUrl: "./login.component.html",
  styleUrls: ["./login.component.scss"],
})
export class LoginComponent implements OnInit {
  subTitleStart: string = "Name of";
  subTitleEnd: string = " Application";
  horizontalPosition: MatSnackBarHorizontalPosition = "center";
  verticalPosition: MatSnackBarVerticalPosition = "top";
  imageSource: any = "";
  userForm!: FormGroup;
  public isImageEnableCaptcha: boolean = false;
  space: string = "";
  isLoadingCaptcha: boolean = false;

  constructor(
    private readonly fb: FormBuilder,
    private sanitizer: DomSanitizer,
    private authService: AuthService,
    private snackBar: MatSnackBar,
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.userForm = this.initForm();

    /** Captcha generate */
    this.authService.generateCaptcha().subscribe((data: any) => {
      this.isImageEnableCaptcha = true;
      this.imageSource = this.sanitizer.bypassSecurityTrustResourceUrl(`data:image/png;base64, ${data.values.Image}`);
      this.space = data.values.space;
    });
  }

  /** Form initialization */
  initForm(): FormGroup {
    return this.fb.group({
      nameUser: ["", Validators.required],
      password: ["", Validators.required],
      codigo: ["", Validators.required],
    });
  }

  /** Button form Send */
  onSubmitDataUser() {
    this.validateLogin();
  }

  /** Validate Login **/
  private validateLogin() {
    const userEncrypt = this.authService.generateDataRsa(this.userNameFc.value);
    const passEncrypt = this.authService.generateDataRsa(this.passwordFc.value);
    const space = this.space;
    const code = this.userForm.value.codigo;

    const params = new URLSearchParams();
    params.set("username", userEncrypt);
    params.set("password", passEncrypt);
    params.set("space", space);
    params.set("code", code);
    const body = params.toString();

    return this.authService.postValidateLogin(body)
      .pipe(
        catchError((error: any) => {
          throw error;
        }),
      )
      .subscribe((response: any) => {
        console.log(response);
        if (response.status === "200 OK") {
          console.log("SUCCESS, validando el usuario y el captcha.");
          this.addDataSession(response);
          this.openSnackBar(`Bienvenido: ${this.userNameFc.value}` +
            ", token almacenado en localStorage.", "Cerrar");
        }
      });
  }

  /** Save Token in LocalStorage **/
  private addDataSession(response: any) {
    sessionStorage.setItem("token", response.token);
  }

  /** Username input */
  get getUser() {
    return this.userForm.get("nameUser");
  }

  /** Password input */
  get getPassword() {
    return this.userForm.get("password");
  }

  /** Code Captcha input */
  get getCodigo() {
    return this.userForm.get("codigo");
  }

  /** Username input */
  get userNameFc(): FormControl {
    return this.userForm.get("nameUser") as FormControl;
  }

  /** Password input */
  get passwordFc(): FormControl {
    return this.userForm.get("password") as FormControl;
  }

  resetCaptcha() {
    this.isLoadingCaptcha = false;
    this.authService.generateCaptcha().subscribe((data: any) => {
      this.imageSource = this.sanitizer.bypassSecurityTrustResourceUrl(`data:image/png;base64, ${data.values.Image}`);
      this.space = data.values.space;
      this.isLoadingCaptcha = true;
    });
  }

  /** Snack Bar Modals */
  openSnackBar(message: string, action: string) {
    this.snackBar.open(message, action, {
      horizontalPosition: this.horizontalPosition,
      verticalPosition: this.verticalPosition,
      duration: 6000,
      panelClass: ["red-snackbar"],
    });
  }

}
