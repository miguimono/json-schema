import {Component, OnInit} from '@angular/core';
import {MenuItemModel} from '../../../domain/models/MenuItemModel';
import {AuthService} from "../../../../users/presentation/services/auth-service.service";

@Component({
  selector: 'app-sidenav',
  templateUrl: './sidenav.component.html',
})

export class SidenavComponent implements OnInit {

  opcionesMenu!: MenuItemModel[];
  year: number = new Date().getFullYear();

  role = sessionStorage.getItem('role');

  constructor(private service:AuthService) {
    this.menu();
  }

  private menu() {
    this.opcionesMenu = [
      {
        icon: "agregar-icon",
        name: "Creación De Bolsa",
        route: "/crear-bolsa",
        isActive: this.role === 'developer' || this.role === 'analyst',
      },
      {
        icon: "portapapeles-icon",
        name: "Gestión Captación",
        route: "/gestion-captacion",
        isActive: this.role === 'developer' || this.role === 'manager',
      },
      {
        icon: "escudo-icon",
        name: "Gestión Retención",
        route: "/gestion-retencion",
        isActive: this.role === 'developer' || this.role === 'manager',
      },
      {
        icon: "editar-icon",
        name: "Edición Bolsas",
        route: "/editar-bolsa",
        isActive: this.role === 'developer' || this.role === 'manager',
      },
      {
        icon: "eliminar-icon",
        name: "Eliminar Bolsas",
        route: "/eliminar-bolsa",
        isActive: this.role === 'developer' || this.role === 'manager',
      },
      {
        icon: "aprobacion-icon",
        name: "Aprobacion Bolsas",
        route: "/aprobacion-bolsa",
        isActive: this.role === 'developer' || this.role === 'manager',
      },
      {
        icon: "reportes-icon",
        name: "Consultas Y Reportes",
        route: "/consulta-reportes",
        isActive: this.role === 'developer' || this.role === 'manager',
      }
    ]
  }

  logoutWithAD() {
    this.service.logout();
  }

  ngOnInit(): void {
  }

}

