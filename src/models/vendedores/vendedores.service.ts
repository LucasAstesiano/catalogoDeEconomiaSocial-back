import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { PasswordService } from '../../auth/password.service';
import { CreateVendedoreDto } from './dto/create-vendedore.dto';
import { UpdateVendedoreDto } from './dto/update-vendedore.dto';
import { LoginVendedoreDto } from './dto/login-vendedore.dto';
import { Vendedor } from './entities/vendedore.entity';

@Injectable()
export class VendedoresService {
  constructor(
    @InjectRepository(Vendedor)
    private readonly vendedoresRepository: Repository<Vendedor>,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService,
  ) {}

  private sanitize(vendedor: Vendedor) {
    return {
      id: vendedor.id,
      rol: vendedor.rol,
      estadoSolicitud: vendedor.estadoSolicitud,
      nombre: vendedor.nombre,
      email: vendedor.email,
      ruess: vendedor.ruess,
      descripcionNegocio: vendedor.descripcionNegocio,
      integrantesEquipo: vendedor.integrantesEquipo ?? [],
      ubicacion: vendedor.ubicacion,
      whatsapp: vendedor.whatsapp,
      telefono: vendedor.telefono,
      logoUrl: vendedor.logoUrl,
    };
  }

  private sanitizePublic(vendedor: Vendedor) {
    return {
      id: vendedor.id,
      nombre: vendedor.nombre,
      email: vendedor.email,
      ruess: vendedor.ruess,
      descripcionNegocio: vendedor.descripcionNegocio,
      integrantesEquipo: vendedor.integrantesEquipo ?? [],
      ubicacion: vendedor.ubicacion,
      whatsapp: vendedor.whatsapp,
      telefono: vendedor.telefono,
      logoUrl: vendedor.logoUrl,
    };
  }

  async create(createVendedoreDto: CreateVendedoreDto) {
    const email = createVendedoreDto.email.trim().toLowerCase();
    const found = await this.vendedoresRepository.findOne({
      where: { email },
    });
    if (found) {
      throw new ConflictException('El email ya existe');
    }

    const created = this.vendedoresRepository.create({
      nombre: createVendedoreDto.nombre,
      email,
      rol: 'usuario',
      estadoSolicitud: 'pendiente',
      ruess: createVendedoreDto.ruess ?? null,
      descripcionNegocio: createVendedoreDto.descripcionNegocio ?? null,
      integrantesEquipo: createVendedoreDto.integrantesEquipo ?? [],
      ubicacion: createVendedoreDto.ubicacion ?? null,
      whatsapp: createVendedoreDto.whatsapp ?? null,
      telefono: createVendedoreDto.telefono ?? null,
      logoUrl: createVendedoreDto.logoUrl ?? null,
      passwordHash: await this.passwordService.hash(
        createVendedoreDto.password,
      ),
    });

    const saved = await this.vendedoresRepository.save(created);
    return this.sanitize(saved);
  }

  async login(loginDto: LoginVendedoreDto) {
    const email = String(loginDto.email ?? '')
      .trim()
      .toLowerCase();
    const password = String(loginDto.password ?? '');

    const vendedor = await this.vendedoresRepository.findOne({
      where: { email },
    });

    if (!vendedor) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    if (vendedor.estadoSolicitud !== 'aprobado') {
      throw new UnauthorizedException('Tu cuenta esta pendiente de aprobacion');
    }

    const verification = await this.passwordService.verify(
      vendedor.passwordHash,
      password,
    );
    if (!verification.valid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }
    const passwordChangeRequired = verification.legacy;
    const user = { ...this.sanitize(vendedor), passwordChangeRequired };
    const accessToken = await this.jwtService.signAsync({
      sub: vendedor.id,
      email: vendedor.email,
      nombre: vendedor.nombre,
      rol: vendedor.rol,
      passwordChangeRequired,
      sessionVersion: vendedor.sessionVersion,
    });

    return {
      message: 'Login exitoso',
      user,
      accessToken,
    };
  }

