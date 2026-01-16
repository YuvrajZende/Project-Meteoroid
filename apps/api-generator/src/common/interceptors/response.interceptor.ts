import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: boolean;
  data: T;
  timestamp: string;
  path: string;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    return next.handle().pipe(
      map((data) => {
        const processingTime = Date.now() - startTime;

        return {
          success: true,
          data,
          timestamp: new Date().toISOString(),
          path: request.url,
          processingTimeMs: processingTime,
        };
      }),
    );
  }
}
