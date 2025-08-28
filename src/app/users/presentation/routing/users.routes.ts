import { Routes } from '@angular/router';
import { LoginComponent as UsersLoginComponent} from '../components/login/login.component';

export const UserRoutes: Routes = [
  {
    path: "",
    pathMatch:"full",
    component: UsersLoginComponent
  }
];