  async findAll(page = 1, pageSize = 50, includePrivate = false) {
    const vendedores = await this.vendedoresRepository.find({
      order: { id: 'ASC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return vendedores.map((vendedor) =>
      includePrivate ? this.sanitize(vendedor) : this.sanitizePublic(vendedor),
    );
  }

  async findOne(id: number, includePrivate = false) {
    const vendedor = await this.vendedoresRepository.findOne({ where: { id } });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return includePrivate
      ? this.sanitize(vendedor)
      : this.sanitizePublic(vendedor);
  }

  async update(id: number, updateVendedoreDto: UpdateVendedoreDto) {
    const vendedor = await this.vendedoresRepository.findOne({ where: { id } });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const normalizedEmail = updateVendedoreDto.email?.trim().toLowerCase();
    if (normalizedEmail && normalizedEmail !== vendedor.email) {
      const existingEmail = await this.vendedoresRepository.findOne({
        where: { email: normalizedEmail },
      });
      if (existingEmail) {
        throw new ConflictException('El email ya existe');
      }
    }

    if (updateVendedoreDto.nombre) {
      vendedor.nombre = updateVendedoreDto.nombre;
    }
    if (normalizedEmail) {
      vendedor.email = normalizedEmail;
    }
    if (updateVendedoreDto.ruess !== undefined) {
      vendedor.ruess = updateVendedoreDto.ruess || null;
    }
    if (updateVendedoreDto.descripcionNegocio !== undefined) {
      vendedor.descripcionNegocio =
        updateVendedoreDto.descripcionNegocio || null;
    }
    if (updateVendedoreDto.integrantesEquipo !== undefined) {
      vendedor.integrantesEquipo = updateVendedoreDto.integrantesEquipo;
    }
    if (updateVendedoreDto.ubicacion !== undefined) {
      vendedor.ubicacion = updateVendedoreDto.ubicacion || null;
    }
    if (updateVendedoreDto.whatsapp !== undefined) {
      vendedor.whatsapp = updateVendedoreDto.whatsapp || null;
    }
    if (updateVendedoreDto.telefono !== undefined) {
      vendedor.telefono = updateVendedoreDto.telefono || null;
    }
    if (updateVendedoreDto.logoUrl !== undefined) {
      vendedor.logoUrl = updateVendedoreDto.logoUrl || null;
    }

    const saved = await this.vendedoresRepository.save(vendedor);
    return this.sanitize(saved);
  }

  async updateLogo(id: number, logoUrl: string | null) {
    const vendedor = await this.vendedoresRepository.findOne({ where: { id } });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }

    vendedor.logoUrl = logoUrl?.trim() ? logoUrl : null;
    const saved = await this.vendedoresRepository.save(vendedor);
    return this.sanitize(saved);
  }

  async changePassword(
    id: number,
    currentPassword: string,
    newPassword: string,
  ) {
    const vendedor = await this.vendedoresRepository.findOne({ where: { id } });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const currentMatches = await this.passwordService.verify(
      vendedor.passwordHash,
      currentPassword,
    );
    if (!currentMatches.valid) {
      throw new UnauthorizedException('La contraseña actual es incorrecta');
    }

    if (currentPassword === newPassword) {
      throw new ConflictException(
        'La nueva contraseña debe ser diferente a la actual',
      );
    }

    vendedor.passwordHash = await this.passwordService.hash(newPassword);
    vendedor.sessionVersion = (vendedor.sessionVersion ?? 0) + 1;
    await this.vendedoresRepository.save(vendedor);

    return { message: 'contraseña actualizada correctamente' };
  }

  async makeAdministrator(id: number) {
    const vendedor = await this.vendedoresRepository.findOne({ where: { id } });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }

    vendedor.rol = 'administrador';
    vendedor.estadoSolicitud = 'aprobado';
    vendedor.sessionVersion = (vendedor.sessionVersion ?? 0) + 1;

    const saved = await this.vendedoresRepository.save(vendedor);
    return this.sanitize(saved);
  }

  async remove(id: number) {
    const vendedor = await this.vendedoresRepository.findOne({ where: { id } });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }
    await this.vendedoresRepository.remove(vendedor);
    return { deleted: true, id };
  }
}
