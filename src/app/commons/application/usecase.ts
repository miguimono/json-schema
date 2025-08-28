import { Observable } from "rxjs";

export default interface IUseCase<S,T>{
  execute(params?: S): Observable<T>;
}
