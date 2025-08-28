import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import {httpInterceptorProviders} from "./_helpers/http.interceptor";
import {CookieService} from "ngx-cookie-service";
import {MatSnackBarModule} from "@angular/material/snack-bar";
import {UsersModule} from "./users/users.module";
import {GlobalModule} from "./global/global.module";
import {BrowserAnimationsModule} from "@angular/platform-browser/animations";
import {FormsModule, ReactiveFormsModule} from "@angular/forms";
import {HttpClientModule} from "@angular/common/http";

export function getBaseUrl() {
  return document.getElementsByTagName('base')[0].href;
}

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    BrowserAnimationsModule,
    GlobalModule,
    UsersModule,
    MatSnackBarModule
  ],
  providers: [
    CookieService,
    httpInterceptorProviders,
    {
      provide: 'BASE_URL', useFactory: getBaseUrl
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
