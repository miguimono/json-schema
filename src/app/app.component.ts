import {Component} from '@angular/core';
import {AuthService} from './users/presentation/services/auth-service.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = 'angular-front-end-login-base';
  isIframe = false;

  constructor(private _authService: AuthService) {
  }
}
