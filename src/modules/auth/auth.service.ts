import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Validate a JWT token
   */
  async validateToken(token: string): Promise<any> {
    try {
      const jwtSecret = this.configService.get<string>('JWT_SECRET');
      
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not defined');
      }
      
      const payload = jwt.verify(token, jwtSecret);
      return payload;
    } catch (error) {
      this.logger.error(`Token validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Generate a JWT token (for testing purposes)
   */
  generateToken(userId: string, role: string = 'user'): string {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const expiresIn = this.configService.get<string>('JWT_EXPIRATION') || '1h';
    
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }
    
    return jwt.sign(
      { 
        sub: userId,
        role,
      },
      jwtSecret,
      { expiresIn }
    );
  }
} 