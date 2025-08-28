import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { UserRoutes } from './users.routes';


@NgModule({
  imports: [RouterModule.forChild(UserRoutes)],
  exports: [RouterModule]
})
export class UserRoutingModule { }
