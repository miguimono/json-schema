import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { GlobalRoutes } from './global.routes';



@NgModule({
  imports: [RouterModule.forChild(GlobalRoutes)],
  exports: [RouterModule]
})
export class GlobalRoutingModule { }
