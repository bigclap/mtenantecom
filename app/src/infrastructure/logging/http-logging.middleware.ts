import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class HttpLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, ip } = req;
    const start = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - start;
      const userAgent = req.get('user-agent') || '';

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} - ${duration}ms - ${userAgent} ${ip}`,
      );
    });

    next();
  }
}
