import {Injectable} from '@angular/core';
import {HttpEvent, HttpHandler, HttpHeaders, HttpInterceptor, HttpRequest} from '@angular/common/http';
import {finalize, Observable} from 'rxjs';
import {CommonsService} from "../../../commons/service/commons.service";
import {GlobalService} from "../service/global.service";

@Injectable()
export class GlobalInterceptor implements HttpInterceptor {

  constructor(private userData: CommonsService, private readonly service: GlobalService) {
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    this.service.show();
    let reqClone;
    let token = this.userData.getTokenUser();
    let headers = new HttpHeaders({
      'userToken': token
    });

    if (token !== '') {
      reqClone = request.clone({
        headers
      });
      return next.handle(reqClone).pipe(finalize(() => this.service.hide()));
    }

    return next.handle(request).pipe(finalize(() => this.service.hide()));
  }
}
