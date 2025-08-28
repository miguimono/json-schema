export interface IAuthRepository<S>{
  setupProvider(params?:any):void;
  handleUserAuth():void;
  login(params?:any):S;
  logOut():void;
}
