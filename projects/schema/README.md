# @miguimono/schema

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Angular](https://img.shields.io/badge/Angular-19-red.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)
![Build
Status](https://img.shields.io/badge/build-passing-brightgreen.svg)

**Schema** es una librería para **Angular 19** que transforma cualquier
objeto **JSON arbitrario** en un **grafo visual interactivo** con nodos
y conexiones.\
Está construida con **standalone components**, **Angular Material 19** y
patrones modernos como **Angular Signals** e `input()`.

Ideal para explorar, depurar y visualizar jerarquías de datos complejos
en aplicaciones empresariales.

---

## ✨ Características

- Convierte cualquier JSON en un grafo navegable.
- Basada en **ELK.js** para layout automático (dirección `RIGHT` o
  `DOWN`, ruteo ortogonal).
- Soporte para **zoom, pan y reset de vista**.
- Nodos renderizados como **cards personalizables** (`ng-template`).
- **Vista previa de atributos** con truncamiento configurable.
- **Acento visual por clave booleana** (`true`, `false`, `null`).
- **Collapse/expand per node** con animación (opcional).
- Auto-resize de cards midiendo el DOM real.
- Toolbar integrada con controles de zoom, enlaces y alineación.
- Totalmente **typed con TypeScript 5**.

---

## 📦 Instalación

```bash
npm install @miguimono/schema
```

> Requiere Angular **19.0.0+** y TypeScript **5.x**.

---

## 🚀 Uso Básico

```ts
import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { SchemaComponent } from "@miguimono/schema";

@Component({
  selector: "app-demo",
  standalone: true,
  imports: [CommonModule, SchemaComponent],
  template: `<schema [data]="exampleJson"></schema>`,
})
export class DemoComponent {
  exampleJson = {
    central: {
      central_name: "Centro | Bogotá",
      cables: [
        { cable_name: "GA-05", in_damage: true },
        { cable_name: "GA-06", in_damage: false },
      ],
    },
  };
}
```

---

## 🎨 Personalización

---

Input Tipo Default Descripción

---

`data` `any` --- (requerido) JSON arbitrario a graficar.

`settings` `SchemaSettings` `DEFAULTS` Configuración estructurada
(recomendado).

`options` `SchemaOptions` `DEFAULTS` Configuración plana (back-compat).

`cardTemplate` `TemplateRef<any>` `null` Plantilla custom para renderizar nodos.

`isLoading` `boolean` `false` Muestra overlay de carga.

`isError` `boolean` `false` Muestra overlay de error.

`emptyMessage` `string` `"No hay datos"` Texto cuando no hay información.

`loadingMessage` `string` `"Cargando…"` Texto de carga.

`errorMessage` `string` `"Error…"` Texto de error.

---

---

## ⚙️ Configuración avanzada

Ejemplo de `SchemaSettings`:

```ts
settings: SchemaSettings = {
  messages: { isLoading: false },
  viewport: { height: 800, showToolbar: true },
  colors: {
    accentByKey: "in_damage",
    accentFill: true,
    showColorTrue: true,
    showColorFalse: true,
    showColorNull: true,
  },
  layout: { layoutDirection: "RIGHT", linkStyle: "orthogonal" },
  dataView: {
    titleKeyPriority: ["name", "id"],
    enableCollapse: true,
    defaultNodeSize: { width: 220, height: 96 },
  },
};
```

---

## 🧩 Personalizar Cards

```html
<schema [data]="data" [cardTemplate]="customTpl"></schema>

<ng-template #customTpl let-node>
  <div style="padding:8px; max-width:400px">
    <div style="font-weight:600">{{ node.jsonMeta?.title }}</div>
    <div *ngFor="let kv of node.jsonMeta?.attributes | keyvalue"><strong>{{ kv.key }}</strong>: {{ kv.value }}</div>
  </div>
</ng-template>
```

---

## 🔀 Collapse / Expand (v0.4.8+)

Activa `enableCollapse` en `SchemaSettings.dataView` para mostrar
botones de colapso.

---

## 📄 Licencia

[MIT](./LICENSE) © 2025 [Miguel Niño
(@miguimono)](https://github.com/miguimono)
