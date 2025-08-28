import {Routes} from '@angular/router';
import {AuthGuard} from "./global/presentation/guards/auth-guard.service";
import {NotFoundComponent} from "./global/presentation/components/not-found/not-found.component";

export const AppRoutes: Routes = [
  {
    path: "",
    pathMatch: "full",
    loadChildren: () => import('./users/users.module').then(m => m.UsersModule)
  },
  {
    path: "",
    loadChildren: () => import('./global/global.module').then(m => m.GlobalModule),
    canActivate: [AuthGuard]
  },
  { path: '**', pathMatch: 'full',
    component: NotFoundComponent },
];
