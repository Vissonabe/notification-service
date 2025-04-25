import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as jwt from 'jsonwebtoken';

jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let service: AuthService;
  let configService: ConfigService;

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'JWT_SECRET') {
                return 'test-jwt-secret';
              }
              if (key === 'JWT_EXPIRATION') {
                return '1h';
              }
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    configService = module.get<ConfigService>(ConfigService);

    // We can't mock the logger directly as it's readonly
    // Instead, we'll spy on the logger methods
    jest.spyOn(service['logger'], 'error').mockImplementation(mockLogger.error);
    jest.spyOn(service['logger'], 'log').mockImplementation(mockLogger.log);
    jest.spyOn(service['logger'], 'warn').mockImplementation(mockLogger.warn);
    jest.spyOn(service['logger'], 'debug').mockImplementation(mockLogger.debug);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateToken', () => {
    it('should validate a valid JWT token', async () => {
      // Arrange
      const token = 'valid.jwt.token';
      const payload = { sub: 'user123', role: 'user' };

      (jwt.verify as jest.Mock).mockReturnValue(payload);

      // Act
      const result = await service.validateToken(token);

      // Assert
      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-jwt-secret');
      expect(result).toEqual(payload);
    });

    it('should throw UnauthorizedException for invalid token', async () => {
      // Arrange
      const token = 'invalid.jwt.token';

      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert
      await expect(service.validateToken(token)).rejects.toThrow(UnauthorizedException);
      expect(jwt.verify).toHaveBeenCalledWith(token, 'test-jwt-secret');
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Invalid token'));
    });

    it('should throw Error when JWT_SECRET is not defined', async () => {
      // Arrange
      const token = 'valid.jwt.token';

      jest.spyOn(configService, 'get').mockReturnValue(null);

      // Act & Assert
      await expect(service.validateToken(token)).rejects.toThrow('JWT_SECRET is not defined');
    });
  });

  describe('generateToken', () => {
    it('should generate a valid JWT token', () => {
      // Arrange
      const userId = 'user123';
      const role = 'admin';
      const mockToken = 'generated.jwt.token';

      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      // Act
      const result = service.generateToken(userId, role);

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: userId, role },
        'test-jwt-secret',
        { expiresIn: '1h' }
      );
      expect(result).toBe(mockToken);
    });

    it('should use default role when not provided', () => {
      // Arrange
      const userId = 'user123';
      const mockToken = 'generated.jwt.token';

      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      // Act
      const result = service.generateToken(userId);

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: userId, role: 'user' },
        'test-jwt-secret',
        { expiresIn: '1h' }
      );
      expect(result).toBe(mockToken);
    });

    it('should throw Error when JWT_SECRET is not defined', () => {
      // Arrange
      const userId = 'user123';

      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'JWT_EXPIRATION') {
          return '1h';
        }
        return null;
      });

      // Act & Assert
      expect(() => service.generateToken(userId)).toThrow('JWT_SECRET is not defined');
    });

    it('should use default expiration when not configured', () => {
      // Arrange
      const userId = 'user123';
      const mockToken = 'generated.jwt.token';

      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') {
          return 'test-jwt-secret';
        }
        return null;
      });

      (jwt.sign as jest.Mock).mockReturnValue(mockToken);

      // Act
      const result = service.generateToken(userId);

      // Assert
      expect(jwt.sign).toHaveBeenCalledWith(
        { sub: userId, role: 'user' },
        'test-jwt-secret',
        { expiresIn: '1h' }
      );
      expect(result).toBe(mockToken);
    });
  });
});
