import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {SidenavComponent} from './presentation/components/sidenav/sidenav.component';
import {HeaderComponent} from './presentation/components/header/header.component';
import {ContainerComponent} from './presentation/components/container/container.component';
import {FooterComponent} from './presentation/components/footer/footer.component';
import {NotFoundComponent} from './presentation/components/not-found/not-found.component';
import {ForbiddenComponent} from './presentation/components/forbidden/forbidden.component';
import {GlobalRoutingModule} from './presentation/routing/global-routing.module';
import {SvgImporterComponent} from './presentation/components/svg-importer/svg-importer.component';
import {BreadcrumbComponent} from './presentation/components/breadcrumb/breadcrumb.component';
import {FilterPipe} from './pipes/filter.pipe';
import {MatListModule} from "@angular/material/list";
import {HTTP_INTERCEPTORS} from "@angular/common/http";
import {GlobalInterceptor} from "./presentation/interceptors/global-interceptor.service";
import { SpinnerComponent } from './presentation/components/spinner/spinner.component';


@NgModule({
  declarations: [
    SidenavComponent,
    HeaderComponent,
    ContainerComponent,
    FooterComponent,
    NotFoundComponent,
    ForbiddenComponent,
    BreadcrumbComponent,
    FilterPipe,
    SpinnerComponent,
  ],
  exports: [
    SidenavComponent,
    HeaderComponent,
    ContainerComponent,
    FooterComponent,
    BreadcrumbComponent,
    FilterPipe,
    SpinnerComponent
  ],
  imports: [
    CommonModule,
    GlobalRoutingModule,
    SvgImporterComponent,
    MatListModule
  ],
  providers: [{
    provide: HTTP_INTERCEPTORS,
    useClass: GlobalInterceptor,
    multi: true,
  }]
})
export class GlobalModule {
}
