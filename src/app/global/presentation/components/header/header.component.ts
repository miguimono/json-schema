import {Component, OnInit} from '@angular/core';
import {MenuItemModel} from '../../../domain/models/MenuItemModel';
import {AuthService} from '../../../../users/presentation/services/auth-service.service';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
})
export class HeaderComponent implements OnInit {

  opcionesMenu!: MenuItemModel[];
  isOpen: boolean = false;
  year: number = new Date().getFullYear();

  constructor(private _authService:AuthService) {
    this.opcionesMenu = [
      {
        icon: "agregar-icon",
        name: "Creación De Bolsa",
        route: "/crear-bolsa"
      },
      {
        icon: "portapapeles-icon",
        name: "Gestión Captación",
        route: "/gestion-captacion"
      },
      {
        icon: "escudo-icon",
        name: "Gestión Retención",
        route: "/gestion-retencion"
      },
      {
        icon: "editar-icon",
        name: "Edición Bolsas",
        route: "/editar-bolsa"
      },
      {
        icon: "eliminar-icon",
        name: "Eliminar Bolsas",
        route: "/eliminar-bolsa"
      },
      {
        icon: "aprobacion-icon",
        name: "Aprobacion Bolsas",
        route: "/aprobacion-bolsa"
      },
      {
        icon: "reportes-icon",
        name: "Consultas Y Reportes",
        route: "/consulta-reportes"
      }

    ]
  }
  logoutWithAD() {
    // this._authService.logoutWithAzureDirectory();
  }
  handleMenu(): void {
    this.isOpen = !this.isOpen;
  }

  // activeOption(item: MenuItemModel) {
  //   this.opcionesMenu.forEach(it => it.isActive = false);
  //   item.isActive = true;
  // }

  ngOnInit(): void {

  }

}
