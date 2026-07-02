import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { CreateVendedoreDto } from './dto/create-vendedore.dto';
import { UpdateVendedoreDto } from './dto/update-vendedore.dto';
import { LoginVendedoreDto } from './dto/login-vendedore.dto';
import { Vendedor} from './entities/vendedore.entity';

@Injectable()
export class VendedoresService {
  constructor(
    @InjectRepository(Vendedor)
    private readonly vendedoresRepository: Repository<Vendedor>,
  ) {}

  private hashPassword(password: string) {
    return createHash('sha256').update(password).digest('hex');
  }

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
    };
  }

  async ensureSeedUsers() {
    await this.vendedoresRepository.update(
      { email: 'lucasagustinastesiano@gmail.com' },
      { rol: 'administrador', estadoSolicitud: 'aprobado' },
    );

    const count = await this.vendedoresRepository.count();
    if (count > 0) {
      return;
    }

    type SeedUser = {
      nombre: string;
      email: string;
      password: string;
      rol?: 'usuario' | 'administrador';
      estadoSolicitud?: 'pendiente' | 'aprobado' | 'rechazado';
      ruess: string;
      descripcionNegocio: string;
      integrantesEquipo: string[];
      ubicacion: string;
      whatsapp: string;
      telefono: string;
    };

    const seedUsers: SeedUser[] = [
      {
        nombre: 'Lucas Astesiano',
        email: 'lucasagustinastesiano@gmail.com',
        password: '1234',
        rol: 'administrador',
        estadoSolicitud: 'aprobado',
        ruess: '9499',
        descripcionNegocio: 'Emprendimiento local con foco en produccion textil y ventas minoristas.',
        integrantesEquipo: ['Fabiana Astudillo', 'Horacio Rios'],
        ubicacion: 'San Jose, Guaymallen',
        whatsapp: '+549261245684',
        telefono: '261245684',
      },
      {
        nombre: 'leandro gonzalez',
        email: 'leandro@example.com',
        password: '5678',
        ruess: '9510',
        descripcionNegocio: 'Productos artesanales orientados a ferias regionales.',
        integrantesEquipo: ['Leandro Gonzalez'],
        ubicacion: 'Ciudad de Mendoza',
        whatsapp: '+5492614000001',
        telefono: '2614000001',
      },
      {
        nombre: 'Francisco saavedra',
        email: 'francisco@example.com',
        password: '91011',
        ruess: '9533',
        descripcionNegocio: 'Catalogo de alimentos y bebidas de produccion familiar.',
        integrantesEquipo: ['Francisco Saavedra', 'Paula Rojas'],
        ubicacion: 'Las Heras',
        whatsapp: '+5492614000002',
        telefono: '2614000002',
      },
      {
        nombre: 'ulises Guzman',
        email: 'ulises@example.com',
        password: '121314',
        ruess: '9602',
        descripcionNegocio: 'Servicios de hoteleria y gastronomia para eventos.',
        integrantesEquipo: ['Ulises Guzman', 'Micaela Cruz'],
        ubicacion: 'Godoy Cruz',
        whatsapp: '+5492614000003',
        telefono: '2614000003',
      },
    ];

    const vendorSeeds = seedUsers.map((user) =>
      this.vendedoresRepository.create({
        nombre: user.nombre,
        email: user.email,
        rol: user.rol ?? 'usuario',
        estadoSolicitud: user.estadoSolicitud ?? 'aprobado',
        ruess: user.ruess,
        descripcionNegocio: user.descripcionNegocio,
        integrantesEquipo: user.integrantesEquipo,
        ubicacion: user.ubicacion,
        whatsapp: user.whatsapp,
        telefono: user.telefono,
        passwordHash: this.hashPassword(user.password),
      }),
    );

    await this.vendedoresRepository.save(vendorSeeds);
  }

  async create(createVendedoreDto: CreateVendedoreDto) {
    const found = await this.vendedoresRepository.findOne({
      where: { email: createVendedoreDto.email },
    });
    if (found) {
      throw new ConflictException('El email ya existe');
    }

    const created = this.vendedoresRepository.create({
      nombre: createVendedoreDto.nombre,
      email: createVendedoreDto.email,
      rol: createVendedoreDto.rol ?? 'usuario',
      estadoSolicitud: 'pendiente',
      ruess: createVendedoreDto.ruess ?? null,
      descripcionNegocio: createVendedoreDto.descripcionNegocio ?? null,
      integrantesEquipo: createVendedoreDto.integrantesEquipo ?? [],
      ubicacion: createVendedoreDto.ubicacion ?? null,
      whatsapp: createVendedoreDto.whatsapp ?? null,
      telefono: createVendedoreDto.telefono ?? null,
      passwordHash: this.hashPassword(createVendedoreDto.password),
    });

    const saved = await this.vendedoresRepository.save(created);
    return this.sanitize(saved);
  }

  async login(loginDto: LoginVendedoreDto) {
    await this.ensureSeedUsers();

    const vendedor = await this.vendedoresRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!vendedor) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    if (vendedor.estadoSolicitud !== 'aprobado') {
      throw new UnauthorizedException('Tu cuenta esta pendiente de aprobacion');
    }

    const isValid = vendedor.passwordHash === this.hashPassword(loginDto.password);
    if (!isValid) {
      throw new UnauthorizedException('Credenciales incorrectas');
    }

    return {
      message: 'Login exitoso',
      user: this.sanitize(vendedor),
    };
  }

  async findAll() {
    await this.ensureSeedUsers();
    const vendedores = await this.vendedoresRepository.find({
      order: { id: 'ASC' },
    });
    return vendedores.map((vendedor) => this.sanitize(vendedor));
  }

  async findOne(id: number) {
    const vendedor = await this.vendedoresRepository.findOne({ where: { id } });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return this.sanitize(vendedor);
  }

  async update(id: number, updateVendedoreDto: UpdateVendedoreDto) {
    const vendedor = await this.vendedoresRepository.findOne({ where: { id } });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (updateVendedoreDto.email && updateVendedoreDto.email !== vendedor.email) {
      const existingEmail = await this.vendedoresRepository.findOne({
        where: { email: updateVendedoreDto.email },
      });
      if (existingEmail) {
        throw new ConflictException('El email ya existe');
      }
    }

    if (updateVendedoreDto.nombre) {
      vendedor.nombre = updateVendedoreDto.nombre;
    }
    if (updateVendedoreDto.email) {
      vendedor.email = updateVendedoreDto.email;
    }
    if (updateVendedoreDto.password) {
      vendedor.passwordHash = this.hashPassword(updateVendedoreDto.password);
    }
    if (updateVendedoreDto.ruess !== undefined) {
      vendedor.ruess = updateVendedoreDto.ruess || null;
    }
    if (updateVendedoreDto.descripcionNegocio !== undefined) {
      vendedor.descripcionNegocio = updateVendedoreDto.descripcionNegocio || null;
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

    const saved = await this.vendedoresRepository.save(vendedor);
    return this.sanitize(saved);
  }

  async makeAdministrator(id: number) {
    const vendedor = await this.vendedoresRepository.findOne({ where: { id } });
    if (!vendedor) {
      throw new NotFoundException('Usuario no encontrado');
    }

    vendedor.rol = 'administrador';
    vendedor.estadoSolicitud = 'aprobado';

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
