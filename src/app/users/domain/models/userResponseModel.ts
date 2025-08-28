import {RoleModel} from "./roleModel";

export interface UserResponseModel {
  "responseCode": number,
  "message": string,
  "userLoginData": {
    "userName": string,
    "groups": [],
    "roles": RoleModel[]
  }
}
