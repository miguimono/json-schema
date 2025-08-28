import {Injectable} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CommonsService {

  constructor() {
  }

  public getTokenUser(): string {
    let token = sessionStorage.getItem("token");
    return token ? token : '';
  }
}
