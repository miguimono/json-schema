import { Component, OnInit } from '@angular/core';
import { MenuItemModel } from 'src/app/global/domain/models/MenuItemModel';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';

@Component({
  selector: 'app-breadcrumb',
  templateUrl: './breadcrumb.component.html',
})
export class BreadcrumbComponent implements OnInit {

  historical!: MenuItemModel[];
  constructor(private _router: Router) {
    _router.events
      .pipe(filter(evt => evt instanceof NavigationEnd))
      .subscribe((_val: any) => {
        this.historical = [];

        let path: string = _val.urlAfterRedirects;
        path = path.split("?")[0];

        let paths: string[] = path.split("/");
        paths.shift();

        let el:string = "/";

        for (let index = 0; index < paths.length; index++) {


          el = el + paths[index]+"/";


          this.historical.push(

            {
              route: el,
              icon: "",
              name: paths[index].replace("-", " "),
              isActive: false
            }

          )
        }

        this.historical[this.historical.length-1].isActive=true;


      })
  }

  ngOnInit(): void {

  }

}
