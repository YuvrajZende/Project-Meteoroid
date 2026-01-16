import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip } = req;
    const userAgent = req.get('User-Agent') || '';
    const startTime = Date.now();

    this.logger.log(
      `Incoming Request: ${method} ${originalUrl} - ${ip} - ${userAgent}`,
    );

    const originalSend = res.send;
    (res as any).send = function (body) {
      (res as any).body = body;
      return originalSend.call(this, body);
    };

    res.on('finish', () => {
      const { statusCode } = res;
      const contentLength = res.get('content-length') || 0;
      const responseTime = Date.now() - startTime;
      const body = (res as any).body;

      this.logger.log(
        `Outgoing Response: ${method} ${originalUrl} - ${statusCode} - ${contentLength} bytes - ${responseTime}ms`,
      );
    });

    next();
  }
}
