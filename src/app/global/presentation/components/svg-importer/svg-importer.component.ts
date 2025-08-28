import {Component, Input, OnInit} from '@angular/core';
import {IconNamesEnum} from '../../../domain/models/IconNamesEnum';

@Component({
  standalone: true,
  selector: 'app-svg-importer',
  templateUrl: './svg-importer.component.html',
})
export class SvgImporterComponent implements OnInit {
  agregarIcon: boolean = false;
  portapapelesIcon: boolean = false;
  escudoIcon: boolean = false;
  editarIcon: boolean = false;
  eliminarIcon: boolean = false;
  aprobacionIcon: boolean = false;
  reportesIcon: boolean = false;
  movistarIcon: boolean = false;
  menuIcon: boolean = false;
  closeIcon: boolean = false;
  identityIcon: boolean = false;
  keyIcon: boolean = false;
  alertIcon: boolean = false;
  addIcon: boolean = false;
  padlockIcon: boolean = false;
  shutIcon: boolean = false;
  defaultIcon: boolean = false;
  puzzle2Icon: boolean = false;
  identityUserIcon: boolean = false;
  @Input() classes: string = "";
  @Input() iconName: string = "";

  ngOnInit(): void {
    this.agregarIcon = this.iconName === IconNamesEnum.AGREGAR_ICON;
    this.portapapelesIcon = this.iconName === IconNamesEnum.PORTAPAPELES_ICON;
    this.escudoIcon = this.iconName === IconNamesEnum.ESCUDO_ICON;
    this.editarIcon = this.iconName === IconNamesEnum.EDITAR_ICON;
    this.eliminarIcon = this.iconName === IconNamesEnum.ELIMINAR_ICON;
    this.aprobacionIcon = this.iconName === IconNamesEnum.APROBACION_ICON;
    this.reportesIcon = this.iconName === IconNamesEnum.REPORTES_ICON;
    this.movistarIcon = this.iconName === IconNamesEnum.MOVISTAR_ICON;
    this.menuIcon = this.iconName === IconNamesEnum.MENU_ICON;
    this.closeIcon = this.iconName === IconNamesEnum.CLOSE_ICON;
    this.identityIcon = this.iconName === IconNamesEnum.IDENTITY_ICON;
    this.keyIcon = this.iconName === IconNamesEnum.KEY_ICON;
    this.addIcon = this.iconName === IconNamesEnum.ADD_LIGTH;
    this.padlockIcon = this.iconName === IconNamesEnum.PADLOCK;
    this.shutIcon = this.iconName === IconNamesEnum.SHUT_ICON;
    this.defaultIcon = this.iconName === IconNamesEnum.DEFAULT_ICON;
    this.puzzle2Icon = this.iconName === IconNamesEnum.PUZZLE2_ICON;
    this.identityUserIcon = this.iconName === IconNamesEnum.IDENTITY_USER;
  }

}
