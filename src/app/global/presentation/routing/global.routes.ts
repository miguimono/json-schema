import { Routes } from '@angular/router';
import { NotFoundComponent as GlobalNotFoundComponent} from '../components/not-found/not-found.component';
import { ForbiddenComponent as GlobalForbiddenComponent} from '../components/forbidden/forbidden.component';

export const GlobalRoutes: Routes = [

  {
    path: "forbidden",
    component: GlobalForbiddenComponent
  },
  {
    path: "not-found",
    component: GlobalNotFoundComponent
  }

];
