import {NgModule} from '@angular/core';
import {CommonModule, NgOptimizedImage} from '@angular/common';
import {LoginComponent} from './presentation/components/login/login.component';
import {SignupComponent} from './presentation/components/signup/signup.component';
import {ForgetPasswordComponent} from './presentation/components/forget-password/forget-password.component';
import {UserRoutingModule} from './presentation/routing/users-routing.module';
import {SvgImporterComponent} from '../global/presentation/components/svg-importer/svg-importer.component';
import {ReactiveFormsModule} from "@angular/forms";
import {HTTP_INTERCEPTORS, HttpClientModule} from "@angular/common/http";
import {MatButtonModule} from "@angular/material/button";
import {UserInterceptor} from "./presentation/interceptors/user.interceptor";
import {modalComponent} from "../global/presentation/components/modal/modal";


@NgModule({
  declarations: [
    LoginComponent,
    SignupComponent,
    ForgetPasswordComponent
  ],
  imports: [
    CommonModule,
    UserRoutingModule,
    SvgImporterComponent,
    ReactiveFormsModule,
    HttpClientModule,
    MatButtonModule,
    NgOptimizedImage,
    modalComponent,
  ],
  providers: [{
    provide: HTTP_INTERCEPTORS,
    useClass: UserInterceptor,
    multi: true
  }]
})
export class UsersModule {
}
