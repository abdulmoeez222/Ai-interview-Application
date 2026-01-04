import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  VerifyEmailDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';
import { PasswordUtil } from './utils/password.util';
import { generateToken, generateTokenExpiration } from './utils/token.util';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Register a new user
   */
  async register(dto: RegisterDto) {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const hashedPassword = await PasswordUtil.hashPassword(dto.password);

    // Generate email verification token
    const emailVerifyToken = generateToken();
    const emailVerifyExpires = generateTokenExpiration(24); // 24 hours

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        company: dto.company,
        emailVerifyToken,
        emailVerifyExpires,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // TODO: Send verification email with emailVerifyToken
    // For now, we'll return the token in development
    // In production, send email via email service

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user,
      tokens,
      // Only include in development
      ...(process.env.NODE_ENV === 'development' && {
        verificationToken: emailVerifyToken,
      }),
    };
  }

  /**
   * Login user
   */
  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password);

    if (!user.emailVerified) {
      throw new ForbiddenException('Please verify your email before logging in');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        company: user.company,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  /**
   * Validate user credentials
   */
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await PasswordUtil.comparePasswords(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      company: user.company,
      role: user.role,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(dto: RefreshTokenDto) {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // Check if refresh token exists in database
      const refreshTokenRecord = await this.prisma.refreshToken.findUnique({
        where: { token: dto.refreshToken },
        include: { user: true },
      });

      if (!refreshTokenRecord || refreshTokenRecord.expiresAt < new Date()) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }

      // Check if user still exists
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          company: true,
          role: true,
          emailVerified: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user.id, user.email);

      // Delete old refresh token
      await this.prisma.refreshToken.delete({
        where: { token: dto.refreshToken },
      });

      return {
        user,
        tokens,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Verify user email
   */
  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        emailVerifyToken: dto.token,
        emailVerifyExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    // Update user
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });

    return {
      message: 'Email verified successfully',
    };
  }

  /**
   * Request password reset
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Don't reveal if user exists or not (security best practice)
    if (!user) {
      return {
        message: 'If the email exists, a password reset link has been sent',
      };
    }

    // Generate reset token
    const passwordResetToken = generateToken();
    const passwordResetExpires = generateTokenExpiration(1); // 1 hour

    // Save reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken,
        passwordResetExpires,
      },
    });

    // TODO: Send password reset email
    // For now, we'll return the token in development
    // In production, send email via email service

    return {
      message: 'If the email exists, a password reset link has been sent',
      // Only include in development
      ...(process.env.NODE_ENV === 'development' && {
        resetToken: passwordResetToken,
      }),
    };
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await PasswordUtil.hashPassword(dto.password);

    // Update user password and clear reset token
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return {
      message: 'Password reset successfully',
    };
  }

  /**
   * Get user profile
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        company: true,
        role: true,
        emailVerified: true,
        interviewLimit: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Generate access and refresh tokens (public method for controller use)
   */
  async generateTokensForUser(userId: string, email: string) {
    return this.generateTokens(userId, email);
  }

  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(userId: string, email: string) {
    const payload = {
      sub: userId,
      email,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRATION') || '7d',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION') || '30d',
    });

    // Save refresh token to database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
