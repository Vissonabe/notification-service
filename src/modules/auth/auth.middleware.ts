import { Injectable, NestMiddleware, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  constructor(private readonly authService: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        throw new UnauthorizedException('Missing authorization header');
      }
      
      const token = authHeader.split(' ')[1];
      
      if (!token) {
        throw new UnauthorizedException('Invalid authorization token format');
      }
      
      // Validate token using AuthService
      const payload = await this.authService.validateToken(token);
      
      // Add user info to request for controllers to use
      req['user'] = payload;
      
      next();
    } catch (error) {
      this.logger.error(`Authentication failed: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
} 